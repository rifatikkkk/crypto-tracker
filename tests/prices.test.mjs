import { jest } from "@jest/globals";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import axios, { AxiosError } from "axios";
import request from "supertest";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "crypto-prices-"));

process.env.DATABASE_PATH = join(temporaryDirectory, "test.sqlite");
process.env.API_KEY = "test-api-key";

const { app } = await import("../dist/app.js");
const { db } = await import("../dist/db/database.js");
const { createCoin } = await import("../dist/repositories/coin.js");

const updatedAt = "2026-10-08T09:05:05.000Z";

const authorized = () => ({
  Authorization: `Bearer ${process.env.API_KEY}`,
});

const cmcResponse = (price = 82981.8237464411) => {
  return {
    status: {
      error_code: "0",
    },
    data: [
      {
        id: 1,
        name: "Bitcoin",
        symbol: "BTC",
        quote: [
          {
            id: 2781,
            symbol: "USD",
            price,
            last_updated: updatedAt,
          },
        ],
      },
    ],
  };
};

let coin;
let getMock;

beforeEach(() => {
  process.env.CMC_API_KEY = "test-cmc-key";
  process.env.CMC_TIMEOUT_MS = "5000";

  db.exec("DELETE FROM price_history; DELETE FROM coins;");

  coin = createCoin({
    cmcId: 1,
    symbol: "BTC",
    name: "Bitcoin",
  });
  getMock = jest
    .spyOn(axios, "get")
    .mockRejectedValue(new Error("Unexpected external request"));
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  db.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("GET /coins/:id/price returns the current USD price", async () => {
  getMock.mockResolvedValueOnce({
    data: cmcResponse(),
  });

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    coinId: coin.id,
    cmcId: 1,
    symbol: "BTC",
    currency: "USD",
    price: "82981.8237464411",
    updatedAt,
  });
});

test("sends CoinMarketCap ID, USD and timeout to the provider", async () => {
  getMock.mockResolvedValueOnce({
    data: cmcResponse(),
  });

  await request(app).get(`/coins/${coin.id}/price`).set(authorized());

  expect(getMock).toHaveBeenCalledTimes(1);
  expect(getMock).toHaveBeenCalledWith(
    "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest",
    expect.objectContaining({
      params: {
        id: "1",
        convert: "USD",
      },
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": "test-cmc-key",
      },
      timeout: 5000,
    }),
  );
});

test("does not save a price to history yet", async () => {
  getMock.mockResolvedValueOnce({
    data: cmcResponse(),
  });

  await request(app).get(`/coins/${coin.id}/price`).set(authorized());

  const result = db
    .prepare("SELECT COUNT(*) AS count FROM price_history")
    .get();

  expect(result.count).toBe(0);
});

test.each(["abc", "0", "-1", "1.5"])(
  "rejects invalid coin ID %s",
  async (id) => {
    const response = await request(app)
      .get(`/coins/${id}/price`)
      .set(authorized());

    expect(response.status).toBe(400);
    expect(getMock).not.toHaveBeenCalled();
  },
);

test("rejects unsupported query parameters", async () => {
  const response = await request(app)
    .get(`/coins/${coin.id}/price?currency=EUR`)
    .set(authorized());

  expect(response.status).toBe(400);
  expect(getMock).not.toHaveBeenCalled();
});

test("returns 404 when the coin is not tracked", async () => {
  const response = await request(app)
    .get("/coins/999999/price")
    .set(authorized());

  expect(response.status).toBe(404);
  expect(getMock).not.toHaveBeenCalled();
});

test("returns 401 without the service API key", async () => {
  const response = await request(app).get(`/coins/${coin.id}/price`);

  expect(response.status).toBe(401);
  expect(getMock).not.toHaveBeenCalled();
});

test("returns 401 with an incorrect service API key", async () => {
  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set("Authorization", "Bearer wrong-key");

  expect(response.status).toBe(401);
  expect(getMock).not.toHaveBeenCalled();
});

test("returns 504 when CoinMarketCap times out", async () => {
  getMock.mockRejectedValueOnce(new AxiosError("timeout", "ECONNABORTED"));

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(504);
  expect(response.body.error).toEqual(expect.any(String));
});

test("returns 503 when CoinMarketCap rate limits the request", async () => {
  const error = new AxiosError("rate limit", "ERR_BAD_REQUEST");
  error.response = { status: 429 };

  getMock.mockRejectedValueOnce(error);

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(503);
});

test("returns 502 on a network error", async () => {
  getMock.mockRejectedValueOnce(
    new AxiosError("connection failed", "ECONNRESET"),
  );

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(502);
});

test("returns 502 when CoinMarketCap reports an error", async () => {
  const payload = cmcResponse();
  payload.status.error_code = "1001";

  getMock.mockResolvedValueOnce({ data: payload });

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(502);
});

test("returns 502 when the response has no coin data", async () => {
  getMock.mockResolvedValueOnce({
    data: {
      status: { error_code: "0" },
      data: [],
    },
  });

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(502);
});

test("returns 502 for an invalid price", async () => {
  getMock.mockResolvedValueOnce({
    data: cmcResponse(-1),
  });

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(502);
});

test("returns 500 when CMC_API_KEY is missing", async () => {
  delete process.env.CMC_API_KEY;

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(500);
  expect(getMock).not.toHaveBeenCalled();
});

test("returns 500 for an invalid timeout setting", async () => {
  process.env.CMC_TIMEOUT_MS = "0";

  const response = await request(app)
    .get(`/coins/${coin.id}/price`)
    .set(authorized());

  expect(response.status).toBe(500);
  expect(getMock).not.toHaveBeenCalled();
});
