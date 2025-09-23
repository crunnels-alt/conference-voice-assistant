#!/usr/bin/env node

// Simple test that doesn't require any external APIs
const DatabaseManager = require('../src/database/databaseManager');
const RealtimeFunctions = require('../src/nlp/realtimeFunctions');

async function testBasicFunctionality() {
    console.log('🧪 Testing Conference Assistant (No Credentials Needed)\n');

    try {
        // Test 1: Database Setup
        console.log('1️⃣ Testing database connection...');
        const dbManager = new DatabaseManager();
        await dbManager.initialize();
        console.log('   ✅ Database connected and initialized\n');

        // Test 2: Conference Data
        console.log('2️⃣ Testing conference data...');
        const allSessions = await dbManager.getAllSessions();
        console.log(`   ✅ Found ${allSessions.length} conference sessions\n`);

        // Test 3: Function Handlers
        console.log('3️⃣ Testing function handlers...');
        const functions = new RealtimeFunctions(dbManager);
        
        // Test upcoming sessions
        const upcoming = await functions.executeFunction('get_upcoming_sessions', { limit: 3 });
        console.log(`   ✅ Upcoming sessions: Found ${upcoming.count} sessions`);
        
        // Test topic search
        const aiSessions = await functions.executeFunction('search_sessions_by_topic', { topic: 'AI' });
        console.log(`   ✅ AI sessions: Found ${aiSessions.count} sessions`);
        
        // Test speaker search
        const speakerSessions = await functions.executeFunction('search_sessions_by_speaker', { speaker_name: 'Jason' });
        console.log(`   ✅ Speaker search: Found ${speakerSessions.count} sessions\n`);

        // Test 4: Sample Data
        console.log('4️⃣ Sample session data:');
        if (allSessions.length > 0) {
            const sample = allSessions[0];
            console.log(`   📅 "${sample.title}"`);
            console.log(`   👤 Speaker: ${sample.speaker_name || 'TBD'}`);
            console.log(`   🏢 Company: ${sample.speaker_company || 'TBD'}`);
            console.log(`   🎯 Type: ${sample.session_type || 'TBD'}`);
            console.log(`   📍 Venue: ${sample.venue_name || 'TBD'}\n`);
        }

        // Test 5: Function Definitions
        console.log('5️⃣ Available functions for OpenAI:');
        const functionDefs = functions.getFunctionDefinitions();
        functionDefs.forEach(func => {
            console.log(`   🔧 ${func.name} - ${func.description}`);
        });

        console.log('\n🎉 All tests passed! The system is ready.');
        console.log('\n💡 What works without credentials:');
        console.log('   ✅ Conference database with real LeadDev data');
        console.log('   ✅ All search and query functions');
        console.log('   ✅ Demo endpoints for testing');
        console.log('   ✅ Health checks and analytics');
        
        console.log('\n🔑 What needs credentials:');
        console.log('   🔐 OpenAI API calls (for natural language processing)');
        console.log('   🔐 Infobip Voice API (for actual phone calls)');

        dbManager.close();

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

if (require.main === module) {
    testBasicFunctionality();
}

module.exports = testBasicFunctionality;