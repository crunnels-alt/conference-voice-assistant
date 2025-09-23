const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { format, parseISO, isAfter, isBefore, addHours } = require('date-fns');

class DatabaseManager {
    constructor() {
        this.dbPath = process.env.DATABASE_PATH || './data/conference.db';
        this.db = null;
    }

    async initialize() {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const queries = this.isPostgres ? this.getPostgreSQLQueries() : this.getSQLiteQueries();

        for (const query of queries) {
            await this.runQuery(query);
        }

        // Check if we need to populate with sample data
        const sessionCount = await this.getQuery('SELECT COUNT(*) as count FROM sessions');
        if (sessionCount.count === 0) {
            await this.populateSampleData();
        }
    }

    getPostgreSQLQueries() {
        return [
            // Speakers table - PostgreSQL version
            `CREATE TABLE IF NOT EXISTS speakers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT,
                company TEXT,
                bio TEXT,
                profile_url TEXT,
                github_url TEXT,
                linkedin_url TEXT,
                twitter_url TEXT,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Session types (TALK, DEMO STAGE, SOLUTION SWAP, etc.)
            `CREATE TABLE IF NOT EXISTS session_types (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Topics/Categories 
            `CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Suitability levels (EXPERIENCED MANAGER, NEW MANAGER, TECH LEAD)
            `CREATE TABLE IF NOT EXISTS suitability_levels (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Companies/Sponsors
            `CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                booth_location TEXT,
                website TEXT,
                logo_url TEXT,
                is_sponsor BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Venues/Rooms
            `CREATE TABLE IF NOT EXISTS venues (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                capacity INTEGER,
                location_description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Sessions table - enhanced for LeadDev structure
            `CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP NOT NULL,
                venue_id INTEGER REFERENCES venues(id),
                speaker_id INTEGER REFERENCES speakers(id),
                session_type_id INTEGER REFERENCES session_types(id),
                topic_id INTEGER REFERENCES topics(id),
                sponsor_company_id INTEGER REFERENCES companies(id),
                is_sponsored BOOLEAN DEFAULT false,
                max_attendees INTEGER,
                registration_required BOOLEAN DEFAULT false,
                session_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Junction table for session suitability (many-to-many)
            `CREATE TABLE IF NOT EXISTS session_suitability (
                session_id INTEGER,
                suitability_level_id INTEGER,
                PRIMARY KEY (session_id, suitability_level_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (suitability_level_id) REFERENCES suitability_levels(id)
            )`,
            
            // Junction table for session topics (many-to-many) - sessions can have multiple topics
            `CREATE TABLE IF NOT EXISTS session_topics (
                session_id INTEGER,
                topic_id INTEGER,
                PRIMARY KEY (session_id, topic_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics(id)
            )`
        ];
    }

    getSQLiteQueries() {
        return [
            // SQLite versions with AUTOINCREMENT
            `CREATE TABLE IF NOT EXISTS speakers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                title TEXT,
                company TEXT,
                bio TEXT,
                profile_url TEXT,
                github_url TEXT,
                linkedin_url TEXT,
                twitter_url TEXT,
                image_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS session_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS topics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS suitability_levels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                booth_location TEXT,
                website TEXT,
                logo_url TEXT,
                is_sponsor BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS venues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                capacity INTEGER,
                location_description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                venue_id INTEGER,
                speaker_id INTEGER,
                session_type_id INTEGER,
                topic_id INTEGER,
                sponsor_company_id INTEGER,
                is_sponsored BOOLEAN DEFAULT 0,
                max_attendees INTEGER,
                registration_required BOOLEAN DEFAULT 0,
                session_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (venue_id) REFERENCES venues(id),
                FOREIGN KEY (speaker_id) REFERENCES speakers(id),
                FOREIGN KEY (session_type_id) REFERENCES session_types(id),
                FOREIGN KEY (topic_id) REFERENCES topics(id),
                FOREIGN KEY (sponsor_company_id) REFERENCES companies(id)
            )`,
            `CREATE TABLE IF NOT EXISTS session_suitability (
                session_id INTEGER,
                suitability_level_id INTEGER,
                PRIMARY KEY (session_id, suitability_level_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (suitability_level_id) REFERENCES suitability_levels(id)
            )`,
            `CREATE TABLE IF NOT EXISTS session_topics (
                session_id INTEGER,
                topic_id INTEGER,
                PRIMARY KEY (session_id, topic_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (topic_id) REFERENCES topics(id)
            )`
        ];
    }

    async populateSampleData() {
        console.log('Populating database with sample LeadDev-style conference data...');

        // Insert session types
        const sessionTypes = [
            { name: 'TALK', description: 'Standard conference presentation' },
            { name: 'DEMO STAGE', description: 'Live demonstration or product showcase' },
            { name: 'SOLUTION SWAP', description: 'Interactive problem-solving session' },
            { name: 'WORKSHOP', description: 'Hands-on learning session' },
            { name: 'PANEL', description: 'Panel discussion with multiple speakers' }
        ];

        for (const type of sessionTypes) {
            await this.runQuery('INSERT OR IGNORE INTO session_types (name, description) VALUES (?, ?)', [type.name, type.description]);
        }

        // Insert suitability levels
        const suitabilityLevels = [
            { name: 'EXPERIENCED MANAGER', description: 'For seasoned engineering managers' },
            { name: 'NEW MANAGER', description: 'For new or aspiring engineering managers' },
            { name: 'TECH LEAD', description: 'For technical leads and senior individual contributors' },
            { name: 'SENIOR ENGINEER', description: 'For senior engineering professionals' }
        ];

        for (const level of suitabilityLevels) {
            await this.runQuery('INSERT OR IGNORE INTO suitability_levels (name, description) VALUES (?, ?)', [level.name, level.description]);
        }

        // Insert topics based on LeadDev categories
        const topics = [
            { name: 'Management', description: 'Engineering management practices and strategies' },
            { name: 'Leadership', description: 'Leadership skills and development' },
            { name: 'Software quality', description: 'Code quality, testing, and best practices' },
            { name: 'Communication', description: 'Team communication and collaboration' },
            { name: 'Culture', description: 'Team culture and organizational development' },
            { name: 'Hiring', description: 'Recruitment and talent acquisition' },
            { name: 'Velocity', description: 'Development speed and efficiency' },
            { name: 'Career development', description: 'Professional growth and career paths' },
            { name: 'Reporting', description: 'Metrics, reporting, and data-driven decisions' },
            { name: 'Technical direction', description: 'Technical strategy and architecture' },
            { name: 'AI', description: 'Artificial intelligence and machine learning' }
        ];

        for (const topic of topics) {
            await this.runQuery('INSERT OR IGNORE INTO topics (name, description) VALUES (?, ?)', [topic.name, topic.description]);
        }

        // Insert companies (including sponsors from the screenshots)
        const companies = [
            { name: 'CircleCI', description: 'Continuous integration and deployment platform', is_sponsor: 1, website: 'https://circleci.com' },
            { name: 'CodeTV', description: 'Developer-focused content platform', is_sponsor: 0, website: 'https://codetv.com' },
            { name: 'Frank & Eddy Leadership', description: 'Leadership coaching and development', is_sponsor: 0, website: 'https://frankeddy.com' },
            { name: 'Walmart Global Tech', description: 'Technology division of Walmart', is_sponsor: 0, website: 'https://tech.walmart.com' },
            { name: 'TechCorp Solutions', description: 'Enterprise technology solutions', is_sponsor: 0, website: 'https://techcorp.com' }
        ];

        for (const company of companies) {
            await this.runQuery('INSERT OR IGNORE INTO companies (name, description, is_sponsor, website) VALUES (?, ?, ?, ?)', 
                [company.name, company.description, company.is_sponsor, company.website]);
        }

        // Insert venues
        const venues = [
            { name: 'Main Stage', capacity: 500, location_description: 'Primary auditorium' },
            { name: 'Demo Stage', capacity: 150, location_description: 'Interactive demo area' },
            { name: 'Solution Swap Room', capacity: 50, location_description: 'Intimate discussion space' },
            { name: 'Workshop Hall', capacity: 100, location_description: 'Hands-on learning space' },
            { name: 'Networking Lounge', capacity: 200, location_description: 'Casual meeting area' }
        ];

        for (const venue of venues) {
            await this.runQuery('INSERT INTO venues (name, capacity, location_description) VALUES (?, ?, ?)', 
                [venue.name, venue.capacity, venue.location_description]);
        }

        // Insert speakers based on the screenshots
        const speakers = [
            { 
                name: 'Jason Lengstorf', 
                title: 'Creator', 
                company: 'CodeTV', 
                bio: 'Jason makes tv for developers at CodeTV. He believes that a career in tech is more successful, rewarding, and sustainable when it\'s built on fun, curiosity, and community.',
                profile_url: 'https://leaddev.com/speakers/jason-lengstorf'
            },
            { 
                name: 'Alia Rose Connor', 
                title: 'Co-founder, Coach & Facilitator', 
                company: 'Frank & Eddy Leadership', 
                bio: 'Alia is the cofounder of Frank & Eddy Leadership and is passionate about building collaborative cross-functional product development teams.',
                profile_url: 'https://leaddev.com/speakers/alia-rose-connor'
            },
            { 
                name: 'Oakley Hall', 
                title: 'Principal Software Engineer', 
                company: 'Walmart Global Tech', 
                bio: 'Oakley is a Principal Software Engineer at Walmart Global Tech who focuses on solving big problems and building high-performing teams.',
                github_url: 'https://github.com/oakley',
                linkedin_url: 'https://linkedin.com/in/oakleyhall'
            },
            {
                name: 'Dr. Sarah Chen',
                title: 'VP of Engineering',
                company: 'TechCorp Solutions',
                bio: 'Leading AI researcher with 15+ years of experience in machine learning and team leadership.'
            }
        ];

        for (const speaker of speakers) {
            await this.runQuery(`INSERT INTO speakers (name, title, company, bio, profile_url, github_url, linkedin_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [speaker.name, speaker.title, speaker.company, speaker.bio, 
                 speaker.profile_url || null, speaker.github_url || null, speaker.linkedin_url || null]);
        }

        // Create sample sessions based on the screenshots
        const baseDate = new Date();
        baseDate.setHours(9, 0, 0, 0);

        const sessions = [
            {
                title: 'Steering the ship: Mistakes made and lessons learned',
                description: 'Candid insights into the biggest misconceptions about leadership and what truly makes a team exceptional.',
                start_time: new Date(baseDate.getTime()).toISOString(),
                end_time: new Date(baseDate.getTime() + 45 * 60 * 1000).toISOString(), // 45 minutes
                venue_id: 1, // Main Stage
                speaker_id: 1, // Jason Lengstorf
                session_type_id: 1, // TALK
                topic_id: 2, // Leadership
                suitability: ['EXPERIENCED MANAGER', 'NEW MANAGER', 'TECH LEAD']
            },
            {
                title: 'Live demo: CircleCI – Meet Chunk: Your agent to ship at AI speed with confidence',
                description: 'As AI-generated code accelerates development, teams face an impossible choice: ship what you haven\'t fully validated, leading to buggy production and mounting tech debt, or lose all your AI productivity gains by creating validation checkpoints that feel like finding a needle in a haystack.',
                start_time: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 11 AM
                end_time: new Date(baseDate.getTime() + 2.75 * 60 * 60 * 1000).toISOString(), // 45 minutes
                venue_id: 2, // Demo Stage
                speaker_id: 4, // Generic speaker
                session_type_id: 2, // DEMO STAGE
                topic_id: 11, // AI
                sponsor_company_id: 1, // CircleCI
                is_sponsored: 1
            },
            {
                title: 'I have a mix of junior and senior engineers – how do I adjust my management style to fit their needs?',
                description: 'Trade tactics for tackling everyday challenges. Sometimes it can feel like every problem has only one answer – but the truth is, in leadership there\'s never a single solution.',
                start_time: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 1 PM
                end_time: new Date(baseDate.getTime() + 4.75 * 60 * 60 * 1000).toISOString(),
                venue_id: 3, // Solution Swap Room
                speaker_id: 2, // Alia Rose Connor
                session_type_id: 3, // SOLUTION SWAP
                topic_id: 1, // Management
                suitability: ['EXPERIENCED MANAGER', 'NEW MANAGER']
            }
        ];

        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            const result = await this.runQuery(`
                INSERT INTO sessions (title, description, start_time, end_time, venue_id, speaker_id, session_type_id, topic_id, sponsor_company_id, is_sponsored) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [session.title, session.description, session.start_time, session.end_time, 
                 session.venue_id, session.speaker_id, session.session_type_id, session.topic_id,
                 session.sponsor_company_id || null, session.is_sponsored || 0]
            );

            // Add suitability levels if specified
            if (session.suitability) {
                for (const suitabilityName of session.suitability) {
                    const suitabilityLevel = await this.getQuery('SELECT id FROM suitability_levels WHERE name = ?', [suitabilityName]);
                    if (suitabilityLevel) {
                        await this.runQuery('INSERT INTO session_suitability (session_id, suitability_level_id) VALUES (?, ?)', 
                            [result.id, suitabilityLevel.id]);
                    }
                }
            }
        }

        console.log('Sample LeadDev data populated successfully');
    }

    // Utility methods for database operations
    async runQuery(sql, params = []) {
        if (this.isPostgres) {
            try {
                const result = await this.pgPool.query(sql, params);
                return { 
                    id: result.rows[0]?.id || result.insertId,
                    changes: result.rowCount 
                };
            } catch (err) {
                throw err;
            }
        }
        
        // SQLite
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    async getQuery(sql, params = []) {
        if (this.isPostgres) {
            try {
                const result = await this.pgPool.query(sql, params);
                return result.rows[0] || null;
            } catch (err) {
                throw err;
            }
        }
        
        // SQLite
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async allQuery(sql, params = []) {
        if (this.isPostgres) {
            try {
                const result = await this.pgPool.query(sql, params);
                return result.rows;
            } catch (err) {
                throw err;
            }
        }
        
        // SQLite
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Enhanced query methods for LeadDev data
    async getAllSessions() {
        const groupConcat = this.isPostgres ? 'STRING_AGG(DISTINCT sl.name, \',\')' : 'GROUP_CONCAT(DISTINCT sl.name)';
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   sc.name as sponsor_company_name,
                   ${groupConcat} as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN companies sc ON s.sponsor_company_id = sc.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            GROUP BY s.id, sp.name, sp.title, sp.company, st.name, t.name, v.name, sc.name
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql);
    }

    async getCurrentSessions() {
        const now = new Date().toISOString();
        const groupConcat = this.isPostgres ? 'STRING_AGG(DISTINCT sl.name, \',\')' : 'GROUP_CONCAT(DISTINCT sl.name)';
        const paramPlaceholder = this.isPostgres ? '$1' : '?';
        const paramPlaceholder2 = this.isPostgres ? '$2' : '?';
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   ${groupConcat} as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE s.start_time <= ${paramPlaceholder} AND s.end_time >= ${paramPlaceholder2}
            GROUP BY s.id, sp.name, sp.title, sp.company, st.name, t.name, v.name
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql, [now, now]);
    }

    async getUpcomingSessions(limit = 5) {
        const now = new Date().toISOString();
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   GROUP_CONCAT(DISTINCT sl.name) as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE s.start_time > ?
            GROUP BY s.id
            ORDER BY s.start_time
            LIMIT ?
        `;
        return await this.allQuery(sql, [now, limit]);
    }

    async getSessionsByTopic(topicName) {
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   GROUP_CONCAT(DISTINCT sl.name) as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE LOWER(t.name) LIKE LOWER(?)
            GROUP BY s.id
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql, [`%${topicName}%`]);
    }

    async getSessionsBySpeaker(speakerName) {
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company, sp.bio as speaker_bio,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   GROUP_CONCAT(DISTINCT sl.name) as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE LOWER(sp.name) LIKE LOWER(?)
            GROUP BY s.id
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql, [`%${speakerName}%`]);
    }

    async getSessionsByType(sessionType) {
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   GROUP_CONCAT(DISTINCT sl.name) as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE LOWER(st.name) LIKE LOWER(?)
            GROUP BY s.id
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql, [`%${sessionType}%`]);
    }

    async searchSessions(searchTerm) {
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   GROUP_CONCAT(DISTINCT sl.name) as suitability_levels
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN session_suitability ss ON s.id = ss.session_id
            LEFT JOIN suitability_levels sl ON ss.suitability_level_id = sl.id
            WHERE LOWER(s.title) LIKE LOWER(?) 
               OR LOWER(s.description) LIKE LOWER(?)
               OR LOWER(sp.name) LIKE LOWER(?)
               OR LOWER(t.name) LIKE LOWER(?)
               OR LOWER(st.name) LIKE LOWER(?)
            GROUP BY s.id
            ORDER BY s.start_time
        `;
        const searchPattern = `%${searchTerm}%`;
        return await this.allQuery(sql, [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]);
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;