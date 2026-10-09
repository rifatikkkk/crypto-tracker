import { jest } from "@jest/globals";

const { createPriceSync } = await import("../dist/jobs/price-sync.js");

const price = {
  cmcId: 1,
  symbol: "BTC",
  currency: "USD",
  price: "100",
  updatedAt: "2026-10-08T10:00:00.000Z",
};

test("updates all coins and continues after one error", async () => {
  const getCurrentPrice = jest
    .fn()
    .mockRejectedValueOnce(new Error("Provider unavailable"))
    .mockResolvedValueOnce(price);

  const savePrice = jest.fn();
  const onError = jest.fn();

  const sync = createPriceSync(60000, {
    listCoins: () => [
      { id: 1, cmcId: 1 },
      { id: 2, cmcId: 1027 },
    ],
    getCurrentPrice,
    savePrice,
    onError,
  });

  await sync.runOnce();

  expect(getCurrentPrice).toHaveBeenCalledTimes(2);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0]).toBe(1);
  expect(savePrice).toHaveBeenCalledWith(2, price);
});

test("does not overlap runs and stops after the current coin", async () => {
  let finishRequest;

  const pendingPrice = new Promise((resolve) => {
    finishRequest = resolve;
  });

  const getCurrentPrice = jest.fn(() => pendingPrice);
  const savePrice = jest.fn();

  const sync = createPriceSync(60000, {
    listCoins: () => [
      { id: 1, cmcId: 1 },
      { id: 2, cmcId: 1027 },
    ],
    getCurrentPrice,
    savePrice,
    onError: jest.fn(),
  });

  const firstRun = sync.runOnce();
  const secondRun = sync.runOnce();

  expect(getCurrentPrice).toHaveBeenCalledTimes(1);

  const stopping = sync.stop();
  finishRequest(price);

  await Promise.all([firstRun, secondRun, stopping]);

  expect(savePrice).toHaveBeenCalledTimes(1);
  expect(getCurrentPrice).toHaveBeenCalledTimes(1);
});

test("starts immediately and schedules the next cycle", async () => {
  jest.useFakeTimers();

  try {
    const getCurrentPrice = jest.fn().mockResolvedValue(price);

    const sync = createPriceSync(60000, {
      listCoins: () => [{ id: 1, cmcId: 1 }],
      getCurrentPrice,
      savePrice: jest.fn(),
      onError: jest.fn(),
    });

    sync.start();

    await jest.advanceTimersByTimeAsync(0);
    expect(getCurrentPrice).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60000);
    expect(getCurrentPrice).toHaveBeenCalledTimes(2);

    await sync.stop();

    await jest.advanceTimersByTimeAsync(60000);
    expect(getCurrentPrice).toHaveBeenCalledTimes(2);
  } finally {
    jest.useRealTimers();
  }
});

test("reports a database read error without crashing", async () => {
  const onError = jest.fn();
  const getCurrentPrice = jest.fn();
  const savePrice = jest.fn();

  const sync = createPriceSync(60000, {
    listCoins: () => {
      throw new Error("Database unavailable");
    },
    getCurrentPrice,
    savePrice,
    onError,
  });

  await sync.runOnce();

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0]).toBeNull();
  expect(getCurrentPrice).not.toHaveBeenCalled();
  expect(savePrice).not.toHaveBeenCalled();
});
