import axios from "axios";
import { httpError, isHttpError } from "../errors/http-error.ts";

const quotesUrl =
  "https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest";

export interface CurrentPrice {
  cmcId: number;
  symbol: string;
  currency: "USD";
  price: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parsePrice = (payload: unknown, cmcId: number): CurrentPrice => {
  if (isRecord(payload) && payload.status !== undefined) {
    if (
      !isRecord(payload.status) ||
      (payload.status.error_code !== 0 && payload.status.error_code !== "0")
    ) {
      throw httpError(502, "CoinMarketCap returned an error");
    }
  }

  const assets = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? payload.data
      : undefined;

  if (!Array.isArray(assets)) {
    throw httpError(502, "Invalid response from CoinMarketCap");
  }

  const asset = assets.find((item) => isRecord(item) && item.id === cmcId);

  if (
    !isRecord(asset) ||
    typeof asset.symbol !== "string" ||
    asset.symbol.trim().length === 0
  ) {
    throw httpError(502, "CoinMarketCap returned no data for this coin");
  }

  const usdQuote = Array.isArray(asset.quote)
    ? asset.quote.find((item) => isRecord(item) && item.symbol === "USD")
    : isRecord(asset.quote)
      ? asset.quote.USD
      : undefined;

  if (
    !isRecord(usdQuote) ||
    typeof usdQuote.price !== "number" ||
    !Number.isFinite(usdQuote.price) ||
    usdQuote.price < 0 ||
    typeof usdQuote.last_updated !== "string" ||
    !Number.isFinite(Date.parse(usdQuote.last_updated))
  ) {
    throw httpError(502, "Invalid price data from CoinMarketCap");
  }

  return {
    cmcId,
    symbol: asset.symbol,
    currency: "USD",
    price: String(usdQuote.price),
    updatedAt: new Date(usdQuote.last_updated).toISOString(),
  };
};

export const getCurrentPrice = async (cmcId: number): Promise<CurrentPrice> => {
  const apiKey = process.env.CMC_API_KEY?.trim();
  const timeout = Number(process.env.CMC_TIMEOUT_MS ?? 5000);

  if (!apiKey) {
    throw httpError(500, "CoinMarketCap API key is not configured");
  }

  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 60000) {
    throw httpError(500, "Invalid CoinMarketCap timeout configuration");
  }

  try {
    const response = await axios.get<unknown>(quotesUrl, {
      params: {
        id: String(cmcId),
        convert: "USD",
      },
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey,
      },
      timeout,
      maxRedirects: 0,
    });
    return parsePrice(response.data, cmcId);
  } catch (error: unknown) {
    if (isHttpError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        throw httpError(504, "CoinMarketCap request timed out");
      }

      if (error.response?.status === 429) {
        throw httpError(503, "CoinMarketCap rate limit exceeded");
      }

      throw httpError(502, "Failed to fetch price from CoinMarketCap");
    }
    throw error;
  }
};
