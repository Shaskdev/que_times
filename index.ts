import 'dotenv/config';
import { getAccessToken } from "./auth";

  async function main() {
    const token = await getAccessToken();
    console.log("Got access token:", token.substring(0, 20) + "...");

    // Test with a simple API call
    const response = await fetch(
      "https://us.api.blizzard.com/data/wow/realm/index?namespace=dynamic-us&locale=en_US",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const realms = await response.json() as { realms: any[]};
    console.log(`Found ${realms.realms.length} realms`);
  }

  main().catch(console.error);

