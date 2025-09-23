#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

class ConferenceAssistantDemo {
    constructor() {
        this.baseUrl = BASE_URL;
    }

    async runDemo() {
        console.log('🎤 Conference Voice Assistant Demo\n');
        console.log(`Testing endpoint: ${this.baseUrl}\n`);

        // Test different query types
        const testQueries = [
            {
                name: "Current Sessions",
                function_name: "get_current_sessions"
            },
            {
                name: "Upcoming Sessions", 
                function_name: "get_upcoming_sessions",
                parameters: { limit: 3 }
            },
            {
                name: "AI Sessions",
                function_name: "search_sessions_by_topic",
                parameters: { topic: "AI" }
            },
            {
                name: "Jason Lengstorf Sessions",
                function_name: "search_sessions_by_speaker", 
                parameters: { speaker_name: "Jason Lengstorf" }
            },
            {
                name: "Demo Stage Sessions",
                function_name: "search_sessions_by_type",
                parameters: { session_type: "demo" }
            },
            {
                name: "Leadership Sessions",
                function_name: "search_sessions_by_topic",
                parameters: { topic: "leadership" }
            }
        ];

        for (const query of testQueries) {
            await this.testQuery(query);
            await this.sleep(1000); // Wait 1 second between queries
        }

        // Test natural language queries
        console.log('\n🤖 Testing Natural Language Queries:\n');
        
        const nlQueries = [
            "What's happening right now?",
            "Tell me about upcoming sessions",
            "Find sessions about artificial intelligence", 
            "Who is speaking about leadership?",
            "Show me the full schedule"
        ];

        for (const query of nlQueries) {
            await this.testNaturalLanguage(query);
            await this.sleep(1000);
        }

        // Show analytics
        await this.showAnalytics();
    }

    async testQuery(query) {
        try {
            console.log(`🔍 Testing: ${query.name}`);
            
            const response = await axios.post(`${this.baseUrl}/demo/query`, {
                function_name: query.function_name,
                parameters: query.parameters
            });

            if (response.data.success) {
                const result = response.data.result;
                console.log(`   ✅ Found ${result.count} result(s)`);
                
                if (result.data && result.data.length > 0) {
                    result.data.slice(0, 2).forEach(item => {
                        console.log(`   📅 "${item.title}" ${item.speaker?.name ? `by ${item.speaker.name}` : ''} at ${item.formatted_time || 'TBD'}`);
                    });
                }
                
                if (result.message) {
                    console.log(`   💬 ${result.message}`);
                }
            } else {
                console.log(`   ❌ Error: ${response.data.error}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
        }
        
        console.log('');
    }

    async testNaturalLanguage(query) {
        try {
            console.log(`💭 "${query}"`);
            
            const response = await axios.post(`${this.baseUrl}/demo/query`, {
                query: query
            });

            if (response.data.success) {
                const result = response.data.result;
                console.log(`   ✅ Found ${result.count || 0} result(s)`);
                if (result.message) {
                    console.log(`   💬 ${result.message}`);
                }
            } else {
                console.log(`   ❌ Error: ${response.data.error}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
        }
        
        console.log('');
    }

    async showAnalytics() {
        try {
            console.log('📊 System Analytics:\n');
            
            const response = await axios.get(`${this.baseUrl}/analytics`);
            const analytics = response.data;
            
            console.log(`   Active Sessions: ${analytics.activeSessions}`);
            console.log(`   Total Conference Sessions: ${analytics.totalSessions}`);
            console.log(`   Database: ${analytics.systemHealth.database}`);
            console.log(`   OpenAI: ${analytics.systemHealth.openai}`);
            console.log(`   Infobip: ${analytics.systemHealth.infobip}`);
            
        } catch (error) {
            console.log(`   ❌ Analytics failed: ${error.message}`);
        }
        
        console.log('');
    }

    async checkHealth() {
        try {
            console.log('🏥 Health Check:\n');
            
            const response = await axios.get(`${this.baseUrl}/health`);
            console.log(`   ✅ Server is healthy`);
            console.log(`   Timestamp: ${response.data.timestamp}`);
            
            return true;
        } catch (error) {
            console.log(`   ❌ Health check failed: ${error.message}`);
            return false;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the demo
async function runDemo() {
    const demo = new ConferenceAssistantDemo();
    
    // Check if server is running
    const isHealthy = await demo.checkHealth();
    if (!isHealthy) {
        console.log('\n❌ Server is not running. Please start the server first:');
        console.log('   npm start');
        return;
    }
    
    console.log('');
    await demo.runDemo();
    
    console.log('🎉 Demo completed!');
    console.log('\nTo test with voice:');
    console.log('1. Configure your Infobip Voice API webhook to point to this server');
    console.log('2. Set up OpenAI Realtime API SIP integration'); 
    console.log('3. Make a phone call to your Infobip number');
}

if (require.main === module) {
    runDemo().catch(console.error);
}

module.exports = ConferenceAssistantDemo;