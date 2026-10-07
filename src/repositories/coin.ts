import { db } from "../db/database.ts";
import type { CoinInput } from "../validation/coin.ts";

export interface Coin extends CoinInput {
  id: number;
  createdAt: string;
}

const coinColumns = `
    id,
    cmc_id AS cmcId,
    symbol,
    name,
    created_at AS createdAt
`;

export function listCoins(): Coin[] {
  return db
    .prepare(`SELECT ${coinColumns} FROM coins ORDER BY id`)
    .all() as unknown as Coin[];
}

export function getCoin(id: number): Coin | null {
  const coin = db
    .prepare(`SELECT ${coinColumns} FROM coins WHERE id = ?`)
    .get(id) as Coin | undefined;

  return coin ?? null;
}

export function getCoinByCmcId(cmcId: number): Coin | null {
  const coin = db
    .prepare(`SELECT ${coinColumns} FROM coins WHERE cmc_id = ?`)
    .get(cmcId) as Coin | undefined;

  return coin ?? null;
}

export function createCoin(input: CoinInput): Coin {
  const createdAt = new Date().toISOString();

  const result = db
    .prepare(
      `
      INSERT INTO coins (cmc_id, symbol, name, created_at)
      VALUES (?, ?, ?, ?)
    `,
    )
    .run(input.cmcId, input.symbol, input.name, createdAt);

  return getCoin(Number(result.lastInsertRowid))!;
}

export function updateCoin(id: number, input: CoinInput): Coin {
  db.prepare(
    `
        UPDATE coins
        SET cmc_id = ?, symbol = ?, name = ?
        WHERE id = ?
        `,
  ).run(input.cmcId, input.symbol, input.name, id);

  return getCoin(id)!;
}

export function deleteCoin(id: number): boolean {
  const result = db.prepare(`DELETE FROM coins WHERE id = ?`).run(id);
  return Number(result.changes) > 0;
}
