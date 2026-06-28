import express, { type Express, type Request, type Response } from "express";
import fs from "node:fs";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server): Promise<void> {
  const vite = await createViteServer({
    root: __dirname,
    server: { middlewareMode: true, hmr: { server } },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use(async (req: Request, res: Response, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }
    try {
      const template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express): void {
  const dist = path.resolve(__dirname, "dist");
  app.use(express.static(dist, { index: false }));
  app.use((req: Request, res: Response, next) => {
    if (req.path.startsWith("/api") || req.method !== "GET") {
      next();
      return;
    }
    res.sendFile(path.join(dist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}
