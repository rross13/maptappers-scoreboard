/**
 * Points the Drizzle client at the scratch database before any module that
 * imports it is loaded. Integration tests truncate between suites, so this must
 * never be the development database.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const url =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER}@localhost:5432/maptappers_test`;

if (!/_test(\b|$)/.test(new URL(url).pathname)) {
  throw new Error(
    `Refusing to run integration tests against ${url} — the database name must end in _test.`,
  );
}

process.env.DATABASE_URL = url;
