/**
 * Function definitions for OpenAI Realtime API
 * These functions will be called by OpenAI when the user asks conference-related questions
 */

class RealtimeFunctions {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        
        // Define the function schemas for OpenAI Realtime API
        this.functions = [
            {
                name: "get_current_sessions",
                description: "Get sessions that are currently running or active at the conference",
                parameters: {
                    type: "object",
                    properties: {},
                    required: []
                }
            },
            {
                name: "get_upcoming_sessions", 
                description: "Get upcoming sessions at the conference",
                parameters: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "integer",
                            description: "Maximum number of sessions to return",
                            default: 5
                        }
                    },
                    required: []
                }
            },
            {
                name: "search_sessions_by_topic",
                description: "Search for sessions related to a specific topic or keyword",
                parameters: {
                    type: "object",
                    properties: {
                        topic: {
                            type: "string", 
                            description: "Topic or keyword to search for (e.g., 'AI', 'leadership', 'management')"
                        }
                    },
                    required: ["topic"]
                }
            },
            {
                name: "search_sessions_by_speaker",
                description: "Find sessions by a specific speaker",
                parameters: {
                    type: "object",
                    properties: {
                        speaker_name: {
                            type: "string",
                            description: "Name of the speaker to search for"
                        }
                    },
                    required: ["speaker_name"]
                }
            },
            {
                name: "get_session_details",
                description: "Get detailed information about a specific session",
                parameters: {
                    type: "object",
                    properties: {
                        session_query: {
                            type: "string",
                            description: "Session title, speaker name, or other identifying information"
                        }
                    },
                    required: ["session_query"]
                }
            },
            {
                name: "search_sessions_by_type",
                description: "Find sessions of a specific type (talk, demo, workshop, etc.)",
                parameters: {
                    type: "object", 
                    properties: {
                        session_type: {
                            type: "string",
                            enum: ["talk", "demo", "demo stage", "solution swap", "workshop", "panel"],
                            description: "Type of session to search for"
                        }
                    },
                    required: ["session_type"]
                }
            },
            {
                name: "get_full_schedule",
                description: "Get the complete conference schedule or schedule overview",
                parameters: {
                    type: "object",
                    properties: {
                        day: {
                            type: "string",
                            enum: ["today", "tomorrow", "all"],
                            description: "Which day's schedule to retrieve",
                            default: "all"
                        }
                    },
                    required: []
                }
            },
            {
                name: "search_general",
                description: "General search across all conference data when the intent is unclear",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search term or phrase to look for across sessions, speakers, and descriptions"
                        }
                    },
                    required: ["query"]
                }
            }
        ];
    }

    /**
     * Get the function definitions for OpenAI Realtime API
     * @returns {Array} Array of function definitions
     */
    getFunctionDefinitions() {
        return this.functions;
    }

    /**
     * Execute a function call from OpenAI Realtime API
     * @param {string} functionName - Name of the function to call
     * @param {Object} parameters - Function parameters
     * @returns {Object} Function result
     */
    async executeFunction(functionName, parameters = {}) {
        try {
            switch (functionName) {
                case 'get_current_sessions':
                    return await this.getCurrentSessions();
                    
                case 'get_upcoming_sessions':
                    return await this.getUpcomingSessions(parameters.limit || 5);
                    
                case 'search_sessions_by_topic':
                    return await this.searchSessionsByTopic(parameters.topic);
                    
                case 'search_sessions_by_speaker':
                    return await this.searchSessionsBySpeaker(parameters.speaker_name);
                    
                case 'get_session_details':
                    return await this.getSessionDetails(parameters.session_query);
                    
                case 'search_sessions_by_type':
                    return await this.searchSessionsByType(parameters.session_type);
                    
                case 'get_full_schedule':
                    return await this.getFullSchedule(parameters.day || 'all');
                    
                case 'search_general':
                    return await this.searchGeneral(parameters.query);
                    
                default:
                    return {
                        success: false,
                        error: `Unknown function: ${functionName}`,
                        data: []
                    };
            }
        } catch (error) {
            console.error(`Error executing function ${functionName}:`, error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * Get currently running sessions
     */
    async getCurrentSessions() {
        const sessions = await this.databaseManager.getCurrentSessions();
        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? "No sessions are currently running" : `Found ${sessions.length} current session(s)`
        };
    }

    /**
     * Get upcoming sessions
     */
    async getUpcomingSessions(limit = 5) {
        const sessions = await this.databaseManager.getUpcomingSessions(limit);
        return {
            success: true,
            count: sessions.length, 
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? "No upcoming sessions found" : `Found ${sessions.length} upcoming session(s)`
        };
    }

    /**
     * Search sessions by topic
     */
    async searchSessionsByTopic(topic) {
        if (!topic) {
            return { success: false, error: "Topic is required", data: [] };
        }

        const sessions = await this.databaseManager.getSessionsByTopic(topic);
        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? `No sessions found about ${topic}` : `Found ${sessions.length} session(s) about ${topic}`
        };
    }

    /**
     * Search sessions by speaker
     */
    async searchSessionsBySpeaker(speakerName) {
        if (!speakerName) {
            return { success: false, error: "Speaker name is required", data: [] };
        }

        const sessions = await this.databaseManager.getSessionsBySpeaker(speakerName);
        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? `No sessions found by ${speakerName}` : `Found ${sessions.length} session(s) by ${speakerName}`
        };
    }

    /**
     * Get session details
     */
    async getSessionDetails(sessionQuery) {
        if (!sessionQuery) {
            return { success: false, error: "Session query is required", data: [] };
        }

        // Try multiple search strategies
        let sessions = await this.databaseManager.searchSessions(sessionQuery);
        
        if (sessions.length === 0) {
            // Try searching by speaker if no sessions found
            sessions = await this.databaseManager.getSessionsBySpeaker(sessionQuery);
        }

        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? `No sessions found matching "${sessionQuery}"` : `Found ${sessions.length} session(s) matching "${sessionQuery}"`
        };
    }

    /**
     * Search sessions by type
     */
    async searchSessionsByType(sessionType) {
        if (!sessionType) {
            return { success: false, error: "Session type is required", data: [] };
        }

        const sessions = await this.databaseManager.getSessionsByType(sessionType);
        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? `No ${sessionType} sessions found` : `Found ${sessions.length} ${sessionType} session(s)`
        };
    }

    /**
     * Get full schedule
     */
    async getFullSchedule(day = 'all') {
        const sessions = await this.databaseManager.getAllSessions();
        
        let filteredSessions = sessions;
        if (day === 'today') {
            const today = new Date().toDateString();
            filteredSessions = sessions.filter(session => 
                new Date(session.start_time).toDateString() === today
            );
        } else if (day === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowString = tomorrow.toDateString();
            filteredSessions = sessions.filter(session =>
                new Date(session.start_time).toDateString() === tomorrowString
            );
        }

        return {
            success: true,
            count: filteredSessions.length,
            data: filteredSessions.map(this.formatSession),
            message: `Conference schedule has ${filteredSessions.length} sessions total`
        };
    }

    /**
     * General search
     */
    async searchGeneral(query) {
        if (!query) {
            return { success: false, error: "Search query is required", data: [] };
        }

        const sessions = await this.databaseManager.searchSessions(query);
        return {
            success: true,
            count: sessions.length,
            data: sessions.map(this.formatSession),
            message: sessions.length === 0 ? `No results found for "${query}"` : `Found ${sessions.length} result(s) for "${query}"`
        };
    }

    /**
     * Format session data for consistent response structure
     * @param {Object} session - Raw session data from database
     * @returns {Object} Formatted session data
     */
    formatSession(session) {
        return {
            id: session.id,
            title: session.title,
            description: session.description,
            start_time: session.start_time,
            end_time: session.end_time,
            formatted_time: formatTime(session.start_time),
            speaker: {
                name: session.speaker_name,
                title: session.speaker_title,
                company: session.speaker_company,
                bio: session.speaker_bio
            },
            venue: session.venue_name,
            session_type: session.session_type,
            topic: session.topic_name,
            suitability_levels: session.suitability_levels ? session.suitability_levels.split(',') : [],
            sponsor: session.sponsor_company_name,
            is_sponsored: !!session.is_sponsored
        };
    }
}

/**
 * Helper function to format time
 */
function formatTime(isoString) {
    if (!isoString) return null;
    
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

module.exports = RealtimeFunctions;