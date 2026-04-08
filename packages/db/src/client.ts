import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sql = neon(process.env.DATABASE_URL);
  return drizzle({ client: sql, schema });
}

export type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase() {
  if (!database) {
    database = createDatabase();
  }

  return database;
}
