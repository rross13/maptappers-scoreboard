import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// `prepare: false` is required for transaction-pooled connections (Neon's pooler,
// PgBouncer). Harmless locally, and it means the same client works in both.
const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
