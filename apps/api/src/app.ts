import cors from "cors";
import express from "express";
import { customerRouter } from "./modules/customers/customer.router.js";

export const healthHandler = (_request: express.Request, response: express.Response) => {
  response.json({ status: "ok", service: "erp-crm-api" });
};

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", healthHandler);
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
