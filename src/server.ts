import { app } from "./app.ts";
import { db } from "./db/database.ts";
import { createPriceSync } from "./jobs/price-sync.ts";
import { listCoins } from "./repositories/coin.ts";
import { getCurrentPrice } from "./clients/coinmarketcap.ts";
import { savePrice } from "./repositories/price-history.ts";

const port = Number(process.env.PORT ?? 3000);
const intervalMs = Number(process.env.SYNC_INTERVAL_MS ?? 60000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

if (!Number.isSafeInteger(intervalMs) || intervalMs < 60000) {
  throw new Error("SYNC_INTERVAL_MS must be at least 60000");
}

const priceSync = createPriceSync(intervalMs, {
  listCoins,
  getCurrentPrice,
  savePrice,
  onError: (coinId, error) => {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error(`Price sync failed for coin ${coinId ?? "list"}: ${message}`);
  },
});

const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  priceSync.start();
});

let shuttingDown = false;

const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;

  shuttingDown = true;
  const serverClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  try {
    await Promise.all([priceSync.stop(), serverClosed]);

    db.close();
    process.exitCode = 0;
  } catch (error: unknown) {
    console.error("Failed to shut down cleanly", error);
    process.exitCode = 1;
  }
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
