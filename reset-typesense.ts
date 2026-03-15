import fs from "fs";
import path from "path";

// Manually load .env file
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^"|"$/g, "");
        process.env[key] = value;
      }
    });
    console.log("Loaded .env file");
  } else {
    console.warn("No .env file found");
  }
} catch (e) {
  console.error("Failed to load .env file:", e);
}

// Check for API Key
if (!process.env.TYPESENSE_API_KEY) {
  console.error(
    "Error: TYPESENSE_API_KEY is missing in .env or environment variables."
  );
  process.exit(1);
}

// Dynamic imports to ensure process.env is populated before module initialization
async function run() {
  try {
    const { getTypesenseClient, PRODUCTS_COLLECTION, productsSchema } =
      await import("./src/lib/search/typesense-client");
    const { syncAllProductsToIndex } = await import("./src/lib/search/actions");

    const client = getTypesenseClient();

    console.log("Checking connection to Typesense...");
    try {
      await client.health.retrieve();
      console.log("Typesense is reachable.");
    } catch (e: any) {
      console.error("Failed to connect to Typesense:", e.message);
      if (e.code === "ECONNREFUSED") {
        console.error("Please ensure Typesense is running and reachable.");
      }
      process.exit(1);
    }

    console.log(`Deleting collection ${PRODUCTS_COLLECTION}...`);
    try {
      await client.collections(PRODUCTS_COLLECTION).delete();
      console.log("Collection deleted.");
    } catch (e: any) {
      if (e.status === 404) {
        console.log("Collection did not exist.");
      } else {
        throw e;
      }
    }

    console.log("Creating new schema...");
    await client.collections().create(productsSchema as any);
    console.log("Schema created.");

    console.log("Starting sync...");
    const result = await syncAllProductsToIndex();
    console.log("Sync result:", result);
  } catch (e: any) {
    console.error("An error occurred:", e);
    process.exit(1);
  }
}

run();
