// server/db.js (CommonJS)
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

module.exports = { pool };
