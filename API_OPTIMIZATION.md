# API Optimization & Season Data Aggregation Guide

## Current Endpoint Usage & Rate Limits

### ✅ Endpoints You're Using Correctly

| Endpoint                       | Rate Limit                  | Usage                               |
| ------------------------------ | --------------------------- | ----------------------------------- |
| `account-v1` - GET by riot-id  | 20,000/10s, 1,200,000/10min | Getting PUUID from gameName#tagLine |
| `summoner-v4` - GET by PUUID   | 1,600/1min                  | Getting profile icon & level        |
| `match-v5` - GET match IDs     | 2,000/10s                   | Getting list of match IDs           |
| `match-v5` - GET match details | 2,000/10s                   | Getting detailed match data         |

### ✅ Recently Optimized

| Endpoint    | Previous                       | Now              | Improvement                       |
| ----------- | ------------------------------ | ---------------- | --------------------------------- |
| `league-v4` | by-summoner/{id} (lower limit) | by-puuid/{puuid} | **20,000 req/10s** - Much better! |

---

## Rate Limit Issues & Solutions

### Problem: Getting 429 (Too Many Requests)

**Why it happens:**

- Fetching 20+ matches simultaneously hits the rate limit
- Each match detail request counts against: `2,000 requests / 10 seconds`

**Solutions implemented:**

1. **Retry with Exponential Backoff**
   - Automatically retries 429 errors with delays: 1s → 2s → 4s
   - Located in `fetchWithRetry()` function

2. **Staggered Requests**
   - Adds 50ms delay between each match request
   - Spreads out the load instead of hitting all at once

3. **Better Error Handling**
   - Logs which matches fail
   - Continues with other matches instead of failing completely

---

## Aggregating Season Data

### Option 1: Filter at API Level (Recommended)

Use query parameters when fetching match IDs:

```typescript
// Get only ranked solo/duo matches from current season
const response = await fetch(
  `/api/riot/matches?puuid=${puuid}&region=${region}&queue=420&startTime=${seasonStartEpoch}`
);
```

**Available Query Parameters:**

- `count`: Number of matches (default: 100, max: 100)
- `queue`: Queue ID (420 = Ranked Solo/Duo, 440 = Ranked Flex, 700 = Clash)
- `startTime`: Epoch timestamp in seconds (season start date)
- `endTime`: Epoch timestamp in seconds (season end date)

**Season 2025 Split 1 Start Date:**

```typescript
const season2025Start = Math.floor(new Date("2025-01-09").getTime() / 1000); // 1736380800
```

### Option 2: Filter After Fetching (Current Implementation)

Fetch all matches, then filter in code:

- ✅ More flexible (can change filters without re-fetching)
- ❌ More API requests
- ❌ Slower initial load

**Current implementation filters by:**

```typescript
const rankedMatches = validMatches.filter(
  (match) => isRankedQueue(match.info.queueId) // 420, 440, 700
);
```

---

## Recommended Approach for Season Stats

### For Best Performance:

1. **Fetch matches filtered by season + queue:**

```typescript
const season2025Start = Math.floor(new Date("2025-01-09").getTime() / 1000);

const matchIdsResponse = await fetch(
  `/api/riot/matches?puuid=${puuid}&region=${region}&queue=420&startTime=${season2025Start}&count=100`
);
```

2. **Benefits:**
   - Fewer matches to process
   - Faster load times
   - Less rate limit pressure
   - More accurate season-specific stats

3. **For multiple queue types:**
   Make separate requests for each queue:

```typescript
// Ranked Solo/Duo
const soloMatches = await fetch(`...&queue=420&startTime=${seasonStart}`);

// Ranked Flex
const flexMatches = await fetch(`...&queue=440&startTime=${seasonStart}`);

// Clash
const clashMatches = await fetch(`...&queue=700&startTime=${seasonStart}`);
```

---

## API Endpoint Reference

### Account

```
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
Rate: 20,000/10s, 1,200,000/10min
```

### Summoner

```
GET /lol/summoner/v4/summoners/by-puuid/{puuid}
Rate: 1,600/1min
```

### League (Rank Info)

```
GET /lol/league/v4/entries/by-puuid/{puuid}  ← Use this!
Rate: 20,000/10s, 1,200,000/10min
```

### Matches

```
GET /lol/match/v5/matches/by-puuid/{puuid}/ids
Query params: ?count=100&queue=420&startTime=1736380800&endTime=1767916800
Rate: 2,000/10s

GET /lol/match/v5/matches/{matchId}
Rate: 2,000/10s
```

---

## Queue IDs (Non-Deprecated)

| Queue ID | Type            | Notes                |
| -------- | --------------- | -------------------- |
| 420      | Ranked Solo/Duo | Primary ranked queue |
| 440      | Ranked Flex     | 5v5 Ranked Flex      |
| 700      | Clash           | Tournament games     |
| 400      | Normal Draft    | Unranked             |
| 430      | Normal Blind    | Unranked             |
| 450      | ARAM            | All Random All Mid   |
| 490      | Quickplay       | New normal queue     |
| 1700     | Arena           | 2v2v2v2 mode         |

---

## Season Timeline (2025)

| Split   | Start Date  | Epoch Timestamp |
| ------- | ----------- | --------------- |
| Split 1 | Jan 9, 2025 | 1736380800      |
| Split 2 | ~May 2025   | TBD             |
| Split 3 | ~Sep 2025   | TBD             |

---

## Best Practices

1. **Use PUUID-based endpoints** whenever available (higher rate limits)
2. **Filter at API level** using query parameters to reduce data transfer
3. **Implement retry logic** with exponential backoff for 429 errors
4. **Stagger concurrent requests** to avoid hitting rate limits
5. **Cache season start/end timestamps** instead of calculating repeatedly
6. **Consider pagination** for users with >100 matches per season

---

## Next Steps

To fully optimize for season data:

1. Add season selector UI (Split 1, Split 2, Split 3)
2. Use `startTime` and `endTime` query parameters based on selected season
3. Optional: Add queue type filter (Solo/Duo, Flex, All Ranked)
4. Display season-specific stats instead of all-time stats
5. Consider caching match data to reduce repeated API calls
