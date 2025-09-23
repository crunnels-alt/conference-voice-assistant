# 🎤 Conference Voice Assistant - Setup Guide

## 🚀 Your App is LIVE!
**URL**: https://conference-voice-assistant-production.up.railway.app

## ✅ What's Working Right Now (No API Keys Needed)

### Demo Endpoints
- **Health Check**: https://conference-voice-assistant-production.up.railway.app/health
- **All Sessions**: https://conference-voice-assistant-production.up.railway.app/demo/sessions  
- **Analytics**: https://conference-voice-assistant-production.up.railway.app/analytics

### Test Queries (Works Now!)
```bash
# Find AI sessions
curl -X POST -H "Content-Type: application/json" \
  -d '{"function_name": "search_sessions_by_topic", "parameters": {"topic": "AI"}}' \
  "https://conference-voice-assistant-production.up.railway.app/demo/query"

# Find specific speaker
curl -X POST -H "Content-Type: application/json" \
  -d '{"function_name": "search_sessions_by_speaker", "parameters": {"speaker_name": "Jason Lengstorf"}}' \
  "https://conference-voice-assistant-production.up.railway.app/demo/query"

# Get current sessions
curl -X POST -H "Content-Type: application/json" \
  -d '{"function_name": "get_current_sessions", "parameters": {}}' \
  "https://conference-voice-assistant-production.up.railway.app/demo/query"
```

## 🔑 API Keys Setup (When Ready)

### 1. OpenAI API Key
1. Go to: https://platform.openai.com/api-keys
2. Create new secret key
3. Add to Railway:
```bash
railway variables --set "OPENAI_API_KEY=sk-your-openai-key-here"
```

### 2. Infobip Voice API
1. Go to: https://www.infobip.com/signup
2. Sign up for Voice API access
3. Get your credentials:
   - API Key
   - Base URL (usually https://api.infobip.com)  
   - Application ID
4. Add to Railway:
```bash
railway variables --set "INFOBIP_API_KEY=your-infobip-key"
railway variables --set "INFOBIP_BASE_URL=https://api.infobip.com"
railway variables --set "INFOBIP_APPLICATION_ID=your-app-id"
```

## 📞 Phone Integration Steps

### 1. Configure Infobip Webhook
In your Infobip dashboard, set webhook URL to:
```
https://conference-voice-assistant-production.up.railway.app/webhook/voice/inbound
```

### 2. Test Voice Calls
Once configured, participants can call your Infobip number and ask:
- "What's happening right now?"
- "Find sessions about leadership"
- "Who is Jason Lengstorf?" 
- "What's coming up next?"

## 🎯 Conference Day Checklist

- [ ] OpenAI API key added
- [ ] Infobip credentials configured
- [ ] Infobip webhook URL set
- [ ] Phone number tested
- [ ] Conference data is current (run scraper if needed)
- [ ] Share phone number with conference participants

## 📊 Monitoring

- **Health**: https://conference-voice-assistant-production.up.railway.app/health
- **Analytics**: https://conference-voice-assistant-production.up.railway.app/analytics
- **Railway Dashboard**: https://railway.com/project/4ddca832-8968-443b-bb57-388f20c29d8a

## 🔄 Update Conference Data

If you need to refresh the LeadDev conference data:
```bash
npm run test-scraper
git add data/
git commit -m "Update conference data"
git push
```

## 🛠️ Development

Local testing:
```bash
git clone https://github.com/crunnels-alt/conference-voice-assistant.git
cd conference-voice-assistant
npm install
cp .env.example .env
# Add your API keys to .env
npm start
```

## 🎉 Ready for Production!

Your voice assistant can handle:
- **123+ real conference sessions** from LeadDev New York (Oct 15-16, 2025)
- **Natural language queries** via phone calls
- **Context-aware conversations** with follow-up questions
- **Multiple concurrent callers**
- **Real-time conference information** with auto-refresh
