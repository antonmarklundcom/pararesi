import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

declare global {
  var __dbPool: mysql.Pool | undefined;
}

// mysql2 pools don't open a connection until the first query runs, so importing
// this module never touches the network — safe during `next build` with no DB.
// Reused across HMR reloads in dev via globalThis (single process on Hostinger).
function getPool() {
  if (!global.__dbPool) {
    global.__dbPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 8,
      timezone: "Z",
    });
  }
  return global.__dbPool;
}

export const db = drizzle(getPool(), { schema, mode: "default" });
