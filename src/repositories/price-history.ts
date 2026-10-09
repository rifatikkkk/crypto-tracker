import { db } from "../db/database.ts";
import type { CurrentPrice } from "../clients/coinmarketcap.ts";

export interface PriceRecord {
  id: number;
  coinId: number;
  price: string;
  currency: string;
  recordedAt: string;
}

export const savePrice = (coinId: number, currentPrice: CurrentPrice): void => {
  db.prepare(
    `
        INSERT INTO price_history (
            coin_id,
            price,
            currency,
            recorded_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT (coin_id, currency, recorded_at) DO NOTHING
        `,
  ).run(
    coinId,
    currentPrice.price,
    currentPrice.currency,
    currentPrice.updatedAt,
  );
};

export const listPriceHistory = (
  coinId: number,
  limit: number,
): PriceRecord[] => {
  return db
    .prepare(
      `
        SELECT 
          id,
          coin_id AS coinId,
          price,
          currency,
          recorded_at AS recordedAt 
        FROM price_history
        WHERE coin_id = ? 
        ORDER BY recorded_at DESC, id DESC
        LIMIT?
        `,
    )
    .all(coinId, limit) as unknown as PriceRecord[];
};
