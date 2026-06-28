import { createRequire } from "node:module";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./_core/trpc";

const require = createRequire(import.meta.url);
const { loadArtEdition } = require("../server/lib/pythhArtGenerator") as {
  loadArtEdition: (date: string) => Promise<Record<string, unknown> | null>;
};
const { buildArtDownload } = require("../server/lib/signalArtExport") as {
  buildArtDownload: (
    edition: Record<string, unknown>,
    format: string
  ) => Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
};
const { deriveThumbnailUrl } = require("../server/lib/signalArtGemini") as {
  deriveThumbnailUrl: (url: string | null | undefined) => string | null;
};

function toDownloadEdition(row: Record<string, unknown>) {
  const snap = (row.signal_snapshot as Record<string, unknown>) || {};
  return {
    edition_date: row.edition_date as string,
    seed: row.seed as number,
    svg: row.svg as string,
    copy: row.copy as Record<string, unknown>,
    raster_url: (row.raster_url as string) ?? (snap.raster_url as string) ?? null,
    generated_at: row.generated_at as string,
  };
}

export const artRouter = router({
  downloadEdition: protectedProcedure
    .input(
      z.object({
        editionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        format: z.enum(["pdf", "png", "jpg", "svg"]).default("pdf"),
      })
    )
    .mutation(async ({ input }) => {
      const row = await loadArtEdition(input.editionDate);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
      }

      const edition = toDownloadEdition(row);
      let result: { buffer: Buffer; filename: string; mimeType: string };
      try {
        result = await buildArtDownload(edition, input.format);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Export failed";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }

      return {
        base64: result.buffer.toString("base64"),
        filename: result.filename,
        mimeType: result.mimeType,
      };
    }),
});

export type ArtGalleryItem = {
  edition_date: string;
  title: string | null;
  subtitle: string | null;
  layout_mode: string | null;
  thumbnail_url: string | null;
  generated_at: string;
};

export function toArtGalleryItem(row: Record<string, unknown>): ArtGalleryItem {
  const snap = (row.signal_snapshot as Record<string, unknown>) || {};
  const signalArt = (snap.signal_art as Record<string, unknown>) || {};
  const copy = (row.copy as Record<string, unknown>) || {};
  const rasterUrl = (snap.raster_url as string) ?? null;
  return {
    edition_date: row.edition_date as string,
    title: (copy.title as string) ?? null,
    subtitle: (copy.subtitle as string) ?? null,
    layout_mode: (signalArt.layoutMode as string) ?? (copy.layout_mode as string) ?? null,
    thumbnail_url: (snap.thumbnail_url as string) ?? deriveThumbnailUrl(rasterUrl) ?? null,
    generated_at: row.generated_at as string,
  };
}
