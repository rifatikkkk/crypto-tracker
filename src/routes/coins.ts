import { Router } from "express";
import {
  createCoin,
  deleteCoin,
  getCoin,
  getCoinByCmcId,
  listCoins,
  updateCoin,
} from "../repositories/coin.ts";
import { parseCoinInput, parseId } from "../validation/coin.ts";
import { getCurrentPrice } from "../clients/coinmarketcap.ts";
import { listPriceHistory } from "../repositories/price-history.ts";

export const coinsRouter = Router();

coinsRouter.post("/", (request, response) => {
  const input = parseCoinInput(request.body);

  if (!input) {
    response.status(400).json({ error: "Invalid coin data" });
    return;
  }

  if (getCoinByCmcId(input.cmcId)) {
    response.status(409).json({ error: "Coin already exists" });
    return;
  }

  response.status(201).json(createCoin(input));
});

coinsRouter.get("/", (_request, response) => {
  response.json(listCoins());
});

coinsRouter.get("/:id", (request, response) => {
  const id = parseId(request.params.id);

  if (id === null) {
    response.status(400).json({ error: "Invalid coin ID" });
    return;
  }

  const coin = getCoin(id);

  if (!coin) {
    response.status(404).json({ error: "Coin not found" });
    return;
  }

  response.json(coin);
});

coinsRouter.patch("/:id", (request, response) => {
  const id = parseId(request.params.id);
  const input = parseCoinInput(request.body);

  if (id === null || !input) {
    response.status(400).json({ error: "Invalid coin ID or data" });
    return;
  }

  if (!getCoin(id)) {
    response.status(404).json({ error: "Coin not found" });
    return;
  }

  const existingCoin = getCoinByCmcId(input.cmcId);

  if (existingCoin && existingCoin.id !== id) {
    response.status(409).json({ error: "Coin already exists" });
    return;
  }

  response.json(updateCoin(id, input));
});

coinsRouter.delete("/:id", (request, response) => {
  const id = parseId(request.params.id);

  if (id === null) {
    response.status(400).json({ error: "Invalid coin ID" });
    return;
  }

  if (!deleteCoin(id)) {
    response.status(404).json({ error: "Coin not found" });
    return;
  }

  response.status(204).send();
});

coinsRouter.get("/:id/price", async (request, response) => {
  const id = parseId(request.params.id);

  if (id === null) {
    response.status(400).json({ error: "Invalid coin ID" });
    return;
  }

  if (Object.keys(request.query).length > 0) {
    response.status(400).json({
      error: "Query parameters are not supported",
    });
    return;
  }

  const coin = getCoin(id);

  if (!coin) {
    response.status(404).json({ error: "Coin not found" });
    return;
  }

  const price = await getCurrentPrice(coin.cmcId);

  response.json({
    coinId: coin.id,
    ...price,
  });
});

coinsRouter.get("/:id/history", (request, response) => {
  const id = parseId(request.params.id);

  if (id === null) {
    response.status(400).json({ error: "Invalid coin ID" });
    return;
  }

  const queryKeys = Object.keys(request.query);

  if (queryKeys.some((key) => key !== "limit")) {
    response.status(400).json({ error: "Unsupported query parameter" });
    return;
  }

  let limit = 100;

  if (request.query.limit !== undefined) {
    const value = request.query.limit;

    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
      response.status(400).json({ error: "Invalid limit" });
      return;
    }

    limit = Number(value);

    if (!Number.isSafeInteger(limit) || limit > 100) {
      response.status(400).json({ error: "Invalid limit" });
      return;
    }
  }

  const coin = getCoin(id);

  if (!coin) {
    response.status(404).json({ error: "Coin not found" });
    return;
  }

  response.json(listPriceHistory(coin.id, limit));
});
