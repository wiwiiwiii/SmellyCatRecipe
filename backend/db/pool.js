const { Pool } = require("pg");

function createPoolFromEnv(env = process.env) {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString,
    max: Number(env.PG_POOL_MAX || 10),
    ssl: env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

module.exports = {
  createPoolFromEnv,
};
