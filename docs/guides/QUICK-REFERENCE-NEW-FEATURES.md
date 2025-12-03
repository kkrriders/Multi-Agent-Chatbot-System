# Quick Reference Guide - New Features

## 🚀 New Features Overview

### 1. Convergence Detection (Research Sessions)
Automatically detects when agents reach consensus and terminates early.

### 2. Cache Analytics & Monitoring
Real-time monitoring of response cache performance with detailed statistics.

### 3. Voting Session Integration Tests
Comprehensive test suite to verify voting functionality.

---

## 📖 How to Use

### Convergence Detection

**Automatic Feature** - No configuration needed!

When you start a research session, convergence detection runs automatically:

```bash
# Start a research session
curl -X POST http://localhost:3000/research-session \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Impact of AI on healthcare",
    "rounds": 5,
    "participants": [
      {"agentId": "agent-1", "agentName": "Dr. Smith"},
      {"agentId": "agent-2", "agentName": "Dr. Johnson"},
      {"agentId": "agent-3", "agentName": "Dr. Williams"}
    ],
    "managerInstructions": "Lead a medical research discussion"
  }'
```

**What Happens**:
- After round 2, the system checks if agents are agreeing
- If convergence detected (70%+ confidence), session ends early
- You'll see a "🎯 Convergence Detected" message
- Remaining rounds are skipped automatically

**Benefits**:
- Saves time when agents agree quickly
- Reduces API costs
- Still gets quality results

---

### Cache Monitoring

**3 New API Endpoints**:

#### 1. Check Cache Stats
```bash
curl http://localhost:3000/api/cache/stats
```

**Response**:
```json
{
  "success": true,
  "cache": {
    "size": 45,
    "maxSize": 100,
    "ttl": 300000,
    "hits": 123,
    "misses": 67,
    "evictions": 12,
    "totalRequests": 190,
    "hitRate": 64.7,
    "uptime": 3600,
    "estimatedTimeSaved": 246,
    "performance": {
      "status": "excellent",
      "recommendation": "Cache performing well"
    }
  }
}
```

#### 2. System Status (Now Includes Cache)
```bash
curl http://localhost:3000/status
```

**Response includes cache section**:
```json
{
  "manager": {...},
  "agents": {...},
  "activeConversations": 5,
  "cache": {
    "hitRate": 64.7,
    "estimatedTimeSaved": 246,
    ...
  }
}
```

#### 3. Clear Cache
```bash
curl -X POST http://localhost:3000/api/cache/clear
```

**Response**:
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "entriesRemoved": 45
}
```

**Performance Ratings**:
- **Excellent**: Hit rate > 50%
- **Good**: Hit rate > 30%
- **Fair**: Hit rate > 10%
- **Poor**: Hit rate < 10%

---

### Testing Voting Sessions

**Run All Tests**:
```bash
npm run test-voting
```

**Or manually**:
```bash
node tests/test-voting-session.js
```

**Tests Included**:
1. ✅ Weighted voting with 3 agents
2. ✅ Ranked choice voting with 4 agents
3. ✅ Validation (minimum 2 agents required)

**Expected Output**:
```
═══════════════════════════════════════════
  VOTING SESSION INTEGRATION TESTS
═══════════════════════════════════════════
✅ Manager service is running

🗳️  Testing Voting Session...
✅ Voting session completed successfully!

🗳️  Testing Ranked Choice Voting...
✅ Ranked choice voting completed!

🗳️  Testing Minimum Participants Validation...
✅ Correctly rejected with 1 participant

═══════════════════════════════════════════
  TEST SUMMARY
═══════════════════════════════════════════
✅ Passed: 3
❌ Failed: 0
📊 Total: 3

🎉 All tests passed!
```

---

## 🎯 Quick Examples

### Monitor Cache Performance During Use

```bash
# Terminal 1: Start services
npm start

# Terminal 2: Check initial cache state
curl http://localhost:3000/api/cache/stats

# Terminal 3: Make some requests
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is AI?", "agentId": "agent-1"}'

# Make the same request again (should hit cache)
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is AI?", "agentId": "agent-1"}'

# Terminal 2: Check cache stats again
curl http://localhost:3000/api/cache/stats
# You should see hits: 1, hitRate increased
```

### Test Convergence with Simple Topic

```bash
# Start a research session with a simple topic where agents will likely agree
curl -X POST http://localhost:3000/research-session \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Is water essential for life?",
    "rounds": 5,
    "participants": [
      {"agentId": "agent-1", "agentName": "Scientist 1"},
      {"agentId": "agent-2", "agentName": "Scientist 2"}
    ]
  }'

# Watch the response - likely to converge early since answer is obvious
```

---

## 🐛 Bug Fix Verification

The critical voting bug has been fixed. Verify it works:

```bash
# Start services
npm start

# Run voting test (in another terminal)
npm run test-voting

# Should see all tests pass
```

**What was fixed**: Agents now correctly return `content` instead of accessing non-existent `response` field.

---

## 📊 Monitoring Dashboard Commands

```bash
# Quick health check with cache stats
curl http://localhost:3000/status | jq '.cache'

# Monitor cache hit rate over time
watch -n 5 'curl -s http://localhost:3000/api/cache/stats | jq ".cache.hitRate"'

# Check if cache needs optimization
curl -s http://localhost:3000/api/cache/stats | jq '.cache.performance'
```

---

## 🔧 Troubleshooting

### Cache Hit Rate is Low (<10%)

**Possible causes**:
1. Users asking unique questions each time
2. Cache TTL too short (5 minutes)
3. Not enough repeat queries

**Solutions**:
- Normal for diverse conversations
- Consider increasing TTL if queries are similar
- Check cache recommendations in stats

### Convergence Not Detecting

**Possible causes**:
1. Agents genuinely disagree
2. Threshold too high (70%)
3. Only runs after round 2

**Verify**:
- Check logs for convergence scores
- Look for "convergence: false" in logs
- Make sure you have 2+ rounds configured

### Voting Tests Fail

**Check**:
1. Are all services running? (`npm start`)
2. Is Ollama running?
3. Check logs for error messages

```bash
# Check service health
curl http://localhost:3000/api/health

# Check agent status
curl http://localhost:3000/status
```

---

## 📚 Additional Resources

- **Full Report**: See `BUG-FIX-AND-ENHANCEMENTS-REPORT.md`
- **Main README**: See `README.md`
- **Test Files**: See `tests/` directory

---

## 💡 Tips

1. **Monitor cache regularly** to ensure good performance
2. **Use convergence detection** for research sessions with 3+ rounds
3. **Run tests after updates** to catch regressions
4. **Clear cache** if you suspect stale responses

---

**Last Updated**: December 2, 2025
**Version**: 3.1.0
