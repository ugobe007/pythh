#!/usr/bin/env node
/**
 * Prebuild today's Daily Signal edition into newsletter_editions.
 *
 * The public page reads the saved row — it does not compile on request.
 *
 *   npm run newsletter:prebuild
 *
 * Scheduled: GitHub Actions Platform Daily Batch at 05:15 UTC.
 * daily-brief (13:00 UTC) also busts and rewrites the edition before email.
 */
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prebuildNewsletter } = require('../server/newsletter-generator.js');

async function main() {
  const started = Date.now();
  const edition = await prebuildNewsletter();
  const ms = Date.now() - started;
  console.log(
    `[newsletter-prebuild] ${edition.date} · ${ms}ms · ` +
    `editorial:${edition.editorial?.source || 'n/a'} · ` +
    `trends:${edition.trendReport?.source || 'n/a'} · ` +
    `hottest:${edition.hottestStartups?.length || 0} · ` +
    `matches:${edition.topMatches?.length || 0}`,
  );
}

main().catch((err) => {
  console.error('[newsletter-prebuild]', err.message || err);
  process.exit(1);
});
