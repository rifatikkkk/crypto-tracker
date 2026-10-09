import express, { type ErrorRequestHandler } from "express";
import { requireApiKey } from "./middleware/auth.ts";
import { coinsRouter } from "./routes/coins.ts";
import { isHttpError } from "./errors/http-error.ts";

export const app = express();

app.use(express.json());

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/coins", requireApiKey, coinsRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Invalid JSON" });
    return;
  }

  if (isHttpError(error)) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);
