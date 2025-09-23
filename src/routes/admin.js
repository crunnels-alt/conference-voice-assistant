const express = require('express');
const router = express.Router();

class AdminRoutes {
    constructor(databaseManager, leadDevScraper) {
        this.databaseManager = databaseManager;
        this.leadDevScraper = leadDevScraper;
        this.lastScrapeTime = null;
        this.scrapeInProgress = false;
        
        // Auto-refresh setup
        if (process.env.AUTO_SCRAPE === 'true') {
            this.setupAutoRefresh();
        }
    }

    setupAutoRefresh() {
        const isConferenceDay = this.isConferenceDay();
        const interval = isConferenceDay ? 
            (process.env.SCRAPE_INTERVAL_LIVE || 3600) * 1000 :  // 1 hour on conference day
            (process.env.SCRAPE_INTERVAL || 14400) * 1000;       // 4 hours normally
        
        console.log(`🔄 Auto-refresh enabled: every ${interval/1000/60} minutes`);
        
        // Initial scrape on startup (after 30 seconds)
        setTimeout(() => this.performScrape(), 30000);
        
        // Recurring scrapes
        setInterval(() => this.performScrape(), interval);
    }

    isConferenceDay() {
        // LeadDev New York is October 15-16, 2025
        const conferenceDates = [
            process.env.CONFERENCE_DATE || '2025-10-15',
            process.env.CONFERENCE_DATE_2 || '2025-10-16'
        ];
        const today = new Date().toISOString().split('T')[0];
        return conferenceDates.includes(today);
    }

    async performScrape() {
        if (this.scrapeInProgress) {
            console.log('⏳ Scrape already in progress, skipping...');
            return;
        }

        try {
            this.scrapeInProgress = true;
            console.log('🔄 Starting automatic conference data refresh...');
            
            // Get current session count
            const beforeCount = await this.getCurrentSessionCount();
            
            // Scrape new data
            const sessions = await this.leadDevScraper.scrapeConferenceData();
            
            // Get new session count
            const afterCount = await this.getCurrentSessionCount();
            
            this.lastScrapeTime = new Date();
            
            console.log(`✅ Auto-refresh completed: ${beforeCount} → ${afterCount} sessions`);
            
            // Log significant changes
            if (Math.abs(afterCount - beforeCount) > beforeCount * 0.1) {
                console.log(`⚠️  Significant change detected: ${Math.abs(afterCount - beforeCount)} sessions changed`);
            }
            
        } catch (error) {
            console.error('❌ Auto-refresh failed:', error.message);
        } finally {
            this.scrapeInProgress = false;
        }
    }

    async getCurrentSessionCount() {
        try {
            const result = await this.databaseManager.getQuery('SELECT COUNT(*) as count FROM sessions');
            return result.count || 0;
        } catch (error) {
            return 0;
        }
    }

    setupRoutes() {
        // Manual refresh endpoint
        router.post('/refresh-data', async (req, res) => {
            try {
                if (this.scrapeInProgress) {
                    return res.status(429).json({
                        success: false,
                        message: 'Refresh already in progress',
                        lastScrapeTime: this.lastScrapeTime
                    });
                }

                console.log('🔄 Manual refresh triggered');
                await this.performScrape();

                res.json({
                    success: true,
                    message: 'Conference data refreshed successfully',
                    lastScrapeTime: this.lastScrapeTime,
                    sessionsCount: await this.getCurrentSessionCount()
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    message: 'Refresh failed',
                    error: error.message
                });
            }
        });

        // Data status endpoint
        router.get('/data-status', async (req, res) => {
            try {
                const sessionsCount = await this.getCurrentSessionCount();
                const isStale = this.lastScrapeTime && 
                    (Date.now() - this.lastScrapeTime.getTime()) > 2 * 60 * 60 * 1000; // 2 hours

                res.json({
                    success: true,
                    lastScrapeTime: this.lastScrapeTime,
                    sessionsCount,
                    scrapeInProgress: this.scrapeInProgress,
                    isStale,
                    autoRefreshEnabled: process.env.AUTO_SCRAPE === 'true',
                    conferenceDates: [
                        process.env.CONFERENCE_DATE || '2025-10-15',
                        process.env.CONFERENCE_DATE_2 || '2025-10-16'
                    ],
                    isConferenceDay: this.isConferenceDay()
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Force emergency refresh (with auth check)
        router.post('/emergency-refresh', async (req, res) => {
            const authKey = req.headers.authorization || req.query.key;
            const expectedKey = process.env.ADMIN_KEY;

            if (expectedKey && authKey !== `Bearer ${expectedKey}`) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }

            try {
                console.log('🚨 Emergency refresh triggered');
                await this.performScrape();

                res.json({
                    success: true,
                    message: 'Emergency refresh completed',
                    lastScrapeTime: this.lastScrapeTime
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        return router;
    }
}

module.exports = AdminRoutes;