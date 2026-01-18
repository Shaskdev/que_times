import 'dotenv/config';
import { getAccessToken } from "./auth";

const CHARACTER_NAME = "bigbrainwiz";
const REALM_SLUG = "malganis";
const REGION = "us";

async function fetchPvPSummary(token: string) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${REALM_SLUG}/${CHARACTER_NAME.toLowerCase()}/pvp-summary?namespace=profile-${REGION}&locale=en_US`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PvP summary: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchPvPBracket(token: string, bracket: string) {
  const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${REALM_SLUG}/${CHARACTER_NAME.toLowerCase()}/pvp-bracket/${bracket}?namespace=profile-${REGION}&locale=en_US`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null; // No data for this bracket
    }
    throw new Error(`Failed to fetch bracket ${bracket}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  const token = await getAccessToken();
  console.log("Got access token:", token.substring(0, 20) + "...\n");

  // Fetch PvP summary
  console.log(`Fetching PvP data for ${CHARACTER_NAME} on ${REALM_SLUG}...\n`);
  const pvpSummary = await fetchPvPSummary(token);

  console.log("=== PvP Summary ===");
  console.log(JSON.stringify(pvpSummary, null, 2));

  // Fetch the brackets listed in the PvP summary
  const brackets = [
    "shuffle-priest-shadow",
    "blitz-priest-shadow",
  ];

  console.log("\n=== Solo Shuffle Data ===");
  const shuffleData = await fetchPvPBracket(token, "shuffle-priest-shadow");
  if (shuffleData) {
    console.log(JSON.stringify(shuffleData, null, 2));
  }

  console.log("\n=== Blitz Data ===");
  const blitzData = await fetchPvPBracket(token, "blitz-priest-shadow");
  if (blitzData) {
    console.log(JSON.stringify(blitzData, null, 2));
  }
}

main().catch(console.error);

