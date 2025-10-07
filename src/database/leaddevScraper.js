const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');

class LeadDevScraper {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.baseUrl = 'https://leaddev.com';
        this.agendaUrl = 'https://leaddev.com/leaddev-new-york/agenda/';
    }

    async scrapeConferenceData() {
        console.log('Starting LeadDev conference data scrape...');
        
        try {
            // Scrape the main agenda page
            const response = await axios.get(this.agendaUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            
            // Save the HTML for debugging
            await this.saveHtmlForDebugging(response.data);
            
            // Extract session data
            const sessions = await this.extractSessions($);
            console.log(`Found ${sessions.length} sessions`);
            
            // Insert into database
            await this.insertSessionsIntoDatabase(sessions);
            
            return sessions;
            
        } catch (error) {
            console.error('Error scraping LeadDev data:', error.message);
            throw error;
        }
    }

    async saveHtmlForDebugging(html) {
        const debugDir = path.join(__dirname, '../../debug');
        try {
            await fs.mkdir(debugDir, { recursive: true });
            await fs.writeFile(path.join(debugDir, 'leaddev-agenda.html'), html);
            console.log('HTML saved for debugging');
        } catch (error) {
            console.warn('Could not save HTML for debugging:', error.message);
        }
    }

    async extractSessions($) {
        const sessions = [];
        
        // Try multiple selectors based on common patterns for conference sites
        const sessionSelectors = [
            '.agenda-item',
            '.session-item', 
            '.schedule-item',
            '[class*="session"]',
            '[class*="talk"]',
            '[class*="agenda"]'
        ];

        let foundSessions = false;
        
        for (const selector of sessionSelectors) {
            const elements = $(selector);
            if (elements.length > 0) {
                console.log(`Found ${elements.length} elements with selector: ${selector}`);
                foundSessions = true;
                
                elements.each((index, element) => {
                    const session = this.extractSessionFromElement($, element);
                    if (session) {
                        sessions.push(session);
                    }
                });
                break; // Use the first selector that finds elements
            }
        }

        if (!foundSessions) {
            // Fallback: look for any elements with session-related text
            console.log('No sessions found with standard selectors, trying text-based extraction...');
            sessions.push(...this.extractSessionsFromText($));
        }

        return sessions;
    }

    extractSessionFromElement($, element) {
        const $el = $(element);
        
        try {
            // Extract basic information
            const title = this.extractText($el, [
                '.session-title',
                '.title',
                'h1, h2, h3, h4',
                '[class*="title"]'
            ]);

            const description = this.extractText($el, [
                '.session-description',
                '.description',
                'p',
                '[class*="description"]'
            ]);

            const speaker = this.extractSpeakerInfo($, $el);
            const sessionType = this.extractSessionType($, $el);
            const time = this.extractTimeInfo($, $el);
            const suitability = this.extractSuitabilityInfo($, $el);

            if (!title) return null;

            return {
                title: title.trim(),
                description: description ? description.trim() : '',
                speaker,
                sessionType,
                time,
                suitability,
                rawHtml: $el.html() // For debugging
            };

        } catch (error) {
            console.warn('Error extracting session from element:', error.message);
            return null;
        }
    }

    extractText($el, selectors) {
        for (const selector of selectors) {
            const text = $el.find(selector).first().text();
            if (text && text.trim()) {
                return text.trim();
            }
        }
        return null;
    }

    extractSpeakerInfo($, $el) {
        // LeadDev uses .ld-card__contributors__item__name for speaker names
        const speakerSelectors = [
            '.ld-card__contributors__item__name', // LeadDev specific
            '.speaker-name',
            '.speaker',
            '[class*="speaker"]',
            '.presenter'
        ];

        for (const selector of speakerSelectors) {
            const speakerElement = $el.find(selector).first();
            if (speakerElement.length) {
                return {
                    name: speakerElement.text().trim(),
                    title: this.extractText($el, ['.ld-card__contributors__item__role', '.speaker-title', '.title']),
                    company: this.extractText($el, ['.ld-card__contributors__item__company', '.speaker-company', '.company'])
                };
            }
        }

        return null;
    }

    extractSessionType($, $el) {
        const typeSelectors = [
            '.session-type',
            '.type',
            '[class*="type"]'
        ];

        for (const selector of typeSelectors) {
            const type = $el.find(selector).first().text();
            if (type && type.trim()) {
                return type.trim().toUpperCase();
            }
        }

        // Look for type indicators in the text
        const text = $el.text().toLowerCase();
        if (text.includes('demo stage')) return 'DEMO STAGE';
        if (text.includes('solution swap')) return 'SOLUTION SWAP';
        if (text.includes('talk')) return 'TALK';
        if (text.includes('workshop')) return 'WORKSHOP';

        return 'TALK'; // Default
    }

    extractTimeInfo($, $el) {
        const timeSelectors = [
            '.time',
            '.schedule-time',
            '[class*="time"]',
            '.start-time'
        ];

        for (const selector of timeSelectors) {
            const timeText = $el.find(selector).first().text();
            if (timeText && timeText.trim()) {
                return this.parseTime(timeText.trim());
            }
        }

        return null;
    }

    extractSuitabilityInfo($, $el) {
        const suitabilityText = $el.text().toLowerCase();
        const levels = [];

        if (suitabilityText.includes('experienced manager')) levels.push('EXPERIENCED MANAGER');
        if (suitabilityText.includes('new manager')) levels.push('NEW MANAGER');
        if (suitabilityText.includes('tech lead')) levels.push('TECH LEAD');
        if (suitabilityText.includes('senior engineer')) levels.push('SENIOR ENGINEER');

        return levels;
    }

    parseTime(timeString) {
        // Try to parse time strings like "9:00 AM", "14:30", etc.
        // This is a basic implementation - you might need to enhance based on actual format
        const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
        const match = timeString.match(timeRegex);
        
        if (match) {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const isPM = match[3] && match[3].toUpperCase() === 'PM';
            
            if (isPM && hours !== 12) hours += 12;
            if (!isPM && hours === 12) hours = 0;
            
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            
            return {
                start: date.toISOString(),
                end: new Date(date.getTime() + 45 * 60 * 1000).toISOString() // Default 45 minutes
            };
        }
        
        return null;
    }

    extractSessionsFromText($) {
        // Fallback method: extract sessions from text content
        // This is a basic implementation for when structured selectors fail
        const sessions = [];
        
        // Look for common patterns in the text
        const text = $.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // If line looks like a session title (contains certain keywords)
            if (this.looksLikeSessionTitle(line)) {
                const session = {
                    title: line,
                    description: '',
                    speaker: null,
                    sessionType: 'TALK',
                    time: null,
                    suitability: []
                };
                
                // Look at next few lines for description and speaker info
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                    const nextLine = lines[j];
                    if (this.looksLikeDescription(nextLine)) {
                        session.description = nextLine;
                    }
                    if (this.looksLikeSpeakerName(nextLine)) {
                        session.speaker = { name: nextLine, title: '', company: '' };
                    }
                }
                
                sessions.push(session);
            }
        }
        
        return sessions;
    }

    looksLikeSessionTitle(text) {
        // Basic heuristics for identifying session titles
        if (text.length < 10 || text.length > 200) return false;
        
        const sessionKeywords = [
            'how to', 'guide to', 'introduction to', 'mastering', 'building',
            'leadership', 'management', 'engineering', 'development', 'team',
            'mistakes', 'lessons', 'best practices', 'strategies'
        ];
        
        const lowerText = text.toLowerCase();
        return sessionKeywords.some(keyword => lowerText.includes(keyword));
    }

    looksLikeDescription(text) {
        return text.length > 50 && text.includes(' ') && !text.includes('@');
    }

    looksLikeSpeakerName(text) {
        // Basic heuristics for speaker names
        if (text.length < 3 || text.length > 50) return false;
        
        const words = text.split(' ');
        return words.length >= 2 && words.length <= 4 && 
               words.every(word => word[0] === word[0].toUpperCase());
    }

    async insertSessionsIntoDatabase(sessions) {
        if (!this.databaseManager) {
            console.log('No database manager provided, skipping insertion');
            return;
        }

        console.log(`Inserting ${sessions.length} sessions into database...`);

        // CRITICAL: Create default venue FIRST, before any session insertions
        console.log('🏢 Creating default venue...');
        let defaultVenueId;
        try {
            const defaultVenue = await this.databaseManager.findOrCreateVenue('Main Conference Hall');
            defaultVenueId = defaultVenue.id;
            console.log(`✅ Default venue created/found with ID: ${defaultVenueId}`);
        } catch (error) {
            console.error('❌ CRITICAL: Could not create default venue:', error.message);
            console.error('Cannot proceed with session insertions - aborting');
            return; // Stop here - don't try to insert sessions without a valid venue
        }

        // Verify venue actually exists before proceeding
        try {
            const venueCheck = await this.databaseManager.getQuery(
                'SELECT id FROM venues WHERE id = $1',
                [defaultVenueId]
            );
            if (!venueCheck) {
                console.error(`❌ CRITICAL: Venue ID ${defaultVenueId} not found in database after creation`);
                return;
            }
            console.log(`✅ Verified venue ID ${defaultVenueId} exists in database`);
        } catch (error) {
            console.error('❌ Error verifying venue:', error.message);
            return;
        }

        for (const session of sessions) {
            try {
                // Insert or get speaker
                let speakerId = null;
                if (session.speaker && session.speaker.name) {
                    const existingSpeaker = await this.databaseManager.getQuery(
                        'SELECT id FROM speakers WHERE name = $1',
                        [session.speaker.name]
                    );

                    if (existingSpeaker) {
                        speakerId = existingSpeaker.id;
                    } else {
                        const speakerResult = await this.databaseManager.runQuery(
                            'INSERT INTO speakers (name, title, company) VALUES ($1, $2, $3) RETURNING id',
                            [session.speaker.name, session.speaker.title || '', session.speaker.company || '']
                        );
                        speakerId = speakerResult.id;
                    }
                }

                // Insert or get session type
                let sessionTypeId = null;
                if (session.sessionType) {
                    const existingType = await this.databaseManager.getQuery(
                        'SELECT id FROM session_types WHERE name = $1',
                        [session.sessionType]
                    );

                    if (existingType) {
                        sessionTypeId = existingType.id;
                    } else {
                        const typeResult = await this.databaseManager.runQuery(
                            'INSERT INTO session_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
                            [session.sessionType]
                        );
                        sessionTypeId = typeResult.id;
                    }
                }

                // Insert or get topic (use first suitability level as topic)
                let topicId = null;
                if (session.suitability && session.suitability.length > 0) {
                    const topicName = session.suitability[0]; // Use first suitability level
                    const existingTopic = await this.databaseManager.getQuery(
                        'SELECT id FROM topics WHERE name = $1',
                        [topicName]
                    );

                    if (existingTopic) {
                        topicId = existingTopic.id;
                    } else {
                        const topicResult = await this.databaseManager.runQuery(
                            'INSERT INTO topics (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
                            [topicName]
                        );
                        topicId = topicResult.id;
                    }
                }

                // Insert session
                const startTime = session.time ? session.time.start : new Date().toISOString();
                const endTime = session.time ? session.time.end : new Date(Date.now() + 45 * 60 * 1000).toISOString();

                const sessionResult = await this.databaseManager.runQuery(`
                    INSERT INTO sessions (title, description, start_time, end_time, speaker_id, session_type_id, topic_id, venue_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [session.title, session.description, startTime, endTime, speakerId, sessionTypeId, topicId, defaultVenueId]
                );

                console.log(`✅ Inserted session: ${session.title}`);

            } catch (error) {
                console.error(`❌ Error inserting session "${session.title}":`, error.message);
            }
        }
    }

    // Method to manually scrape and save data
    async scrapeAndSave() {
        try {
            const sessions = await this.scrapeConferenceData();
            
            // Save scraped data to JSON file for backup
            const dataDir = path.join(__dirname, '../../data');
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(
                path.join(dataDir, 'scraped-sessions.json'), 
                JSON.stringify(sessions, null, 2)
            );
            
            console.log('Scraped data saved to scraped-sessions.json');
            return sessions;
            
        } catch (error) {
            console.error('Error in scrapeAndSave:', error.message);
            throw error;
        }
    }
}

module.exports = LeadDevScraper;