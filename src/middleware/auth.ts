import { RequestHandler } from "express";

export const requireApiKey: RequestHandler = (request, response, next) => {
  const expectedKey = process.env.API_KEY;
  const authorization = request.header("Authorization");

  if (!expectedKey) {
    response.status(500).json({ error: "API key is not configured" });
    return;
  }

  if (authorization !== `Bearer ${expectedKey}`) {
    response.status(401).json({ error: "Invalid or missing API key" });
    return;
  }

  next();
};
