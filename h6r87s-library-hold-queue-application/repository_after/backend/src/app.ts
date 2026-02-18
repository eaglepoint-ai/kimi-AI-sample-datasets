import express from "express";
import { JsonStore } from "./store";
import { createRoutes } from "./routes";

export function createApp(opts?: { dataPath?: string }) {
  const app = express();
  app.use(express.json());

  const store = new JsonStore(opts?.dataPath);

  // attach routes at /api
  app.use("/api", createRoutes(store));

  // error handler (always return { error })
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = typeof err?.status === "number" ? err.status : 500;
      const msg = err?.message ? String(err.message) : "Internal Server Error";
      res.status(status).json({ error: msg });
    },
  );

  return app;
}
