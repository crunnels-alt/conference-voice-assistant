#!/usr/bin/env node

/**
 * OpenAI API Setup and Testing Script
 * This script helps you set up and test OpenAI integration
 */

require('dotenv').config();
const OpenAI = require('openai');
const RealtimeFunctions = require('../src/nlp/realtimeFunctions');
const DatabaseManager = require('../src/database/databaseManager');

class OpenAISetup {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.openai = null;
    }

    async runSetup() {
        console.log('🔧 OpenAI API Setup and Testing\n');

        // Step 1: Check API Key
        if (!this.checkAPIKey()) {
            this.showSetupInstructions();
            return;
        }

        // Step 2: Test API Connection
        if (!(await this.testConnection())) {
            return;
        }

        // Step 3: Test Function Calling
        if (!(await this.testFunctionCalling())) {
            return;
        }

        // Step 4: Test Conference Assistant Functions
        await this.testConferenceAssistant();

        console.log('\n🎉 OpenAI integration is working perfectly!');
        console.log('\n📋 Next Steps:');
        console.log('1. Set up Infobip Voice API account');
        console.log('2. Configure SIP integration with OpenAI Realtime API');
        console.log('3. Test end-to-end voice calling');
    }

    checkAPIKey() {
        if (!this.apiKey) {
            console.log('❌ OpenAI API key not found');
            return false;
        }

        if (!this.apiKey.startsWith('sk-')) {
            console.log('❌ Invalid OpenAI API key format');
            return false;
        }

        console.log('✅ OpenAI API key found');
        this.openai = new OpenAI({ apiKey: this.apiKey });
        return true;
    }

    showSetupInstructions() {
        console.log('\n📝 OpenAI API Setup Instructions:');
        console.log('');
        console.log('1. Go to https://platform.openai.com/api-keys');
        console.log('2. Sign in or create an OpenAI account');
        console.log('3. Click "Create new secret key"');
        console.log('4. Copy the key (starts with sk-)');
        console.log('5. Add to your .env file:');
        console.log('   OPENAI_API_KEY=sk-your_key_here');
        console.log('');
        console.log('💰 Pricing for this demo:');
        console.log('   - GPT-4o-mini: ~$0.15 per 1K tokens');
        console.log('   - Realtime API: ~$0.06 per minute');
        console.log('   - Estimated demo cost: $5-20 total');
    }

    async testConnection() {
        console.log('\n🔗 Testing OpenAI API connection...');
        
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "user", content: "Say 'Hello from OpenAI!' if you can hear me." }
                ],
                max_tokens: 20
            });

            const message = response.choices[0].message.content;
            console.log(`   ✅ Connection successful: "${message}"`);
            return true;

        } catch (error) {
            console.log(`   ❌ Connection failed: ${error.message}`);
            
            if (error.code === 'insufficient_quota') {
                console.log('   💳 Add billing to your OpenAI account to continue');
            } else if (error.code === 'invalid_api_key') {
                console.log('   🔑 Check your API key in .env file');
            }
            
            return false;
        }
    }

    async testFunctionCalling() {
        console.log('\n⚙️ Testing function calling...');

        const testFunction = {
            name: "get_test_info",
            description: "Get test information for the conference assistant",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Test query parameter"
                    }
                },
                required: ["query"]
            }
        };

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "user", content: "Please call the test function with query 'hello world'" }
                ],
                functions: [testFunction],
                function_call: { name: "get_test_info" }
            });

            const functionCall = response.choices[0].message.function_call;
            if (functionCall && functionCall.name === 'get_test_info') {
                const args = JSON.parse(functionCall.arguments);
                console.log(`   ✅ Function calling works: ${JSON.stringify(args)}`);
                return true;
            } else {
                console.log('   ❌ Function calling failed - no function call returned');
                return false;
            }

        } catch (error) {
            console.log(`   ❌ Function calling failed: ${error.message}`);
            return false;
        }
    }

    async testConferenceAssistant() {
        console.log('\n🎤 Testing conference assistant functions...');

        try {
            // Initialize database and functions
            const dbManager = new DatabaseManager();
            await dbManager.initialize();
            
            const functions = new RealtimeFunctions(dbManager);
            const functionDefs = functions.getFunctionDefinitions();

            console.log(`   📋 Loaded ${functionDefs.length} conference functions`);

            // Test a real conference query
            const testQuery = "What sessions are about AI and machine learning?";
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "You are a conference assistant. Use the available functions to answer questions about sessions, speakers, and schedule." 
                    },
                    { role: "user", content: testQuery }
                ],
                functions: functionDefs.slice(0, 3), // Test with first 3 functions
                temperature: 0.1
            });

            const message = response.choices[0].message;
            
            if (message.function_call) {
                const functionName = message.function_call.name;
                const parameters = JSON.parse(message.function_call.arguments);
                
                console.log(`   🔧 OpenAI wants to call: ${functionName}`);
                console.log(`   📥 Parameters: ${JSON.stringify(parameters)}`);

                // Actually execute the function
                const result = await functions.executeFunction(functionName, parameters);
                console.log(`   📤 Result: Found ${result.count} sessions`);
                
                if (result.data && result.data.length > 0) {
                    const sample = result.data[0];
                    console.log(`   📅 Sample: "${sample.title}" by ${sample.speaker?.name || 'TBD'}`);
                }

                console.log('   ✅ Conference assistant integration working!');
            } else {
                console.log('   ℹ️  OpenAI responded with text:', message.content);
            }

            dbManager.close();

        } catch (error) {
            console.log(`   ❌ Conference assistant test failed: ${error.message}`);
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new OpenAISetup();
    setup.runSetup().catch(console.error);
}

module.exports = OpenAISetup;