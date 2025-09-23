#!/usr/bin/env node

/**
 * Infobip Voice API Setup Guide
 * This script guides you through Infobip setup and configuration
 */

require('dotenv').config();

class InfobipSetup {
    constructor() {
        this.apiKey = process.env.INFOBIP_API_KEY;
        this.baseUrl = process.env.INFOBIP_BASE_URL;
        this.applicationId = process.env.INFOBIP_APPLICATION_ID;
        this.webhookUrl = process.env.WEBHOOK_BASE_URL;
    }

    async runSetup() {
        console.log('📞 Infobip Voice API Setup Guide\n');

        // Step 1: Check configuration
        this.checkConfiguration();

        // Step 2: Show setup instructions
        if (!this.isConfigured()) {
            this.showSetupInstructions();
            return;
        }

        // Step 3: Test API connection (if configured)
        await this.testConnection();

        // Step 4: Show SIP integration guide
        this.showSIPIntegration();

        console.log('\n📋 Next Steps:');
        console.log('1. Test the webhook endpoints with ngrok');
        console.log('2. Configure OpenAI Realtime API SIP integration');
        console.log('3. Make a test phone call to verify end-to-end flow');
    }

    checkConfiguration() {
        console.log('🔍 Checking Infobip configuration...\n');

        const checks = [
            { name: 'API Key', value: this.apiKey, required: true },
            { name: 'Base URL', value: this.baseUrl, required: true },
            { name: 'Application ID', value: this.applicationId, required: true },
            { name: 'Webhook URL', value: this.webhookUrl, required: true }
        ];

        checks.forEach(check => {
            if (check.value) {
                console.log(`   ✅ ${check.name}: ${this.maskSensitive(check.value)}`);
            } else {
                console.log(`   ${check.required ? '❌' : '⚠️'} ${check.name}: Not configured`);
            }
        });
    }

    maskSensitive(value) {
        if (value.includes('api.infobip.com')) {
            return value; // URLs are not sensitive
        }
        if (value.startsWith('http')) {
            return value; // Webhook URLs are not sensitive
        }
        // Mask API keys and IDs
        return value.substring(0, 8) + '...' + value.substring(value.length - 4);
    }

    isConfigured() {
        return this.apiKey && this.baseUrl && this.applicationId && this.webhookUrl;
    }

    showSetupInstructions() {
        console.log('\n📝 Infobip Setup Instructions:\n');
        
        console.log('🔐 1. Create Infobip Account:');
        console.log('   • Go to https://portal.infobip.com/');
        console.log('   • Sign up for a free trial account');
        console.log('   • Verify your email and phone number\n');

        console.log('🔑 2. Get API Credentials:');
        console.log('   • In Infobip Portal, go to "Account" → "API keys"');
        console.log('   • Generate a new API key with Voice permissions');
        console.log('   • Copy the API key and base URL\n');

        console.log('📱 3. Set up Voice Application:');
        console.log('   • Go to "Voice & Video" → "Applications"');
        console.log('   • Create a new Voice application');
        console.log('   • Copy the Application ID\n');

        console.log('📞 4. Get a Phone Number:');
        console.log('   • Go to "Numbers" → "Buy Numbers"');
        console.log('   • Purchase a phone number for your demo');
        console.log('   • Assign it to your Voice application\n');

        console.log('🌐 5. Configure Webhooks:');
        console.log('   • Set up ngrok: npm install -g ngrok');
        console.log('   • Run: ngrok http 3000');
        console.log('   • Copy the https URL (e.g., https://abc123.ngrok.io)');
        console.log('   • In Voice app settings, set webhook URL to:');
        console.log('     https://your-ngrok-url.ngrok.io/webhook/voice/inbound\n');

        console.log('📄 6. Update .env file:');
        console.log('   INFOBIP_API_KEY=your_api_key_here');
        console.log('   INFOBIP_BASE_URL=https://your_region.api.infobip.com');
        console.log('   INFOBIP_APPLICATION_ID=your_app_id_here');
        console.log('   WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io\n');

        console.log('💰 Pricing Estimates:');
        console.log('   • Trial credits: Usually $2-10 free');
        console.log('   • Voice calls: ~$0.01-0.20 per minute');
        console.log('   • Phone number: ~$1-5 per month');
        console.log('   • Demo cost: ~$10-30 total\n');
    }

    async testConnection() {
        console.log('\n🔗 Testing Infobip API connection...');

        if (!this.apiKey || !this.baseUrl) {
            console.log('   ⚠️ API credentials not configured, skipping connection test');
            return;
        }

        try {
            const axios = require('axios');
            
            const response = await axios.get(`${this.baseUrl}/numbers/1/numbers`, {
                headers: {
                    'Authorization': `App ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                console.log('   ✅ API connection successful');
                
                if (response.data.results && response.data.results.length > 0) {
                    console.log(`   📱 Found ${response.data.results.length} phone number(s)`);
                    response.data.results.forEach(number => {
                        console.log(`      • ${number.phoneNumber} (${number.type})`);
                    });
                } else {
                    console.log('   ⚠️ No phone numbers found - you may need to purchase one');
                }
            }

        } catch (error) {
            if (error.response) {
                console.log(`   ❌ API connection failed: ${error.response.status} ${error.response.statusText}`);
                if (error.response.status === 401) {
                    console.log('   🔑 Check your API key - it may be incorrect');
                }
            } else {
                console.log(`   ❌ Connection failed: ${error.message}`);
            }
        }
    }

    showSIPIntegration() {
        console.log('\n🔗 OpenAI Realtime + SIP Integration:\n');

        console.log('📋 Integration Overview:');
        console.log('   Phone Call → Infobip → SIP → OpenAI Realtime API → Your Functions\n');

        console.log('⚙️ SIP Configuration:');
        console.log('   1. OpenAI Realtime API provides a SIP endpoint');
        console.log('   2. Infobip connects calls via SIP to OpenAI');
        console.log('   3. OpenAI handles speech-to-text and text-to-speech');
        console.log('   4. OpenAI calls your webhook functions for conference data');
        console.log('   5. Responses are spoken back to the caller\n');

        console.log('🔧 Required Configuration:');
        console.log('   • OpenAI Realtime API access (currently in beta)');
        console.log('   • SIP-compatible Infobip Voice plan');
        console.log('   • Function webhook endpoints (already implemented)');
        console.log('   • Public webhook URL (ngrok or deployment)\n');

        console.log('📞 Call Flow:');
        console.log('   1. User dials your Infobip number');
        console.log('   2. Infobip webhook calls /webhook/voice/inbound');
        console.log('   3. Your app returns SIP connection to OpenAI');
        console.log('   4. OpenAI handles the conversation');
        console.log('   5. OpenAI calls your functions for conference data');
        console.log('   6. Results are spoken back to user\n');

        if (this.webhookUrl) {
            console.log('🌐 Your webhook endpoints:');
            console.log(`   • Inbound calls: ${this.webhookUrl}/webhook/voice/inbound`);
            console.log(`   • Function calls: ${this.webhookUrl}/webhook/openai/function-call`);
            console.log(`   • Call status: ${this.webhookUrl}/webhook/voice/hangup`);
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new InfobipSetup();
    setup.runSetup().catch(console.error);
}

module.exports = InfobipSetup;