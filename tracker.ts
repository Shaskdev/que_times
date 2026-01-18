import 'dotenv/config';
import { getAccessToken } from './auth';
import { getOrCreateCharacter, processSnapshot, getRatingChanges, closeDb, PvPBracketData } from './db';

// Configuration
const CONFIG = {
  characterName: 'bigbrainwiz',
  realmSlug: 'malganis',
  region: 'us',
  brackets: ['shuffle-priest-shadow', 'blitz-priest-shadow'],
  pollIntervalMs: 5 * 60 * 1000, // 5 minutes
};

async function fetchPvPBracket(token: string, bracket: string): Promise<PvPBracketData | null> {
  const url = `https://${CONFIG.region}.api.blizzard.com/profile/wow/character/${CONFIG.realmSlug}/${CONFIG.characterName.toLowerCase()}/pvp-bracket/${bracket}?namespace=profile-${CONFIG.region}&locale=en_US`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch bracket ${bracket}: ${response.status}`);
  }

  return response.json();
}

async function pollOnce() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Polling for changes...`);

  try {
    const token = await getAccessToken();
    const characterId = getOrCreateCharacter(CONFIG.characterName, CONFIG.realmSlug, CONFIG.region);

    for (const bracket of CONFIG.brackets) {
      const data = await fetchPvPBracket(token, bracket);

      if (data) {
        console.log(`  ${bracket}: Rating ${data.rating}, Played ${data.season_match_statistics.played}`);
        const result = processSnapshot(characterId, bracket, data);

        if (result.changed) {
          console.log(`  >>> CHANGE DETECTED! Rating ${result.ratingChange! >= 0 ? '+' : ''}${result.ratingChange}`);
        }
      } else {
        console.log(`  ${bracket}: No data`);
      }
    }
  } catch (error) {
    console.error(`Error during poll:`, error);
  }
}

async function showStats() {
  const characterId = getOrCreateCharacter(CONFIG.characterName, CONFIG.realmSlug, CONFIG.region);

  for (const bracket of CONFIG.brackets) {
    const changes = getRatingChanges(characterId, bracket);

    if (changes.length === 0) {
      console.log(`\n${bracket}: No rating changes recorded yet`);
      continue;
    }

    console.log(`\n=== ${bracket} Rating History ===`);
    console.log('Timestamp                  | Rating Change | W/L    | New Rating');
    console.log('-'.repeat(70));

    for (const change of changes) {
      const sign = change.rating_change >= 0 ? '+' : '';
      const wl = `${change.games_won}W/${change.games_lost}L`;
      console.log(
        `${change.timestamp} | ${sign}${change.rating_change.toString().padStart(6)} | ${wl.padEnd(6)} | ${change.new_rating}`
      );
    }

    // Time of day analysis
    console.log(`\n--- Time of Day Analysis ---`);
    const hourlyStats: { [hour: number]: { games: number; ratingChange: number; wins: number; losses: number } } = {};

    for (const change of changes) {
      const hour = new Date(change.timestamp).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { games: 0, ratingChange: 0, wins: 0, losses: 0 };
      }
      hourlyStats[hour].games += change.games_played;
      hourlyStats[hour].ratingChange += change.rating_change;
      hourlyStats[hour].wins += change.games_won;
      hourlyStats[hour].losses += change.games_lost;
    }

    const sortedHours = Object.entries(hourlyStats).sort((a, b) => Number(a[0]) - Number(b[0]));

    for (const [hour, stats] of sortedHours) {
      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
      const sign = stats.ratingChange >= 0 ? '+' : '';
      const winRate = stats.games > 0 ? ((stats.wins / stats.games) * 100).toFixed(1) : '0.0';
      console.log(
        `  ${hourStr}: ${stats.games} games, ${sign}${stats.ratingChange} rating, ${winRate}% win rate`
      );
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--stats')) {
    await showStats();
    closeDb();
    return;
  }

  if (args.includes('--once')) {
    await pollOnce();
    closeDb();
    return;
  }

  // Continuous polling mode
  console.log('Starting PvP tracker...');
  console.log(`Character: ${CONFIG.characterName} (${CONFIG.realmSlug})`);
  console.log(`Brackets: ${CONFIG.brackets.join(', ')}`);
  console.log(`Poll interval: ${CONFIG.pollIntervalMs / 1000 / 60} minutes`);
  console.log('Press Ctrl+C to stop.\n');

  // Initial poll
  await pollOnce();

  // Set up interval
  const interval = setInterval(pollOnce, CONFIG.pollIntervalMs);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    clearInterval(interval);
    closeDb();
    process.exit(0);
  });
}

main().catch(console.error);
