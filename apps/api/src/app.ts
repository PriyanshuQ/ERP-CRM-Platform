import cors from "cors";
import compression from "compression";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { customerRouter } from "./modules/customers/customer.router.js";

export const healthHandler = (_request: express.Request, response: express.Response) => {
  response.json({ status: "ok", service: "erp-crm-api" });
};

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false, skip: (request) => request.path === "/health" || request.path === "/ready" }));
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", healthHandler);
  app.get("/ready", (_request, response) => {
    response.json({ status: "ready", dependencies: { supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) } });
  });
  app.use("/api/v1/customers", customerRouter);

  app.use((error: Error & { statusCode?: number; name?: string }, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error.name === "ZodError") {
      response.status(422).json({ error: { code: "VALIDATION_ERROR", message: error.message } });
      return;
    }
    response.status(error.statusCode ?? 500).json({ error: { code: "REQUEST_FAILED", message: error.message } });
  });

  return app;
};
