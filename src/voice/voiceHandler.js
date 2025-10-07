const RealtimeFunctions = require('../nlp/realtimeFunctions');
const ContextManager = require('../nlp/contextManager');
const axios = require('axios');
const WebSocket = require('ws');

class VoiceHandler {
    constructor(nlpProcessor, databaseManager) {
        this.nlpProcessor = nlpProcessor; // Keep for fallback if needed
        this.databaseManager = databaseManager;
        this.realtimeFunctions = new RealtimeFunctions(databaseManager);
        this.contextManager = new ContextManager();

        // Store active sessions for call management
        this.activeSessions = new Map();

        // OpenAI API configuration
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.openaiBaseUrl = 'https://api.openai.com/v1';
    }

    /**
     * Handle function call webhook from OpenAI Realtime API
     * This is fired when the AI needs to call a function during a conversation
     */
    async handleFunctionCallWebhook(req, res) {
        console.log('🔧 Function call webhook:', JSON.stringify(req.body, null, 2));

        try {
            const event = req.body;
            const { call_id, function_name, arguments: argsString, call_id: functionCallId } = event.data || event;

            console.log(`🔧 Executing function: ${function_name}`);

            // Parse arguments
            const args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;

            // Execute the function
            const result = await this.realtimeFunctions.executeFunction(function_name, args);

            console.log(`✅ Function ${function_name} executed:`, result);

            // Return the result to OpenAI
            res.status(200).json({
                output: JSON.stringify(result)
            });

        } catch (error) {
            console.error('❌ Error handling function call webhook:', error);
            res.status(500).json({
                error: error.message
            });
        }
    }

    /**
     * Handle incoming call webhook from OpenAI (via SIP)
     * This is fired when OpenAI receives a SIP call directed to our project
     */
    async handleIncomingCall(req, res) {
        try {
            const event = req.body;

            if (event.type !== 'realtime.call.incoming') {
                return res.status(200).json({ status: 'ignored' });
            }

            const callId = event.data.call_id;

            // Respond immediately - before doing ANYTHING else
            res.status(200).json({ status: 'accepted' });

            // Now do everything else asynchronously
            const sipHeaders = event.data.sip_headers || [];
            const fromHeader = sipHeaders.find(h => h.name === 'From');
            const callerNumber = fromHeader?.value || 'unknown';

            console.log(`📞 Incoming call ${callId} from ${callerNumber}`);

            // Store session info
            this.activeSessions.set(callId, {
                callId,
                callerNumber,
                startTime: new Date(),
                status: 'incoming',
                sipHeaders
            });

            // Accept the call
            this.acceptCall(callId).catch(error => {
                console.error(`❌ Failed to accept call ${callId}:`, error.message);
            });

        } catch (error) {
            console.error('❌ Error handling incoming call:', error);
            res.status(500).json({ error: 'Failed to handle incoming call' });
        }
    }

    /**
     * Accept an incoming call and configure the OpenAI Realtime session
     */
    async acceptCall(callId) {
        console.log(`✅ Accepting call ${callId}...`);

        try {
            // Configure the Realtime session with full instructions and tools
            const tools = this.realtimeFunctions.getFunctionDefinitions().map(func => ({
                type: 'function',
                name: func.name,
                description: func.description,
                parameters: func.parameters
            }));

            const acceptPayload = {
                type: 'realtime',
                model: 'gpt-realtime',
                voice: 'alloy',
                modalities: ['audio', 'text'],
                instructions: this.getSystemInstructions(),
                tools: tools
            };

            console.log(`📞 Accepting call ${callId} with ${tools.length} functions...`);

            const response = await axios.post(
                `${this.openaiBaseUrl}/realtime/calls/${callId}/accept`,
                acceptPayload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json',
                        'OpenAI-Beta': 'realtime=v1'
                    }
                }
            );

            console.log(`✅ Call ${callId} accepted`);

            // Update session status
            const session = this.activeSessions.get(callId);
            if (session) {
                session.status = 'accepted';
                session.acceptedAt = new Date();
            }

            return response.data;

        } catch (error) {
            console.error(`❌ Error accepting call ${callId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Monitor call via WebSocket to handle function calls and events
     * This is REQUIRED to trigger the initial AI greeting
     */
    monitorCall(callId) {
        console.log(`🔌 Opening WebSocket connection for call ${callId}...`);

        // WebSocket endpoint uses call_id as query parameter
        const wsUrl = `wss://api.openai.com/v1/realtime?call_id=${callId}`;
        const ws = new WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`
            }
        });

        const session = this.activeSessions.get(callId);
        if (session) {
            session.websocket = ws;
        }

        ws.on('open', () => {
            console.log(`✅ WebSocket connected for call ${callId}`);

            // Send initial response.create to trigger the AI greeting
            // This is ESSENTIAL - without this, the AI won't start speaking
            ws.send(JSON.stringify({
                type: 'response.create',
                response: {
                    instructions: 'Greet the user warmly and ask how you can help them with the LeadDev New York conference.'
                }
            }));
        });

        ws.on('message', async (data) => {
            try {
                const event = JSON.parse(data.toString());
                await this.handleRealtimeEvent(callId, event, ws);
            } catch (error) {
                console.error(`❌ Error processing WebSocket message for call ${callId}:`, error);
            }
        });

        ws.on('error', (error) => {
            console.error(`❌ WebSocket error for call ${callId}:`, error);
        });

        ws.on('close', () => {
            console.log(`🔌 WebSocket closed for call ${callId}`);
            const session = this.activeSessions.get(callId);
            if (session) {
                session.status = 'ended';
                session.endTime = new Date();
            }
        });
    }

    /**
     * Handle Realtime API events from WebSocket
     */
    async handleRealtimeEvent(callId, event, ws) {
        console.log(`📨 Event for call ${callId}:`, event.type);

        switch (event.type) {
            case 'conversation.item.created':
                // Track conversation items
                break;

            case 'response.function_call_arguments.done':
                // Function call completed, execute it
                await this.executeFunctionCall(callId, event, ws);
                break;

            case 'response.done':
                console.log(`✅ Response completed for call ${callId}`);
                break;

            case 'error':
                console.error(`❌ Error event for call ${callId}:`, event.error);
                break;

            default:
                // Log other events for debugging
                if (process.env.NODE_ENV === 'development') {
                    console.log(`Event: ${event.type}`, JSON.stringify(event, null, 2));
                }
        }
    }

    /**
     * Execute a function call from OpenAI Realtime API
     */
    async executeFunctionCall(callId, event, ws) {
        const { name, call_id, arguments: argsString } = event;

        console.log(`🔧 Executing function: ${name} for call ${callId}`);

        try {
            const args = JSON.parse(argsString);

            // Apply context resolution
            const contextualParams = this.contextManager.resolveContextualQuery(
                callId, name, args
            );

            // Execute the function
            const result = await this.realtimeFunctions.executeFunction(name, contextualParams);

            // Update conversation context
            this.contextManager.updateContext(
                callId, name, contextualParams, result
            );

            // Log for analytics
            this.logFunctionCall(callId, name, contextualParams, result);

            // Send function output back to OpenAI
            ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: call_id,
                    output: JSON.stringify({
                        success: result.success,
                        data: result.data,
                        message: result.message,
                        count: result.count
                    })
                }
            }));

            // Trigger response generation with the function output
            ws.send(JSON.stringify({
                type: 'response.create'
            }));

        } catch (error) {
            console.error(`❌ Error executing function ${name}:`, error);

            // Send error back to OpenAI
            ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: call_id,
                    output: JSON.stringify({
                        success: false,
                        error: error.message
                    })
                }
            }));
        }
    }

    /**
     * Demo endpoint for testing queries without voice call
     */
    async handleTextQuery(req, res) {
        console.log('Demo text query:', req.body);

        try {
            const { query, function_name, parameters, session_id } = req.body;
            const sessionId = session_id || 'demo-session';

            let result;
            if (function_name) {
                // Apply context resolution for demo testing
                const contextualParams = this.contextManager.resolveContextualQuery(
                    sessionId, function_name, parameters || {}
                );
                
                // Direct function call for testing
                result = await this.realtimeFunctions.executeFunction(function_name, contextualParams);
                
                // Update context for follow-up demo queries
                this.contextManager.updateContext(
                    sessionId, function_name, contextualParams, result, query
                );
            } else if (query) {
                // Use fallback NLP processing for demo
                const nlpResult = await this.nlpProcessor?.processInput?.(query) || { intent: 'unknown' };
                result = await this.processQueryIntent(nlpResult);
            } else {
                throw new Error('Either query or function_name is required');
            }

            // Include context information for demo
            const contextSummary = this.contextManager.getConversationSummary(sessionId);
            const suggestions = this.contextManager.generateSuggestions(sessionId);

            res.json({
                success: true,
                result: result,
                context: contextSummary,
                suggestions: suggestions,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error processing demo query:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Hangup a call programmatically
     */
    async hangupCall(callId) {
        console.log(`📴 Hanging up call ${callId}...`);

        try {
            const response = await axios.post(
                `${this.openaiBaseUrl}/realtime/calls/${callId}/hangup`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`
                    }
                }
            );

            console.log(`✅ Call ${callId} hung up successfully`);

            // Close WebSocket if exists
            const session = this.activeSessions.get(callId);
            if (session?.websocket) {
                session.websocket.close();
            }

            return response.data;

        } catch (error) {
            console.error(`❌ Error hanging up call ${callId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Transfer/refer a call to another number
     */
    async referCall(callId, targetUri) {
        console.log(`📞 Referring call ${callId} to ${targetUri}...`);

        try {
            const response = await axios.post(
                `${this.openaiBaseUrl}/realtime/calls/${callId}/refer`,
                { target_uri: targetUri },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Call ${callId} referred successfully`);
            return response.data;

        } catch (error) {
            console.error(`❌ Error referring call ${callId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get system instructions for OpenAI Realtime API
     */
    getSystemInstructions() {
        return `IMPORTANT: Always respond in English only, regardless of the caller's language or accent. Do not switch to other languages.

You are the voice assistant for LeadDev New York, taking place October 15-16, 2025 in New York City.

This is a premier conference for engineering leaders, covering topics like:
- Engineering leadership and management
- AI and machine learning in software development
- Team building and organizational culture
- Technical architecture and decision-making
- Staff+ engineering career paths

The conference features multiple session formats:
- Main stage talks by industry leaders
- Demo stages showcasing cutting-edge tools
- Solution swaps for collaborative problem-solving
- Workshops for hands-on learning
- Table talks for intimate discussions
- Networking sessions and community groups

CRITICAL - FUNCTION CALLING RULES:
You MUST use the available functions to answer ALL conference-related questions. NEVER make up information.

ALWAYS call these functions when users ask:
- "What's happening now?" → call get_current_sessions
- "What's coming up?" / "What's next?" → call get_upcoming_sessions
- "Tell me about [topic]" → call search_sessions_by_topic with the topic
- "Who is [speaker name]?" / "Sessions by [speaker]" → call search_sessions_by_speaker
- "Show me workshops/demos/talks" → call search_sessions_by_type
- "What's the full schedule?" → call get_full_schedule
- Any other question → call search_general with their question

Response guidelines:
- Keep responses conversational and concise (voice-friendly)
- ALWAYS call a function before answering - you have NO information without calling functions
- When listing sessions, mention time and location
- If nothing matches, suggest similar or popular alternatives
- Be enthusiastic about helping them get the most from the conference

Example greeting: "Hi! I'm here to help you navigate LeadDev New York. Are you looking for specific sessions, speakers, or topics? Or would you like to hear what's happening right now?"

Remember: This is a voice conversation - be natural, friendly, and helpful!`;
    }

    /**
     * Process query intent (fallback method for demo)
     */
    async processQueryIntent(nlpResult) {
        const { intent, entities } = nlpResult;

        switch (intent) {
            case 'current_sessions':
                return await this.realtimeFunctions.getCurrentSessions();
            
            case 'upcoming_sessions':
                return await this.realtimeFunctions.getUpcomingSessions(5);
            
            case 'speaker_info':
                if (entities.speaker_names?.[0] || entities.search_terms?.[0]) {
                    const speakerName = entities.speaker_names?.[0] || entities.search_terms?.[0];
                    return await this.realtimeFunctions.searchSessionsBySpeaker(speakerName);
                }
                break;
            
            case 'topic_search':
                if (entities.topics?.[0] || entities.search_terms?.[0]) {
                    const topic = entities.topics?.[0] || entities.search_terms?.[0];
                    return await this.realtimeFunctions.searchSessionsByTopic(topic);
                }
                break;
            
            case 'schedule_overview':
                return await this.realtimeFunctions.getFullSchedule();
            
            default:
                if (entities.search_terms?.[0]) {
                    return await this.realtimeFunctions.searchGeneral(entities.search_terms[0]);
                }
        }

        return {
            success: true,
            data: [],
            message: "I'm not sure how to help with that. Try asking about current sessions, speakers, or topics."
        };
    }

    /**
     * Log function calls for analytics
     */
    logFunctionCall(callId, functionName, parameters, result) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            callId,
            functionName,
            parameters,
            success: result.success,
            resultCount: result.count,
            error: result.error
        };

        console.log('Function call log:', logEntry);
        
        // In production, you might want to store this in a database or analytics service
    }

    /**
     * Get analytics data for the conference assistant
     */
    async getAnalytics(req, res) {
        try {
            // Return comprehensive analytics including context management
            const analytics = {
                activeSessions: this.activeSessions.size,
                totalSessions: await this.databaseManager.getAllSessions().then(s => s.length),
                contextSessions: this.contextManager.getActiveSessionCount(),
                activeContexts: this.contextManager.getActiveSessions(),
                systemHealth: {
                    database: 'healthy',
                    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
                    infobip: process.env.INFOBIP_API_KEY ? 'configured' : 'not configured',
                    contextManager: 'active'
                }
            };

            res.json(analytics);
        } catch (error) {
            console.error('Error getting analytics:', error);
            res.status(500).json({ error: 'Failed to get analytics' });
        }
    }
}

/**
 * Generate a unique call ID
 */
function generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = VoiceHandler;