import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

const directory = mkdtempSync(join(tmpdir(), "crypto-history-"));

process.env.DATABASE_PATH = join(directory, "test.sqlite");
process.env.API_KEY = "test-api-key";

const { app } = await import("../dist/app.js");
const { db } = await import("../dist/db/database.js");
const { createCoin } = await import("../dist/repositories/coin.js");
const { savePrice } = await import("../dist/repositories/price-history.js");

const headers = {
  Authorization: "Bearer test-api-key",
};

let coin;

beforeEach(() => {
  db.exec("DELETE FROM price_history; DELETE FROM coins;");

  coin = createCoin({
    cmcId: 1,
    symbol: "BTC",
    name: "Bitcoin",
  });
});

afterAll(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

test("returns history from newest to oldest", async () => {
  savePrice(coin.id, {
    cmcId: 1,
    symbol: "BTC",
    currency: "USD",
    price: "100",
    updatedAt: "2026-10-08T10:00:00.000Z",
  });

  savePrice(coin.id, {
    cmcId: 1,
    symbol: "BTC",
    currency: "USD",
    price: "101",
    updatedAt: "2026-10-08T11:00:00.000Z",
  });

  const response = await request(app)
    .get(`/coins/${coin.id}/history`)
    .set(headers);

  expect(response.status).toBe(200);
  expect(response.body.map((item) => item.price)).toEqual(["101", "100"]);
});

test("applies the limit", async () => {
  for (const [index, price] of ["100", "101"].entries()) {
    savePrice(coin.id, {
      cmcId: 1,
      symbol: "BTC",
      currency: "USD",
      price,
      updatedAt: `2026-10-08T1${index}:00:00.000Z`,
    });
  }

  const response = await request(app)
    .get(`/coins/${coin.id}/history?limit=1`)
    .set(headers);

  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(1);
  expect(response.body[0].price).toBe("101");
});

test("returns an empty array when there are no prices", async () => {
  const response = await request(app)
    .get(`/coins/${coin.id}/history`)
    .set(headers);

  expect(response.status).toBe(200);
  expect(response.body).toEqual([]);
});

test.each(["0", "-1", "101", "abc"])(
  "rejects invalid limit %s",
  async (limit) => {
    const response = await request(app)
      .get(`/coins/${coin.id}/history?limit=${limit}`)
      .set(headers);

    expect(response.status).toBe(400);
  },
);

test("rejects an unknown query parameter", async () => {
  const response = await request(app)
    .get(`/coins/${coin.id}/history?currency=EUR`)
    .set(headers);

  expect(response.status).toBe(400);
});

test("rejects an invalid coin ID", async () => {
  const response = await request(app).get("/coins/abc/history").set(headers);

  expect(response.status).toBe(400);
});

test("returns 404 for an unknown coin", async () => {
  const response = await request(app).get("/coins/999999/history").set(headers);

  expect(response.status).toBe(404);
});

test("requires an API key", async () => {
  const response = await request(app).get(`/coins/${coin.id}/history`);

  expect(response.status).toBe(401);
});

test("does not duplicate the same provider snapshot", () => {
  const price = {
    cmcId: 1,
    symbol: "BTC",
    currency: "USD",
    price: "100",
    updatedAt: "2026-10-08T10:00:00.000Z",
  };

  savePrice(coin.id, price);
  savePrice(coin.id, price);

  const row = db.prepare("SELECT COUNT(*) AS count FROM price_history").get();

  expect(row.count).toBe(1);
});
