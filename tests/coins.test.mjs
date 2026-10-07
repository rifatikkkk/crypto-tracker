import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "crypto-tracker-"));

process.env.DATABASE_PATH = join(temporaryDirectory, "test.sqlite");
process.env.API_KEY = "test-api-key";

const { app } = await import("../dist/app.js");
const { db } = await import("../dist/db/database.js");

const authorized = () => ({
  Authorization: `Bearer ${process.env.API_KEY}`,
});

const bitcoin = {
  cmcId: 1,
  symbol: "BTC",
  name: "Bitcoin",
};

beforeEach(() => {
  db.exec("DELETE FROM price_history; DELETE FROM coins;");
});

afterAll(() => {
  db.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("GET /health: returns service status", async () => {
  const response = await request(app).get("/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
});

test("GET /health: unsupported method returns 404", async () => {
  const response = await request(app).post("/health");

  expect(response.status).toBe(404);
});

test("POST /coins: creates a coin", async () => {
  const response = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject(bitcoin);
  expect(response.body.id).toEqual(expect.any(Number));
});

test("POST /coins: rejects invalid input", async () => {
  const response = await request(app)
    .post("/coins")
    .set(authorized())
    .send({ cmcId: -1, symbol: "BTCUSDT", name: "" });

  expect(response.status).toBe(400);
});

test("GET /coins: returns the stored coins", async () => {
  await request(app).post("/coins").set(authorized()).send(bitcoin);

  const response = await request(app).get("/coins").set(authorized());

  expect(response.status).toBe(200);
  expect(response.body).toHaveLength(1);
  expect(response.body[0].symbol).toBe("BTC");
});

test("GET /coins: rejects a missing API key", async () => {
  const response = await request(app).get("/coins");

  expect(response.status).toBe(401);
});

test("GET /coins/:id: returns a coin", async () => {
  const created = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  const response = await request(app)
    .get(`/coins/${created.body.id}`)
    .set(authorized());

  expect(response.status).toBe(200);
  expect(response.body.symbol).toBe("BTC");
});

test("GET /coins/:id: returns 404 for a missing coin", async () => {
  const response = await request(app).get("/coins/999999").set(authorized());

  expect(response.status).toBe(404);
});

test("PATCH /coins/:id: updates a coin", async () => {
  const created = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  const response = await request(app)
    .patch(`/coins/${created.body.id}`)
    .set(authorized())
    .send({ cmcId: 1027, symbol: "ETH", name: "Ethereum" });

  expect(response.status).toBe(200);
  expect(response.body.symbol).toBe("ETH");
});

test("PATCH /coins/:id: rejects invalid input", async () => {
  const created = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  const response = await request(app)
    .patch(`/coins/${created.body.id}`)
    .set(authorized())
    .send({ symbol: "ETH" });

  expect(response.status).toBe(400);
});

test("DELETE /coins/:id: deletes a coin", async () => {
  const created = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  const response = await request(app)
    .delete(`/coins/${created.body.id}`)
    .set(authorized());

  expect(response.status).toBe(204);
});

test("DELETE /coins/:id: returns 404 for a missing coin", async () => {
  const response = await request(app).delete("/coins/999999").set(authorized());

  expect(response.status).toBe(404);
});

test("POST /coins: rejects a duplicate CoinMarketCap ID", async () => {
  await request(app).post("/coins").set(authorized()).send(bitcoin);

  const response = await request(app)
    .post("/coins")
    .set(authorized())
    .send(bitcoin);

  expect(response.status).toBe(409);
});
