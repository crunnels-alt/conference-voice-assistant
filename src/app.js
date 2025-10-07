require('dotenv').config();
const express = require('express');
const VoiceHandler = require('./voice/voiceHandler');
const DatabaseManager = require('./database/databaseManager');
const PostgreSQLDatabaseManager = require('./database/pgDatabaseManager');
const AdminRoutes = require('./routes/admin');
const LeadDevScraper = require('./database/leaddevScraper');
// NLPProcessor not needed - using OpenAI Realtime API instead

class ConferenceVoiceAssistant {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Initialize components - try PostgreSQL first, fallback to SQLite
        this.databaseManager = null;
        
        this.leadDevScraper = new LeadDevScraper(this.databaseManager);
        this.voiceHandler = new VoiceHandler(null, this.databaseManager);
        
        // Initialize admin routes for data refresh
        this.adminRoutes = new AdminRoutes(this.databaseManager, this.leadDevScraper);
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // OpenAI Realtime API webhook (receives realtime.call.incoming events)
        this.app.post('/webhook/openai/realtime', this.voiceHandler.handleIncomingCall.bind(this.voiceHandler));

        // Legacy endpoints (keeping for backward compatibility during transition)
        this.app.post('/webhook/voice/inbound', this.voiceHandler.handleIncomingCall.bind(this.voiceHandler));

        // Demo endpoints for testing
        this.app.post('/demo/query', this.voiceHandler.handleTextQuery.bind(this.voiceHandler));
        this.app.get('/demo/sessions', async (req, res) => {
            try {
                const sessions = await this.databaseManager.getAllSessions();
                res.json(sessions);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Admin routes for data management
        this.app.use('/admin', this.adminRoutes.setupRoutes());

        // Analytics endpoint
        this.app.get('/analytics', this.voiceHandler.getAnalytics.bind(this.voiceHandler));
    }

    async initialize() {
        try {
            // Try PostgreSQL first if DATABASE_URL is available
            if (process.env.DATABASE_URL) {
                try {
                    console.log('Attempting PostgreSQL connection...');
                    this.databaseManager = new PostgreSQLDatabaseManager();
                    await this.databaseManager.initialize();
                    console.log('✅ PostgreSQL database initialized successfully');
                } catch (pgError) {
                    console.log('❌ PostgreSQL connection failed, falling back to SQLite');
                    console.log('PostgreSQL error:', pgError.message);
                    this.databaseManager = new DatabaseManager();
                    await this.databaseManager.initialize();
                    console.log('✅ SQLite database initialized successfully');
                }
            } else {
                // Use SQLite directly
                this.databaseManager = new DatabaseManager();
                await this.databaseManager.initialize();
                console.log('✅ SQLite database initialized successfully');
            }
            
            // Re-initialize components that depend on database manager
            this.leadDevScraper = new LeadDevScraper(this.databaseManager);
            this.voiceHandler = new VoiceHandler(null, this.databaseManager);
            this.adminRoutes = new AdminRoutes(this.databaseManager, this.leadDevScraper);

            // NOW initialize auto-refresh (after database and scraper are ready)
            this.adminRoutes.initializeAutoRefresh();

            this.app.listen(this.port, () => {
                console.log(`Conference Voice Assistant running on port ${this.port}`);
                console.log(`Webhook URL: ${process.env.WEBHOOK_BASE_URL || 'http://localhost:' + this.port}`);
            });
        } catch (error) {
            console.error('Failed to initialize application:', error);
            process.exit(1);
        }
    }
}

// Start the application
if (require.main === module) {
    const app = new ConferenceVoiceAssistant();
    app.initialize();
}

module.exports = ConferenceVoiceAssistant;