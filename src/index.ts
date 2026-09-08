import { loadConfig } from "./config/env";
import { startBot } from "./bot";
import { closeDatabase } from "./database/db";
import { logger } from "./utils/logger";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`Configuration error: ${message}`);
    logger.error(
      "Copy .env.example to .env and fill in the required values."
    );
    process.exit(1);
  }

  const shutdown = (): void => {
    logger.info("Shutting down…");
    closeDatabase();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await startBot(config);
  } catch (error) {
    logger.error("Failed to start bot", error);
    closeDatabase();
    process.exit(1);
  }
}

main();
