# 🔄 Conference Data Strategy

## 📋 Challenge: Agenda Changes Day-Of

Conference agendas frequently change:
- Speakers get sick or cancel
- Session times shift
- New sessions get added last-minute
- Room changes happen
- Sponsor changes occur

## 🎯 Our Solution: Dynamic Refresh System

### 1. **Auto-Refresh Schedule**
- **Every 4 hours**: Automatic scrape during conference prep week
- **Every 1 hour**: Automatic scrape on conference day
- **On-demand**: Manual refresh via endpoint

### 2. **Implementation Strategy**

#### A. PostgreSQL + Scheduled Refresh
```bash
# Environment variables for Railway
AUTO_SCRAPE=true
SCRAPE_INTERVAL=14400  # 4 hours in seconds (prep week)
SCRAPE_INTERVAL_LIVE=3600  # 1 hour in seconds (conference day)
CONFERENCE_DATE=2025-10-15  # First day of LeadDev New York
CONFERENCE_DATE_2=2025-10-16  # Second day of LeadDev New York
```

#### B. Smart Data Updates
- **Incremental updates**: Only update changed sessions
- **Preserve context**: Don't lose ongoing conversations
- **Version tracking**: Track when data was last updated

### 3. **Manual Override Endpoints**

```bash
# Force refresh conference data
curl -X POST https://your-app.railway.app/admin/refresh-data

# Check last update time
curl https://your-app.railway.app/admin/data-status
```

### 4. **Conference Day Protocol**

#### Morning Setup (7 AM)
- [ ] Force refresh data
- [ ] Verify all key sessions are present
- [ ] Test voice queries for main speakers

#### During Conference
- [ ] Automatic hourly refreshes
- [ ] Monitor for agenda change announcements
- [ ] Manual refresh if major changes announced

#### Emergency Updates
- [ ] Slack/email notification system for data changes
- [ ] 5-minute manual refresh capability
- [ ] Fallback to cached data if scraping fails

## 🛠️ Technical Implementation

### Database Schema Enhancement
```sql
-- Track data freshness
CREATE TABLE data_updates (
    id SERIAL PRIMARY KEY,
    scrape_time TIMESTAMP NOT NULL,
    sessions_count INTEGER,
    changes_detected TEXT[],
    success BOOLEAN DEFAULT true
);
```

### Smart Refresh Logic
1. **Compare session counts** before/after scrape
2. **Detect changes** in key sessions (keynotes, popular speakers)
3. **Preserve active conversations** during updates
4. **Log all changes** for debugging

### User Communication
- Voice assistant says: "I'm using the latest conference data as of [time]"
- Analytics endpoint shows last update time
- Graceful handling if data is being refreshed

## 📊 Monitoring & Alerts

### Success Metrics
- Data refresh success rate
- Time since last successful update
- Number of sessions tracked
- User query success rate

### Alert Triggers
- Scraping fails 2x in a row
- Major session count change (>10%)
- Key speaker sessions disappear
- Data older than 2 hours on conference day

## 🎯 Deployment Plan

### Week Before Conference
1. Set up PostgreSQL with current data
2. Enable 4-hour auto-refresh
3. Test manual refresh endpoints
4. Monitor data consistency

### Conference Week  
1. Switch to 1-hour auto-refresh
2. Daily manual verification
3. Set up monitoring alerts
4. Prepare emergency procedures

### Conference Day
1. 7 AM: Manual refresh and verification
2. Monitor throughout the day
3. Manual refreshes for any announced changes
4. Keep logs of all updates

This strategy ensures participants always get the most current information! 🎤