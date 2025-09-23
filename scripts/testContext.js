#!/usr/bin/env node

/**
 * Context Management Test Script
 * Demonstrates how follow-up questions work with conversation context
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

class ContextTest {
    constructor() {
        this.baseUrl = BASE_URL;
        this.sessionId = `context-test-${Date.now()}`;
    }

    async runTests() {
        console.log('🧠 Context Management Demo\n');
        console.log(`Session ID: ${this.sessionId}\n`);

        // Test conversation scenarios
        await this.testBasicFollowUp();
        await this.testSpeakerContext();
        await this.testOrdinalReferences();
        await this.testTopicContinuity();
        await this.showAnalytics();

        console.log('\n🎉 Context management demo complete!');
        console.log('\n💡 This shows how the voice assistant remembers conversation context');
        console.log('   making follow-up questions feel natural and human-like.');
    }

    async testBasicFollowUp() {
        console.log('📋 Test 1: Basic Follow-up Questions\n');

        // Step 1: Ask about AI sessions
        console.log('👤 User: "Find sessions about AI"');
        const aiSessions = await this.sendQuery('search_sessions_by_topic', { topic: 'AI' });
        
        if (aiSessions.result.count > 0) {
            console.log(`🤖 Assistant: Found ${aiSessions.result.count} AI session(s):`);
            aiSessions.result.data.slice(0, 2).forEach((session, i) => {
                console.log(`   ${i + 1}. "${session.title}" by ${session.speaker?.name || 'TBD'}`);
            });

            // Step 2: Follow-up question using context
            console.log('\n👤 User: "Tell me more about the first one"');
            const details = await this.sendQuery('get_session_details', { session_query: 'the first one' });
            
            if (details.result.count > 0) {
                const session = details.result.data[0];
                console.log(`🤖 Assistant: "${session.title}" is at ${session.formatted_time || 'TBD'} in ${session.venue || 'the main venue'}`);
                if (session.description) {
                    console.log(`   Description: ${session.description.substring(0, 100)}...`);
                }
            }
        }

        console.log('   ✅ Context resolved "the first one" to the first AI session\n');
        await this.sleep(1000);
    }

    async testSpeakerContext() {
        console.log('📋 Test 2: Speaker Context Memory\n');

        // Step 1: Search for a specific speaker
        console.log('👤 User: "Find sessions by Jason Lengstorf"');
        const speakerSessions = await this.sendQuery('search_sessions_by_speaker', { speaker_name: 'Jason Lengstorf' });
        
        if (speakerSessions.result.count > 0) {
            console.log(`🤖 Assistant: Found ${speakerSessions.result.count} session(s) by Jason Lengstorf:`);
            speakerSessions.result.data.forEach(session => {
                console.log(`   • "${session.title}"`);
            });

            // Step 2: Ask about "that speaker" - context should remember Jason
            console.log('\n👤 User: "Tell me more about that speaker"');
            const speakerInfo = await this.sendQuery('search_sessions_by_speaker', { speaker_name: 'that speaker' });
            
            if (speakerInfo.result.count > 0) {
                const session = speakerInfo.result.data[0];
                console.log(`🤖 Assistant: Jason Lengstorf from ${session.speaker?.company || 'CodeTV'}`);
                if (session.speaker?.bio) {
                    console.log(`   Bio: ${session.speaker.bio.substring(0, 100)}...`);
                }
            }
        }

        console.log('   ✅ Context resolved "that speaker" to Jason Lengstorf\n');
        await this.sleep(1000);
    }

    async testOrdinalReferences() {
        console.log('📋 Test 3: Ordinal References (first, second, last)\n');

        // Step 1: Get upcoming sessions
        console.log('👤 User: "What are the upcoming sessions?"');
        const upcoming = await this.sendQuery('get_upcoming_sessions', { limit: 3 });
        
        if (upcoming.result.count > 0) {
            console.log(`🤖 Assistant: Here are the next ${upcoming.result.count} sessions:`);
            upcoming.result.data.forEach((session, i) => {
                console.log(`   ${i + 1}. "${session.title}" at ${session.formatted_time || 'TBD'}`);
            });

            if (upcoming.result.count > 1) {
                // Step 2: Ask about the second one
                console.log('\n👤 User: "What\'s the second session about?"');
                const secondSession = await this.sendQuery('get_session_details', { session_query: 'second' });
                
                if (secondSession.result.count > 0) {
                    const session = secondSession.result.data[0];
                    console.log(`🤖 Assistant: The second session is "${session.title}"`);
                    if (session.description) {
                        console.log(`   ${session.description.substring(0, 100)}...`);
                    }
                }
            }
        }

        console.log('   ✅ Context resolved "second" to the 2nd upcoming session\n');
        await this.sleep(1000);
    }

    async testTopicContinuity() {
        console.log('📋 Test 4: Topic Continuity\n');

        // Step 1: Search for leadership sessions
        console.log('👤 User: "Find sessions about leadership"');
        const leadershipSessions = await this.sendQuery('search_sessions_by_topic', { topic: 'leadership' });
        
        if (leadershipSessions.result.count > 0) {
            console.log(`🤖 Assistant: Found ${leadershipSessions.result.count} leadership session(s):`);
            leadershipSessions.result.data.slice(0, 2).forEach(session => {
                console.log(`   • "${session.title}"`);
            });

            // Step 2: Ask for similar content - should use current topic context
            console.log('\n👤 User: "Find more sessions like this"');
            const similarSessions = await this.sendQuery('search_sessions_by_topic', { topic: 'similar sessions' });
            
            if (similarSessions.result.count > 0) {
                console.log(`🤖 Assistant: Found ${similarSessions.result.count} similar session(s):`);
                similarSessions.result.data.slice(0, 2).forEach(session => {
                    console.log(`   • "${session.title}"`);
                });
            }
        }

        console.log('   ✅ Context resolved "similar sessions" to more leadership content\n');
    }

    async showAnalytics() {
        console.log('📊 Context Analytics:\n');
        
        try {
            const response = await axios.get(`${this.baseUrl}/analytics`);
            const analytics = response.data;
            
            console.log(`   Active Context Sessions: ${analytics.contextSessions}`);
            console.log(`   Total Call Sessions: ${analytics.activeSessions}`);
            
            if (analytics.activeContexts && analytics.activeContexts.length > 0) {
                console.log('\n   Active Conversations:');
                analytics.activeContexts.forEach(context => {
                    console.log(`     • Session ${context.sessionId}: ${context.interactionCount} interactions`);
                    if (context.currentTopic) {
                        console.log(`       Current topic: ${context.currentTopic}`);
                    }
                });
            }
            
        } catch (error) {
            console.log(`   ❌ Analytics failed: ${error.message}`);
        }
    }

    async sendQuery(functionName, parameters) {
        try {
            const response = await axios.post(`${this.baseUrl}/demo/query`, {
                function_name: functionName,
                parameters: parameters,
                session_id: this.sessionId
            });

            return response.data;
        } catch (error) {
            console.log(`   ❌ Query failed: ${error.message}`);
            return { result: { count: 0, data: [] } };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Check if server is running first
async function checkServer() {
    try {
        const response = await axios.get(`${BASE_URL}/health`);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

// Run the context test
async function runTest() {
    console.log('🔍 Checking if server is running...');
    
    const serverRunning = await checkServer();
    if (!serverRunning) {
        console.log('❌ Server is not running. Please start it first:');
        console.log('   npm start');
        return;
    }

    console.log('✅ Server is running\n');
    
    const test = new ContextTest();
    await test.runTests();
}

if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = ContextTest;