# Conference Voice Assistant

A conversational voice assistant for the LeadDev New York conference built with **Infobip Voice API** and **OpenAI Realtime API**.

## 🎯 Overview

This demo showcases how to build a sophisticated voice assistant that can:
- Answer questions about conference sessions, speakers, and schedule
- Handle natural language queries through voice calls
- Provide real-time conference information
- Scale to handle multiple concurrent calls

## 🏗️ Architecture

```
📞 Phone Call → Infobip Voice API → SIP Connection → OpenAI Realtime API
                                                         ↓
                                  Conference Database ← Function Calls
```

### Components:

1. **Infobip Voice API**: Handles phone calls and SIP routing
2. **OpenAI Realtime API**: Provides speech-to-text, natural language understanding, and text-to-speech
3. **Conference Database**: SQLite database with real LeadDev conference data
4. **Function Handlers**: Execute database queries when requested by OpenAI
5. **Web Scraper**: Pulls real conference data from LeadDev website

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- Infobip account with Voice API access
- OpenAI account with Realtime API access

### 1. Installation

```bash
git clone <repository>
cd conference-voice-assistant
npm install
```

### 2. Configuration

Copy the environment file and configure your API keys:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Infobip Voice API Configuration
INFOBIP_API_KEY=your_infobip_api_key_here
INFOBIP_BASE_URL=your_infobip_base_url_here
INFOBIP_APPLICATION_ID=your_application_id_here

# OpenAI Configuration  
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=3000
WEBHOOK_BASE_URL=https://your-domain.com  # or ngrok URL for testing
```

### 3. Database Setup

The app will automatically create and populate the database with real LeadDev conference data:

```bash
npm run test-scraper  # Optional: test the data scraper
```

### 4. Start the Server

```bash
npm start
# or for development:
npm run dev
```

### 5. Test the Demo

```bash
npm run demo
```

This will test all the conference assistant functions and show you what the voice assistant can do.

## 📱 Voice Demo Setup

### Option 1: Using ngrok (for testing)

1. Install ngrok: `npm install -g ngrok`
2. Expose your local server: `ngrok http 3000`
3. Copy the ngrok URL to your `.env` file as `WEBHOOK_BASE_URL`
4. Configure your Infobip Voice API webhook to point to `https://your-ngrok-url.ngrok.io/webhook/voice/inbound`

### Option 2: Production Deployment

Deploy to your preferred hosting service and configure the webhook URL accordingly.

## 🎤 Demo Scenarios

The voice assistant can handle queries like:

### Current & Upcoming Sessions
- *"What's happening right now?"*
- *"What's coming up next?"*  
- *"What's the schedule for today?"*

### Speaker Information
- *"Who is Jason Lengstorf?"*
- *"Tell me about the speaker from Google"*
- *"What sessions is Angie Jones presenting?"*

### Topic Search  
- *"Find sessions about AI"*
- *"What talks are there on leadership?"*
- *"Show me sessions about engineering management"*

### Session Details
- *"Tell me more about the CircleCI demo"*
- *"When is the solution swap session?"*
- *"What's the AI session about?"*

### Session Types
- *"Show me demo stage sessions"*
- *"What workshops are available?"*  
- *"Find all the talks"*

## 🔧 API Reference

### Function Endpoints (for OpenAI Realtime API)

The assistant exposes these functions to OpenAI:

- `get_current_sessions()` - Get currently running sessions
- `get_upcoming_sessions(limit)` - Get upcoming sessions  
- `search_sessions_by_topic(topic)` - Find sessions by topic
- `search_sessions_by_speaker(speaker_name)` - Find sessions by speaker
- `get_session_details(session_query)` - Get detailed session info
- `search_sessions_by_type(session_type)` - Find sessions by type
- `get_full_schedule(day)` - Get schedule overview
- `search_general(query)` - General search

### Demo Endpoints (for testing)

- `POST /demo/query` - Test queries without voice call
- `GET /demo/sessions` - View all conference sessions
- `GET /analytics` - View system analytics
- `GET /health` - Health check

### Webhook Endpoints (for Infobip)

- `POST /webhook/voice/inbound` - Handle incoming calls
- `POST /webhook/voice/connected` - Handle successful connections  
- `POST /webhook/voice/hangup` - Handle call endings
- `POST /webhook/openai/function-call` - Handle OpenAI function calls

## 📊 Analytics

View real-time analytics at `/analytics`:

```json
{
  "activeSessions": 2,
  "totalSessions": 126,
  "systemHealth": {
    "database": "healthy",
    "openai": "configured", 
    "infobip": "configured"
  }
}
```

## 🗄️ Database Schema

The assistant uses a SQLite database with these main tables:

- **sessions** - Conference sessions with times, descriptions
- **speakers** - Speaker information, bios, companies  
- **topics** - Session topics and categories
- **venues** - Room locations and capacities
- **companies** - Sponsors and exhibitors
- **session_types** - Talk, demo, workshop, etc.
- **session_suitability** - Target audience levels

## 🔍 Real Conference Data

The system scrapes real data from the LeadDev New York conference including:

- 123+ actual sessions from the conference
- Real speaker names, titles, and companies
- Accurate session descriptions and times
- Proper session types (Talk, Demo Stage, Solution Swap)
- Suitability levels (Experienced Manager, New Manager, Tech Lead)

## 🚀 Production Considerations

### Scaling
- Use Redis for session management across multiple server instances
- Implement database connection pooling
- Add rate limiting for webhook endpoints

### Monitoring  
- Add structured logging (Winston, Pino)
- Implement health checks for external dependencies
- Monitor OpenAI API usage and costs

### Security
- Validate webhook signatures from Infobip
- Implement API key rotation
- Add input sanitization for user queries

### Performance
- Cache frequent queries (current/upcoming sessions)
- Optimize database queries with indexes
- Implement query result caching

## 🛠️ Development

### Running Tests

```bash
npm test  # Run Jest tests (when added)
npm run test-scraper  # Test the conference data scraper
npm run demo  # Run the full demo
```

### Project Structure

```
src/
├── app.js              # Main application entry point
├── database/
│   ├── databaseManager.js    # Database operations
│   └── leaddevScraper.js     # Web scraper for conference data
├── nlp/
│   └── realtimeFunctions.js  # OpenAI function definitions
└── voice/
    └── voiceHandler.js       # Infobip webhook handlers
    
scripts/
├── demo.js             # Demo testing script
└── testScraper.js      # Scraper testing script
```

## 📝 License

MIT License - Feel free to use this for your own conference voice assistants!

---

## 🎉 About This Demo

This project demonstrates the power of combining:
- **Infobip's Voice API** for robust telephony infrastructure
- **OpenAI's Realtime API** for natural conversation capabilities  
- **Real conference data** for practical, useful responses
- **Modern web technologies** for scalable deployment

Perfect for conferences, events, customer service, and any scenario where voice-based information access is valuable.