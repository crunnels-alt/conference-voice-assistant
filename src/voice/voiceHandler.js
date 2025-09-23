const RealtimeFunctions = require('../nlp/realtimeFunctions');
const ContextManager = require('../nlp/contextManager');

class VoiceHandler {
    constructor(nlpProcessor, databaseManager) {
        this.nlpProcessor = nlpProcessor; // Keep for fallback if needed
        this.databaseManager = databaseManager;
        this.realtimeFunctions = new RealtimeFunctions(databaseManager);
        this.contextManager = new ContextManager();
        
        // Store active sessions for call management
        this.activeSessions = new Map();
    }

    /**
     * Handle inbound call from Infobip Voice API
     * This sets up the initial call flow and connects to OpenAI Realtime API
     */
    async handleInboundCall(req, res) {
        console.log('Handling inbound call:', req.body);

        try {
            // Create session for this call
            const callId = req.body.callId || generateCallId();
            const fromNumber = req.body.from;
            
            this.activeSessions.set(callId, {
                callId,
                fromNumber,
                startTime: new Date(),
                context: {}
            });

            // Response to connect call to OpenAI Realtime API via SIP
            const response = {
                actions: [
                    {
                        action: "connect",
                        from: process.env.INFOBIP_FROM_NUMBER || fromNumber,
                        to: {
                            type: "sip",
                            sipUri: this.getOpenAIRealtimeSipUri()
                        },
                        maxDuration: 1800, // 30 minutes max
                        connectTimeout: 30,
                        onConnect: {
                            webhook: `${process.env.WEBHOOK_BASE_URL}/webhook/voice/connected`
                        },
                        onHangup: {
                            webhook: `${process.env.WEBHOOK_BASE_URL}/webhook/voice/hangup`
                        }
                    }
                ]
            };

            res.json(response);

        } catch (error) {
            console.error('Error handling inbound call:', error);
            res.status(500).json({ error: 'Failed to handle inbound call' });
        }
    }

    /**
     * Handle connection established to OpenAI Realtime API
     */
    async handleConnected(req, res) {
        console.log('Connected to OpenAI Realtime API:', req.body);
        
        // Log successful connection
        const callId = req.body.callId;
        if (this.activeSessions.has(callId)) {
            const session = this.activeSessions.get(callId);
            session.connectedAt = new Date();
            session.status = 'connected';
        }

        res.json({ status: 'acknowledged' });
    }

    /**
     * Handle hangup events
     */
    async handleHangup(req, res) {
        console.log('Call ended:', req.body);
        
        const callId = req.body.callId;
        if (this.activeSessions.has(callId)) {
            const session = this.activeSessions.get(callId);
            session.endTime = new Date();
            session.duration = session.endTime - session.startTime;
            
            console.log(`Call ${callId} ended. Duration: ${session.duration}ms`);
            
            // Clean up session after a delay (for any final webhooks)
            setTimeout(() => {
                this.activeSessions.delete(callId);
            }, 60000); // 1 minute delay
        }

        res.json({ status: 'acknowledged' });
    }

    /**
     * Handle function calls from OpenAI Realtime API
     * This is the webhook endpoint that OpenAI calls when it needs conference data
     */
    async handleFunctionCall(req, res) {
        console.log('Function call from OpenAI:', req.body);

        try {
            const { function_name, parameters, call_id, user_query } = req.body;
            
            // Apply context resolution to parameters
            const sessionId = call_id || 'default';
            const contextualParams = this.contextManager.resolveContextualQuery(
                sessionId, function_name, parameters
            );
            
            // Execute the requested function with contextual parameters
            const result = await this.realtimeFunctions.executeFunction(function_name, contextualParams);
            
            // Update conversation context with the interaction
            this.contextManager.updateContext(
                sessionId, function_name, contextualParams, result, user_query
            );
            
            // Log the function call for analytics
            this.logFunctionCall(call_id, function_name, contextualParams, result);

            // Include suggestions in response for better UX
            const suggestions = this.contextManager.generateSuggestions(sessionId);

            res.json({
                success: result.success,
                data: result.data,
                message: result.message,
                count: result.count,
                suggestions: suggestions.length > 0 ? suggestions : undefined
            });

        } catch (error) {
            console.error('Error executing function call:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to execute function',
                data: []
            });
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
     * Get OpenAI Realtime API SIP URI
     * This is where Infobip will connect the call
     */
    getOpenAIRealtimeSipUri() {
        // The SIP URI format for OpenAI Realtime API
        // This will include function definitions and system instructions
        const functionDefinitions = this.realtimeFunctions.getFunctionDefinitions();
        
        // Encode the configuration for OpenAI Realtime API
        const config = {
            functions: functionDefinitions,
            function_call_webhook: `${process.env.WEBHOOK_BASE_URL}/webhook/openai/function-call`,
            instructions: this.getSystemInstructions(),
            voice: "alloy", // or "echo", "fable", "onyx", "nova", "shimmer"
            model: "gpt-4o-realtime-preview"
        };

        // In a real implementation, you would encode this config and pass it to OpenAI
        // For now, we'll construct the expected SIP URI format
        const encodedConfig = Buffer.from(JSON.stringify(config)).toString('base64');
        
        return `sip:${encodedConfig}@api.openai.com`;
    }

    /**
     * Get system instructions for OpenAI Realtime API
     */
    getSystemInstructions() {
        return `You are a helpful voice assistant for the LeadDev New York conference. 

Your role is to help conference attendees find information about:
- Current and upcoming sessions
- Speaker information and backgrounds  
- Session details, times, and locations
- Topics and session types
- Conference schedule overview

Key guidelines:
- Be conversational and friendly
- Provide concise but helpful information
- Use the available functions to get accurate conference data
- If you can't find specific information, offer alternatives
- Always mention session times and locations when available
- Help users discover relevant content based on their interests

The conference focuses on engineering leadership, management, AI, and technical topics.
Session types include talks, demo stages, solution swaps, and workshops.

When users ask questions, use the provided functions to get current data and respond naturally.`;
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