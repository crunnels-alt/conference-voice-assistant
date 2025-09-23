const { Pool } = require('pg');

class PostgreSQLDatabaseManager {
    constructor() {
        this.pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    async initialize() {
        try {
            // Test connection
            await this.pgPool.query('SELECT NOW()');
            console.log('Connected to PostgreSQL database');
            
            // Create tables
            await this.createTables();
            
            // Check if we need sample data
            const result = await this.pgPool.query('SELECT COUNT(*) as count FROM sessions');
            if (parseInt(result.rows[0].count) === 0) {
                console.log('PostgreSQL database is empty - ready for real conference data');
            }
            
        } catch (err) {
            throw new Error(`PostgreSQL connection failed: ${err.message}`);
        }
    }

    async createTables() {
        const queries = [
            `CREATE TABLE IF NOT EXISTS speakers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT,
                company TEXT,
                bio TEXT,
                profile_url TEXT,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS session_types (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS topics (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS venues (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                capacity INTEGER,
                location_description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                website TEXT,
                is_sponsor BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
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
                session_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const query of queries) {
            await this.pgPool.query(query);
        }
    }

    async runQuery(sql, params = []) {
        try {
            const result = await this.pgPool.query(sql, params);
            return { 
                id: result.rows[0]?.id,
                changes: result.rowCount 
            };
        } catch (err) {
            throw err;
        }
    }

    async getQuery(sql, params = []) {
        try {
            const result = await this.pgPool.query(sql, params);
            return result.rows[0] || null;
        } catch (err) {
            throw err;
        }
    }

    async allQuery(sql, params = []) {
        try {
            const result = await this.pgPool.query(sql, params);
            return result.rows;
        } catch (err) {
            throw err;
        }
    }

    // Conference-specific query methods
    async getAllSessions() {
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name,
                   sc.name as sponsor_company_name
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            LEFT JOIN companies sc ON s.sponsor_company_id = sc.id
            ORDER BY s.start_time
        `;
        return await this.allQuery(sql);
    }

    async getCurrentSessions() {
        const now = new Date().toISOString();
        const sql = `
            SELECT s.*, 
                   sp.name as speaker_name, sp.title as speaker_title, sp.company as speaker_company,
                   st.name as session_type, 
                   t.name as topic_name, 
                   v.name as venue_name
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            WHERE s.start_time <= $1 AND s.end_time >= $2
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
                   v.name as venue_name
            FROM sessions s
            LEFT JOIN speakers sp ON s.speaker_id = sp.id
            LEFT JOIN session_types st ON s.session_type_id = st.id
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN venues v ON s.venue_id = v.id
            WHERE s.start_time > $1
            ORDER BY s.start_time
            LIMIT $2
        `;
        return await this.allQuery(sql, [now, limit]);
    }

    async insertSession(sessionData) {
        const sql = `
            INSERT INTO sessions (title, description, start_time, end_time, venue_id, speaker_id, session_type_id, topic_id, sponsor_company_id, is_sponsored)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        const result = await this.pgPool.query(sql, [
            sessionData.title,
            sessionData.description,
            sessionData.start_time,
            sessionData.end_time,
            sessionData.venue_id,
            sessionData.speaker_id,
            sessionData.session_type_id,
            sessionData.topic_id,
            sessionData.sponsor_company_id,
            sessionData.is_sponsored || false
        ]);
        return result.rows[0];
    }

    async insertSpeaker(speakerData) {
        const sql = `
            INSERT INTO speakers (name, title, company, bio, profile_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `;
        const result = await this.pgPool.query(sql, [
            speakerData.name,
            speakerData.title,
            speakerData.company,
            speakerData.bio,
            speakerData.profile_url
        ]);
        return result.rows[0];
    }

    async findOrCreateSessionType(name) {
        // Try to find existing
        let result = await this.getQuery('SELECT id FROM session_types WHERE name = $1', [name]);
        if (result) return result;

        // Create new
        result = await this.pgPool.query(
            'INSERT INTO session_types (name) VALUES ($1) RETURNING id', 
            [name]
        );
        return result.rows[0];
    }

    async findOrCreateTopic(name) {
        let result = await this.getQuery('SELECT id FROM topics WHERE name = $1', [name]);
        if (result) return result;

        result = await this.pgPool.query(
            'INSERT INTO topics (name) VALUES ($1) RETURNING id', 
            [name]
        );
        return result.rows[0];
    }

    async findOrCreateVenue(name) {
        let result = await this.getQuery('SELECT id FROM venues WHERE name = $1', [name]);
        if (result) return result;

        result = await this.pgPool.query(
            'INSERT INTO venues (name) VALUES ($1) RETURNING id', 
            [name]
        );
        return result.rows[0];
    }

    async clearAllSessions() {
        await this.pgPool.query('DELETE FROM sessions');
        console.log('Cleared all sessions from PostgreSQL database');
    }
}

module.exports = PostgreSQLDatabaseManager;