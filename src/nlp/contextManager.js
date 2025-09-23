/**
 * Conversation Context Manager
 * Handles follow-up questions and maintains conversation state for natural dialogue
 */

class ContextManager {
    constructor() {
        // Store conversation contexts by call/session ID
        this.contexts = new Map();
        
        // Context expires after 10 minutes of inactivity
        this.CONTEXT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        
        // Clean up expired contexts every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredContexts();
        }, 5 * 60 * 1000);
    }

    /**
     * Create or get conversation context for a session
     * @param {string} sessionId - Unique identifier for the conversation
     * @returns {Object} Context object
     */
    getContext(sessionId) {
        if (!this.contexts.has(sessionId)) {
            this.contexts.set(sessionId, this.createNewContext(sessionId));
        }

        const context = this.contexts.get(sessionId);
        context.lastActivity = new Date();
        return context;
    }

    /**
     * Create a new conversation context
     */
    createNewContext(sessionId) {
        return {
            sessionId,
            createdAt: new Date(),
            lastActivity: new Date(),
            conversationHistory: [],
            lastQuery: null,
            lastResults: [],
            currentTopic: null,
            mentionedSpeakers: new Set(),
            mentionedSessions: new Set(),
            recentSearchTerms: new Set(),
            userPreferences: {}
        };
    }

    /**
     * Update context after a function call or user interaction
     * @param {string} sessionId - Session identifier
     * @param {string} functionName - Name of function that was called
     * @param {Object} parameters - Parameters passed to function
     * @param {Object} results - Results returned from function
     * @param {string} userQuery - Original user query (optional)
     */
    updateContext(sessionId, functionName, parameters, results, userQuery = null) {
        const context = this.getContext(sessionId);
        
        // Add to conversation history
        const entry = {
            timestamp: new Date(),
            functionName,
            parameters,
            resultCount: results.count || 0,
            userQuery,
            success: results.success
        };
        
        context.conversationHistory.push(entry);
        
        // Keep only last 10 interactions to prevent memory bloat
        if (context.conversationHistory.length > 10) {
            context.conversationHistory = context.conversationHistory.slice(-10);
        }

        // Store last query and results for follow-up questions
        context.lastQuery = {
            functionName,
            parameters,
            results: results.data || [],
            timestamp: new Date()
        };

        // Update last results for easy reference
        context.lastResults = results.data || [];

        // Extract and remember entities from this interaction
        this.extractEntities(context, parameters, results);

        // Update current topic
        this.updateCurrentTopic(context, functionName, parameters);

        return context;
    }

    /**
     * Extract entities from parameters and results to remember for context
     */
    extractEntities(context, parameters, results) {
        // Remember speakers from parameters
        if (parameters.speaker_name) {
            context.mentionedSpeakers.add(parameters.speaker_name.toLowerCase());
            context.recentSearchTerms.add(parameters.speaker_name.toLowerCase());
        }

        // Remember topics from parameters
        if (parameters.topic) {
            context.recentSearchTerms.add(parameters.topic.toLowerCase());
        }

        // Remember search terms
        if (parameters.query) {
            context.recentSearchTerms.add(parameters.query.toLowerCase());
        }

        // Extract entities from results
        if (results.data && Array.isArray(results.data)) {
            results.data.forEach(item => {
                // Remember speakers from results
                if (item.speaker && item.speaker.name) {
                    context.mentionedSpeakers.add(item.speaker.name.toLowerCase());
                }

                // Remember session titles
                if (item.title) {
                    context.mentionedSessions.add(item.title.toLowerCase());
                }
            });
        }

        // Limit memory usage - keep only recent entities
        this.limitSetSize(context.mentionedSpeakers, 20);
        this.limitSetSize(context.mentionedSessions, 15);
        this.limitSetSize(context.recentSearchTerms, 10);
    }

    /**
     * Limit Set size to prevent memory bloat
     */
    limitSetSize(set, maxSize) {
        if (set.size > maxSize) {
            const items = Array.from(set);
            set.clear();
            items.slice(-maxSize).forEach(item => set.add(item));
        }
    }

    /**
     * Update current topic based on the query
     */
    updateCurrentTopic(context, functionName, parameters) {
        if (functionName === 'search_sessions_by_topic' && parameters.topic) {
            context.currentTopic = parameters.topic.toLowerCase();
        } else if (functionName === 'search_sessions_by_speaker' && parameters.speaker_name) {
            context.currentTopic = `speaker: ${parameters.speaker_name.toLowerCase()}`;
        } else if (functionName === 'search_sessions_by_type' && parameters.session_type) {
            context.currentTopic = `type: ${parameters.session_type.toLowerCase()}`;
        } else if (functionName === 'get_current_sessions') {
            context.currentTopic = 'current sessions';
        } else if (functionName === 'get_upcoming_sessions') {
            context.currentTopic = 'upcoming sessions';
        }
    }

    /**
     * Resolve contextual parameters for follow-up questions
     * @param {string} sessionId - Session identifier
     * @param {string} functionName - Function being called
     * @param {Object} parameters - Original parameters
     * @returns {Object} Enhanced parameters with context resolution
     */
    resolveContextualQuery(sessionId, functionName, parameters) {
        const context = this.getContext(sessionId);
        let enhancedParams = { ...parameters };

        // Handle different types of contextual references
        enhancedParams = this.resolveFollowUpQueries(context, functionName, enhancedParams);
        enhancedParams = this.resolveContextualReferences(context, enhancedParams);
        enhancedParams = this.resolveRelativeReferences(context, enhancedParams);

        return enhancedParams;
    }

    /**
     * Handle follow-up queries like "tell me more about the first one"
     */
    resolveFollowUpQueries(context, functionName, parameters) {
        if (!context.lastResults || context.lastResults.length === 0) {
            return parameters;
        }

        // Handle ordinal references (first, second, last, etc.)
        if (functionName === 'get_session_details') {
            const sessionQuery = parameters.session_query || '';
            const ordinalMatch = this.extractOrdinalReference(sessionQuery);
            
            if (ordinalMatch) {
                const targetSession = this.getSessionByOrdinal(context.lastResults, ordinalMatch);
                if (targetSession) {
                    return {
                        ...parameters,
                        session_query: targetSession.title || targetSession.speaker?.name
                    };
                }
            }
        }

        // Handle speaker queries without specific name
        if (functionName === 'search_sessions_by_speaker' && !parameters.speaker_name) {
            const firstSpeaker = context.lastResults.find(item => item.speaker?.name);
            if (firstSpeaker) {
                return {
                    ...parameters,
                    speaker_name: firstSpeaker.speaker.name
                };
            }
        }

        return parameters;
    }

    /**
     * Extract ordinal references like "first", "second", "last"
     */
    extractOrdinalReference(text) {
        const ordinals = {
            'first': 0, 'second': 1, 'third': 2, 'fourth': 3, 'fifth': 4,
            'last': -1, 'latest': -1, 'newest': -1,
            '1st': 0, '2nd': 1, '3rd': 2, '4th': 3, '5th': 4
        };

        const lowerText = text.toLowerCase();
        for (const [ordinal, index] of Object.entries(ordinals)) {
            if (lowerText.includes(ordinal)) {
                return index;
            }
        }
        return null;
    }

    /**
     * Get session by ordinal position
     */
    getSessionByOrdinal(results, ordinalIndex) {
        if (!results || results.length === 0) return null;
        
        if (ordinalIndex === -1) {
            return results[results.length - 1]; // Last item
        } else if (ordinalIndex >= 0 && ordinalIndex < results.length) {
            return results[ordinalIndex];
        }
        
        return null;
    }

    /**
     * Resolve contextual references like "that speaker", "the session"
     */
    resolveContextualReferences(context, parameters) {
        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === 'string') {
                parameters[key] = this.replaceContextualTerms(context, value);
            }
        }
        return parameters;
    }

    /**
     * Replace contextual terms with actual values from context
     */
    replaceContextualTerms(context, text) {
        const lowerText = text.toLowerCase();

        // Replace speaker references
        if (lowerText.includes('that speaker') || lowerText.includes('the speaker')) {
            const recentSpeaker = this.getRecentEntity(context.mentionedSpeakers);
            if (recentSpeaker) {
                return text.replace(/that speaker|the speaker/gi, recentSpeaker);
            }
        }

        // Replace session references
        if (lowerText.includes('that session') || lowerText.includes('the session')) {
            const recentSession = this.getRecentEntity(context.mentionedSessions);
            if (recentSession) {
                return text.replace(/that session|the session/gi, recentSession);
            }
        }

        // Replace topic references
        if (lowerText.includes('same topic') || lowerText.includes('that topic')) {
            if (context.currentTopic && !context.currentTopic.startsWith('speaker:')) {
                const topic = context.currentTopic.replace('type: ', '');
                return text.replace(/same topic|that topic/gi, topic);
            }
        }

        return text;
    }

    /**
     * Get most recently mentioned entity from a Set
     */
    getRecentEntity(entitySet) {
        if (entitySet.size === 0) return null;
        return Array.from(entitySet).pop(); // Last added item
    }

    /**
     * Resolve relative references like "more like this", "similar sessions"
     */
    resolveRelativeReferences(context, parameters) {
        // If asking for "similar" or "related" content, use current topic
        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === 'string' && 
                (value.includes('similar') || value.includes('related') || value.includes('like this'))) {
                
                if (context.currentTopic && key === 'topic') {
                    parameters[key] = context.currentTopic.replace('speaker: ', '').replace('type: ', '');
                }
            }
        }

        return parameters;
    }

    /**
     * Generate contextual suggestions for the user
     */
    generateSuggestions(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context) return [];

        const suggestions = [];

        // Suggest follow-up questions based on last results
        if (context.lastResults && context.lastResults.length > 1) {
            suggestions.push("Tell me about the second one");
            suggestions.push("Who's speaking at the last session?");
        }

        // Suggest related topics
        if (context.currentTopic) {
            suggestions.push(`Find more sessions like this`);
            suggestions.push(`What else is happening at the same time?`);
        }

        // Suggest speaker exploration
        if (context.mentionedSpeakers.size > 0) {
            const speaker = this.getRecentEntity(context.mentionedSpeakers);
            suggestions.push(`Tell me more about ${speaker}`);
        }

        return suggestions.slice(0, 3); // Return top 3 suggestions
    }

    /**
     * Get conversation summary for analytics
     */
    getConversationSummary(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context) return null;

        return {
            sessionId,
            duration: new Date() - context.createdAt,
            interactionCount: context.conversationHistory.length,
            currentTopic: context.currentTopic,
            mentionedSpeakers: Array.from(context.mentionedSpeakers),
            mentionedSessions: Array.from(context.mentionedSessions),
            lastActivity: context.lastActivity,
            suggestions: this.generateSuggestions(sessionId)
        };
    }

    /**
     * Clean up expired conversation contexts
     */
    cleanupExpiredContexts() {
        const now = new Date();
        const expiredSessions = [];

        for (const [sessionId, context] of this.contexts.entries()) {
            const timeSinceLastActivity = now - context.lastActivity;
            if (timeSinceLastActivity > this.CONTEXT_TIMEOUT) {
                expiredSessions.push(sessionId);
            }
        }

        expiredSessions.forEach(sessionId => {
            this.contexts.delete(sessionId);
            console.log(`Cleaned up expired context for session: ${sessionId}`);
        });

        if (expiredSessions.length > 0) {
            console.log(`Context cleanup: removed ${expiredSessions.length} expired sessions`);
        }
    }

    /**
     * Clear context for a specific session
     */
    clearContext(sessionId) {
        return this.contexts.delete(sessionId);
    }

    /**
     * Get active session count for monitoring
     */
    getActiveSessionCount() {
        return this.contexts.size;
    }

    /**
     * Get all active sessions (for admin/debugging)
     */
    getActiveSessions() {
        const sessions = [];
        for (const [sessionId, context] of this.contexts.entries()) {
            sessions.push({
                sessionId,
                createdAt: context.createdAt,
                lastActivity: context.lastActivity,
                interactionCount: context.conversationHistory.length,
                currentTopic: context.currentTopic
            });
        }
        return sessions;
    }

    /**
     * Shutdown context manager and cleanup
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.contexts.clear();
        console.log('Context manager shut down');
    }
}

module.exports = ContextManager;