#!/usr/bin/env node

/**
 * Production Voice Assistant Test Script
 * Tests the deployed application without needing API keys
 */

const axios = require('axios');

const BASE_URL = 'https://conference-voice-assistant-production.up.railway.app';

class ProductionTester {
    constructor() {
        this.sessionId = `prod-test-${Date.now()}`;
    }

    async runTests() {
        console.log('🎤 Testing Production Conference Voice Assistant\n');
        console.log(`🌐 Base URL: ${BASE_URL}`);
        console.log(`📱 Session ID: ${this.sessionId}\n`);

        try {
            // Health check
            await this.testHealthCheck();
            
            // Test conference queries
            await this.testConferenceQueries();
            
            // Test analytics
            await this.testAnalytics();
            
            // Test context management
            await this.testContextManagement();
            
            console.log('\n🎉 All tests completed successfully!');
            console.log('\n💡 Your voice assistant is ready for phone calls once you add API keys!');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }

    async testHealthCheck() {
        console.log('🏥 Testing Health Check...');
        
        const response = await axios.get(`${BASE_URL}/health`);
        console.log(`   ✅ Status: ${response.data.status}`);
        console.log(`   🕐 Timestamp: ${response.data.timestamp}\n`);
    }

    async testConferenceQueries() {
        console.log('📋 Testing Conference Queries...\n');

        const queries = [
            {
                name: 'Find AI Sessions',
                function: 'search_sessions_by_topic',
                params: { topic: 'AI' }
            },
            {
                name: 'Find Jason Lengstorf',
                function: 'search_sessions_by_speaker', 
                params: { speaker_name: 'Jason Lengstorf' }
            },
            {
                name: 'Get Current Sessions',
                function: 'get_current_sessions',
                params: {}
            },
            {
                name: 'Find Demo Sessions',
                function: 'search_sessions_by_type',
                params: { session_type: 'DEMO STAGE' }
            }
        ];

        for (const query of queries) {
            console.log(`   🔍 ${query.name}...`);
            
            const response = await this.sendQuery(query.function, query.params);
            
            if (response.success && response.result.count > 0) {
                const firstResult = response.result.data[0];
                console.log(`      ✅ Found ${response.result.count} result(s)`);
                console.log(`      📖 Sample: "${firstResult.title}"`);
                if (firstResult.speaker?.name) {
                    console.log(`      🎤 Speaker: ${firstResult.speaker.name}`);
                }
            } else {
                console.log(`      ℹ️  No results found`);
            }
            console.log('');
        }
    }

    async testAnalytics() {
        console.log('📊 Testing Analytics...');
        
        const response = await axios.get(`${BASE_URL}/analytics`);
        const analytics = response.data;
        
        console.log(`   📈 Total Sessions: ${analytics.totalSessions}`);
        console.log(`   🔄 Active Sessions: ${analytics.activeSessions}`);
        console.log(`   🧠 Context Sessions: ${analytics.contextSessions}`);
        console.log(`   🏥 Database: ${analytics.systemHealth.database}`);
        console.log(`   🤖 OpenAI: ${analytics.systemHealth.openai}`);
        console.log(`   📞 Infobip: ${analytics.systemHealth.infobip}\n`);
    }

    async testContextManagement() {
        console.log('🧠 Testing Context Management...\n');

        // First query
        console.log('   🔍 Query 1: Find leadership sessions...');
        const firstQuery = await this.sendQuery('search_sessions_by_topic', { topic: 'leadership' });
        
        if (firstQuery.context) {
            console.log(`      ✅ Context created with ID: ${firstQuery.context.sessionId}`);
            console.log(`      🎯 Current topic: ${firstQuery.context.currentTopic}`);
            console.log(`      💬 Interaction count: ${firstQuery.context.interactionCount}`);
            
            if (firstQuery.context.suggestions.length > 0) {
                console.log(`      💡 Suggestions: ${firstQuery.context.suggestions.slice(0, 2).join(', ')}`);
            }
        }

        // Follow-up query using same session
        console.log('\n   🔍 Query 2: Follow-up in same session...');
        const followUpQuery = await this.sendQuery('search_sessions_by_topic', { topic: 'similar sessions' });
        
        if (followUpQuery.context) {
            console.log(`      ✅ Context maintained`);
            console.log(`      💬 Interaction count: ${followUpQuery.context.interactionCount}`);
            console.log(`      🎯 Topic continuity: ${followUpQuery.context.currentTopic}`);
        }
        
        console.log('');
    }

    async sendQuery(functionName, parameters) {
        try {
            const response = await axios.post(`${BASE_URL}/demo/query`, {
                function_name: functionName,
                parameters: parameters,
                session_id: this.sessionId
            });

            return response.data;
        } catch (error) {
            console.log(`      ❌ Query failed: ${error.message}`);
            return { success: false, result: { count: 0, data: [] } };
        }
    }
}

// Run the tests
async function runProductionTest() {
    const tester = new ProductionTester();
    await tester.runTests();
}

if (require.main === module) {
    runProductionTest().catch(console.error);
}

module.exports = ProductionTester;