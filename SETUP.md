# Playmaker - League of Legends Stats App Setup

## Prerequisites

- Node.js 18+ installed
- Riot Games API Key (get from https://developer.riotgames.com/)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following content:

```env
# Riot API Key - Get yours from https://developer.riotgames.com/
RIOT_API_KEY=your_api_key_here

# Riot API Region (americas, europe, asia, sea)
RIOT_REGION=americas
```

**Important:** Replace `your_api_key_here` with your actual Riot API key.

### 3. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## How to Use

1. **Search for a Summoner:**
   - Select your specific region from the dropdown (includes North America, Brazil, LAN, LAS, Europe West, Europe Nordic & East, Türkiye, Russia, Korea, Japan, Oceania, Philippines, Singapore, Thailand, Taiwan, Vietnam)
   - Enter the summoner name with tag line in the format: `SummonerName#TagLine`
   - Examples: `hide on bush#KR1`, `Faker#KR1`, `Doublelift#NA1`
   - Click the search button or press Enter
   - You can also click on the quick search suggestions below the search bar (they automatically set the region)

2. **View Match History:**
   - After searching, you'll be redirected to the summoner's profile
   - The page displays the last 10 matches with:
     - Champion played
     - Win/Loss status
     - KDA (Kills/Deaths/Assists)
     - Items built
     - CS (Creep Score)
     - Game duration and time played

## API Routes

The app includes the following API routes:

- `/api/riot/account` - Fetch account by Riot ID (gameName + tagLine)
- `/api/riot/matches` - Get match IDs by PUUID
- `/api/riot/match` - Get detailed match data by match ID

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Riot Games API** - Match and player data

## Troubleshooting

### "Riot API key not configured" error

Make sure you've created the `.env.local` file with your API key.

### "Failed to find summoner" error

- Make sure you're using the correct format: `SummonerName#TagLine` (include the # symbol)
- Verify the summoner exists in the selected region
- Make sure your API key is valid
- Note: Tag lines are case-sensitive (e.g., KR1, NA1, EUW)

### Rate Limiting

The Riot API has rate limits. If you hit the limit, wait a minute before making more requests.

## Development Notes

- The app uses the Americas region by default
- Match history is limited to the last 10 games
- Champion images are currently shown as text placeholders (can be enhanced with Data Dragon)

## Next Steps / Enhancements

- Add champion images using Riot's Data Dragon
- Add item images
- Implement champion statistics
- Add more detailed match analytics
- Support for multiple regions
- Player rank display
- Live game tracking
