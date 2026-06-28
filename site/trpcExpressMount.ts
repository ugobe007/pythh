import type { Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./context";

/** Register the Pythh tRPC API on an existing Express app (Fly / local API server). */
export function mountPythhTrpc(app: Express): void {
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
}
