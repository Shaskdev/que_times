import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, 'pvp_tracking.db');

const db = new Database(DB_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    realm_slug TEXT NOT NULL,
    region TEXT NOT NULL,
    UNIQUE(name, realm_slug, region)
  );

  CREATE TABLE IF NOT EXISTS pvp_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    bracket TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    rating INTEGER NOT NULL,
    season_played INTEGER NOT NULL,
    season_won INTEGER NOT NULL,
    season_lost INTEGER NOT NULL,
    weekly_played INTEGER NOT NULL,
    weekly_won INTEGER NOT NULL,
    weekly_lost INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE TABLE IF NOT EXISTS rating_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    bracket TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    old_rating INTEGER NOT NULL,
    new_rating INTEGER NOT NULL,
    rating_change INTEGER NOT NULL,
    games_played INTEGER NOT NULL,
    games_won INTEGER NOT NULL,
    games_lost INTEGER NOT NULL,
    FOREIGN KEY (character_id) REFERENCES characters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_character_bracket
    ON pvp_snapshots(character_id, bracket);

  CREATE INDEX IF NOT EXISTS idx_changes_character_bracket
    ON rating_changes(character_id, bracket);

  CREATE INDEX IF NOT EXISTS idx_changes_timestamp
    ON rating_changes(timestamp);
`);

export interface PvPBracketData {
  rating: number;
  season_match_statistics: {
    played: number;
    won: number;
    lost: number;
  };
  weekly_match_statistics: {
    played: number;
    won: number;
    lost: number;
  };
}

export interface RatingChange {
  timestamp: string;
  bracket: string;
  old_rating: number;
  new_rating: number;
  rating_change: number;
  games_played: number;
  games_won: number;
  games_lost: number;
}

// Get or create character
export function getOrCreateCharacter(name: string, realmSlug: string, region: string): number {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO characters (name, realm_slug, region)
    VALUES (?, ?, ?)
  `);
  insert.run(name.toLowerCase(), realmSlug.toLowerCase(), region.toLowerCase());

  const select = db.prepare(`
    SELECT id FROM characters WHERE name = ? AND realm_slug = ? AND region = ?
  `);
  const row = select.get(name.toLowerCase(), realmSlug.toLowerCase(), region.toLowerCase()) as { id: number };
  return row.id;
}

// Get the latest snapshot for a character/bracket
export function getLatestSnapshot(characterId: number, bracket: string) {
  const stmt = db.prepare(`
    SELECT * FROM pvp_snapshots
    WHERE character_id = ? AND bracket = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);
  return stmt.get(characterId, bracket) as {
    rating: number;
    season_played: number;
    season_won: number;
    season_lost: number;
    weekly_played: number;
    weekly_won: number;
    weekly_lost: number;
  } | undefined;
}

// Save a new snapshot
export function saveSnapshot(characterId: number, bracket: string, data: PvPBracketData) {
  const stmt = db.prepare(`
    INSERT INTO pvp_snapshots (
      character_id, bracket, rating,
      season_played, season_won, season_lost,
      weekly_played, weekly_won, weekly_lost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    characterId,
    bracket,
    data.rating,
    data.season_match_statistics.played,
    data.season_match_statistics.won,
    data.season_match_statistics.lost,
    data.weekly_match_statistics.played,
    data.weekly_match_statistics.won,
    data.weekly_match_statistics.lost
  );
}

// Record a rating change
export function recordRatingChange(
  characterId: number,
  bracket: string,
  oldRating: number,
  newRating: number,
  gamesPlayed: number,
  gamesWon: number,
  gamesLost: number
) {
  const stmt = db.prepare(`
    INSERT INTO rating_changes (
      character_id, bracket, old_rating, new_rating, rating_change,
      games_played, games_won, games_lost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    characterId,
    bracket,
    oldRating,
    newRating,
    newRating - oldRating,
    gamesPlayed,
    gamesWon,
    gamesLost
  );
}

// Get rating changes for analysis
export function getRatingChanges(characterId: number, bracket?: string): RatingChange[] {
  let query = `
    SELECT timestamp, bracket, old_rating, new_rating, rating_change,
           games_played, games_won, games_lost
    FROM rating_changes
    WHERE character_id = ?
  `;

  const params: (number | string)[] = [characterId];

  if (bracket) {
    query += ` AND bracket = ?`;
    params.push(bracket);
  }

  query += ` ORDER BY timestamp ASC`;

  const stmt = db.prepare(query);
  return stmt.all(...params) as RatingChange[];
}

// Check for changes and record them
export function processSnapshot(
  characterId: number,
  bracket: string,
  currentData: PvPBracketData
): { changed: boolean; ratingChange?: number } {
  const lastSnapshot = getLatestSnapshot(characterId, bracket);

  // Always save the current snapshot
  saveSnapshot(characterId, bracket, currentData);

  if (!lastSnapshot) {
    console.log(`First snapshot recorded for bracket: ${bracket}`);
    return { changed: false };
  }

  // Check if games were played (season_played increased)
  const gamesPlayedDiff = currentData.season_match_statistics.played - lastSnapshot.season_played;

  if (gamesPlayedDiff > 0) {
    const gamesWonDiff = currentData.season_match_statistics.won - lastSnapshot.season_won;
    const gamesLostDiff = currentData.season_match_statistics.lost - lastSnapshot.season_lost;
    const ratingChange = currentData.rating - lastSnapshot.rating;

    recordRatingChange(
      characterId,
      bracket,
      lastSnapshot.rating,
      currentData.rating,
      gamesPlayedDiff,
      gamesWonDiff,
      gamesLostDiff
    );

    console.log(`Rating change detected! ${lastSnapshot.rating} -> ${currentData.rating} (${ratingChange >= 0 ? '+' : ''}${ratingChange})`);
    console.log(`Games: +${gamesPlayedDiff} played, +${gamesWonDiff} won, +${gamesLostDiff} lost`);

    return { changed: true, ratingChange };
  }

  return { changed: false };
}

export function closeDb() {
  db.close();
}

export default db;
