#!/usr/bin/env node

require('dotenv').config();
const DatabaseManager = require('../src/database/databaseManager');
const LeadDevScraper = require('../src/database/leaddevScraper');

async function testScraper() {
    console.log('Testing LeadDev scraper...\n');
    
    try {
        // Initialize database
        const databaseManager = new DatabaseManager();
        await databaseManager.initialize();
        console.log('Database initialized successfully\n');
        
        // Create and test scraper
        const scraper = new LeadDevScraper(databaseManager);
        
        console.log('Starting scraping process...');
        const sessions = await scraper.scrapeAndSave();
        
        console.log(`\n✅ Scraping completed successfully!`);
        console.log(`📊 Found ${sessions.length} sessions`);
        
        // Display first few sessions for verification
        if (sessions.length > 0) {
            console.log('\n📋 Sample sessions found:');
            sessions.slice(0, 3).forEach((session, index) => {
                console.log(`\n${index + 1}. ${session.title}`);
                if (session.description) {
                    console.log(`   Description: ${session.description.substring(0, 100)}...`);
                }
                if (session.speaker) {
                    console.log(`   Speaker: ${session.speaker.name}`);
                }
                console.log(`   Type: ${session.sessionType}`);
            });
        }
        
        // Test database queries
        console.log('\n🔍 Testing database queries...');
        const allSessions = await databaseManager.getAllSessions();
        console.log(`Database contains ${allSessions.length} total sessions`);
        
        const upcomingSessions = await databaseManager.getUpcomingSessions(3);
        console.log(`Found ${upcomingSessions.length} upcoming sessions`);
        
        databaseManager.close();
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test if this script is called directly
if (require.main === module) {
    testScraper();
}

module.exports = testScraper;