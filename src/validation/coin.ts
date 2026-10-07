export interface CoinInput {
  cmcId: number;
  symbol: string;
  name: string;
}

export function parseId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function parseCoinInput(value: unknown): CoinInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);

  if (
    keys.length !== 3 ||
    !keys.includes("cmcId") ||
    !keys.includes("symbol") ||
    !keys.includes("name")
  ) {
    return null;
  }

  if (
    typeof input.cmcId !== "number" ||
    !Number.isSafeInteger(input.cmcId) ||
    input.cmcId <= 0
  ) {
    return null;
  }

  if (
    typeof input.symbol !== "string" ||
    !/^[A-Z0-9]{2,15}$/.test(input.symbol)
  ) {
    return null;
  }

  if (
    typeof input.name !== "string" ||
    input.name.trim().length === 0 ||
    input.name.trim().length > 100
  ) {
    return null;
  }

  return {
    cmcId: input.cmcId,
    symbol: input.symbol,
    name: input.name.trim(),
  };
}
