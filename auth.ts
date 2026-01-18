const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID!;
  const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET!;

  const TOKEN_URL = "https://oauth.battle.net/token";

  interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
  }

  export async function getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
    }

    const data: TokenResponse = await response.json();
    return data.access_token;
  }