# Conference Voice Assistant - Deployment Guide

## Architecture Overview

```
Customer Call → Infobip Phone Number → Infobip SIP Trunk → OpenAI SIP (sip:proj_xxx@sip.api.openai.com)
                                                                  ↓
                                                    Fires webhook to Railway app
                                                                  ↓
                                                    Railway app accepts call with:
                                                    - Model config (gpt-realtime)
                                                    - Instructions (system prompt)
                                                    - Function definitions
                                                    - Voice selection
                                                                  ↓
                                                    WebSocket connection monitors call
                                                    - Receives function call events
                                                    - Queries PostgreSQL database
                                                    - Returns conference data to OpenAI
                                                                  ↓
                                                    OpenAI speaks naturally to customer
```

## Setup Steps

### 1. Set Up OpenAI Webhook

1. Go to [OpenAI Platform Settings](https://platform.openai.com/settings)
2. Navigate to **Project** → **Webhooks**
3. Click **Add Webhook**
4. Configure:
   - **URL**: `https://conference-voice-assistant-production.up.railway.app/webhook/openai/realtime`
   - **Events**: Select `realtime.call.incoming`
   - **Secret**: (OpenAI will generate this - save it!)
5. Copy your **Project ID** from **Settings** → **Project** → **General** (format: `proj_xxxxx`)

### 2. Configure Infobip SIP Trunk

You need to configure Infobip to route calls to OpenAI's SIP endpoint.

**OpenAI SIP Endpoint Format:**
```
sip:<PROJECT_ID>@sip.api.openai.com;transport=tls
```

**Example:**
```
sip:proj_abc123xyz@sip.api.openai.com;transport=tls
```

#### Option A: Via Infobip API (Recommended)

```bash
# Get your phone number details
curl -X GET "https://mmlr62.api.infobip.com/provisioning/1/numbers" \
  -H "Authorization: App $INFOBIP_API_KEY"

# Configure SIP trunk for your number
curl -X PUT "https://mmlr62.api.infobip.com/provisioning/1/numbers/{phoneNumber}" \
  -H "Authorization: App $INFOBIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationType": "SIP",
    "destinationAddress": "sip:proj_YOUR_PROJECT_ID@sip.api.openai.com;transport=tls"
  }'
```

#### Option B: Via Infobip Portal

1. Log in to [Infobip Portal](https://portal.infobip.com)
2. Navigate to **Numbers** → **My Numbers**
3. Select your phone number
4. Under **Voice Configuration**:
   - Set **Destination Type**: SIP
   - Set **SIP URI**: `sip:proj_YOUR_PROJECT_ID@sip.api.openai.com;transport=tls`
5. Save changes

### 3. Update Railway Environment Variables

Add these to your Railway app:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
OPENAI_WEBHOOK_SECRET=whsec_...  # From step 1
OPENAI_PROJECT_ID=proj_...       # From step 1

# Existing variables (already set)
INFOBIP_API_KEY=D8a1a28cf82a05a65b73b17326231d03-...
INFOBIP_BASE_URL=https://mmlr62.api.infobip.com
DATABASE_URL=postgresql://...
PORT=3000
NODE_ENV=production
WEBHOOK_BASE_URL=https://conference-voice-assistant-production.up.railway.app
```

### 4. Deploy to Railway

```bash
# Commit changes
git add .
git commit -m "Implement OpenAI Realtime SIP integration"
git push origin feature/production-deployment

# Railway should auto-deploy
# Or manually trigger deploy from Railway dashboard
```

### 5. Test the Integration

#### Test 1: Health Check
```bash
curl https://conference-voice-assistant-production.up.railway.app/health
```

Expected: `{"status":"healthy","timestamp":"..."}`

#### Test 2: Check Database
```bash
curl https://conference-voice-assistant-production.up.railway.app/demo/sessions
```

Expected: Array of conference sessions

#### Test 3: Make a Test Call
1. Call your Infobip phone number
2. You should hear the AI assistant greet you
3. Ask: "What sessions are happening right now?"
4. The AI should query the database and respond with current sessions

#### Test 4: Monitor Logs
In Railway dashboard, watch logs for:
- `📞 Incoming call from OpenAI:`
- `✅ Accepting call...`
- `🔌 Opening WebSocket connection...`
- `✅ WebSocket connected for call...`
- `🔧 Executing function: get_current_sessions`

## Function Calls Available

The AI assistant has these functions to query conference data:

1. **get_current_sessions** - Sessions happening now
2. **get_upcoming_sessions** - Next sessions
3. **search_sessions_by_topic** - Find sessions by topic (AI, leadership, etc.)
4. **search_sessions_by_speaker** - Find sessions by speaker name
5. **get_session_details** - Get details about a specific session
6. **search_sessions_by_type** - Find talks, demos, workshops
7. **get_full_schedule** - Complete conference schedule
8. **search_general** - General search across all data

## Voice Configuration

Current settings (can be changed in `voiceHandler.js`):
- **Model**: `gpt-realtime`
- **Voice**: `alloy` (options: alloy, echo, fable, onyx, nova, shimmer)
- **Temperature**: 0.8
- **Max tokens**: 4096

## Troubleshooting

### Call doesn't connect
- Verify Infobip SIP trunk is pointing to correct OpenAI endpoint
- Check OpenAI Project ID is correct
- Verify phone number is configured in Infobip

### Webhook not firing
- Check webhook URL is accessible: `https://conference-voice-assistant-production.up.railway.app/webhook/openai/realtime`
- Verify webhook is configured in OpenAI Platform
- Check webhook signature/secret is correct

### AI doesn't respond with data
- Check Railway logs for function execution errors
- Verify DATABASE_URL is set and working
- Test database queries: `/demo/sessions` endpoint
- Check function call events in logs

### WebSocket connection fails
- Verify OPENAI_API_KEY is valid
- Check Railway logs for WebSocket errors
- Ensure OpenAI API key has Realtime API access

## Advanced Features

### Call Transfer
Transfer to a live agent:
```javascript
await voiceHandler.referCall(callId, 'tel:+14155551234');
```

### Hangup Programmatically
```javascript
await voiceHandler.hangupCall(callId);
```

### Custom Instructions Per Call
Modify `acceptCall()` in `voiceHandler.js` to customize instructions based on caller info.

## Cost Estimates

- **OpenAI Realtime API**: ~$0.06/minute input, ~$0.24/minute output
- **Infobip Voice**: Varies by region (typically $0.01-0.05/minute)
- **Railway**: Hobby plan $5/month, Pro $20/month

For a 1000 calls/month @ 2 min avg:
- OpenAI: ~$600/month
- Infobip: ~$40/month
- Railway: $20/month
- **Total**: ~$660/month

## Next Steps

1. ✅ Complete OpenAI webhook setup
2. ✅ Configure Infobip SIP trunk
3. ✅ Deploy to Railway
4. Test with real calls
5. Monitor performance and adjust instructions
6. Add call recording/transcription if needed
7. Set up analytics dashboard
