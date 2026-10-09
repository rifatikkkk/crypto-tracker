import type { CurrentPrice } from "../clients/coinmarketcap.ts";

interface CoinToSync {
  id: number;
  cmcId: number;
}

export interface PriceSyncDependencies {
  listCoins: () => CoinToSync[];
  getCurrentPrice: (cmcId: number) => Promise<CurrentPrice>;
  savePrice: (coinId: number, price: CurrentPrice) => void;
  onError: (coinId: number | null, error: unknown) => void;
}

export const createPriceSync = (
  intervalMs: number,
  dependencies: PriceSyncDependencies,
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentRun: Promise<void> | null = null;
  let started = false;
  let stopped = false;

  const scheduleNextRun = (): void => {
    if (!started || stopped) return;

    timer = setTimeout(() => {
      timer = undefined;
      void runOnce();
    }, intervalMs);
  };

  const runOnce = (): Promise<void> => {
    if (stopped) return Promise.resolve();

    if (currentRun) return currentRun;

    currentRun = (async () => {
      try {
        const coins = dependencies.listCoins();

        for (const coin of coins) {
          if (stopped) break;

          try {
            const price = await dependencies.getCurrentPrice(coin.cmcId);

            dependencies.savePrice(coin.id, price);
          } catch (error: unknown) {
            dependencies.onError(coin.id, error);
          }
        }
      } catch (error: unknown) {
        dependencies.onError(null, error);
      } finally {
        currentRun = null;
        scheduleNextRun();
      }
    })();

    return currentRun;
  };

  const start = (): void => {
    if (started || stopped) return;

    started = true;
    void runOnce();
  };

  const stop = async (): Promise<void> => {
    stopped = true;
    started = false;

    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    if (currentRun) await currentRun;
  };

  return { start, runOnce, stop };
};
