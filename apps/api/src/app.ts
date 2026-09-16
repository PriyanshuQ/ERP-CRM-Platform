import cors from "cors";
import express from "express";

export const healthHandler = (_request: express.Request, response: express.Response) => {
  response.json({ status: "ok", service: "erp-crm-api" });
};

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", healthHandler);

  return app;
};
