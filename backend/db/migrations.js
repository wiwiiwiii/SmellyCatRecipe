const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, "migrations");

function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right))
    .map((fileName) => ({
      id: path.basename(fileName, ".sql"),
      fileName,
      path: path.join(migrationsDir, fileName),
    }));
}

async function runMigrations({ executor, migrationsDir = DEFAULT_MIGRATIONS_DIR } = {}) {
  if (!executor) {
    throw new Error("migration executor is required");
  }

  await executor.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const appliedResponse = await executor.query("select id from schema_migrations order by id");
  const appliedIds = new Set(appliedResponse.rows.map((row) => row.id));
  const result = {
    applied: [],
    skipped: [],
  };

  for (const migration of listMigrationFiles(migrationsDir)) {
    if (appliedIds.has(migration.id)) {
      result.skipped.push(migration.id);
      continue;
    }

    const sql = fs.readFileSync(migration.path, "utf8");
    await executor.transaction(async (tx) => {
      await tx.query(sql);
      await tx.query("insert into schema_migrations (id) values ($1)", [migration.id]);
    });
    result.applied.push(migration.id);
  }

  return result;
}

async function runCli() {
  const command = process.argv[2] || "up";
  if (command !== "up") {
    throw new Error(`Unsupported migration command: ${command}`);
  }

  const { createPoolFromEnv } = require("./pool");
  const { createPostgresExecutor } = require("./postgres-executor");
  const pool = createPoolFromEnv();
  const executor = createPostgresExecutor(pool);

  try {
    const result = await runMigrations({ executor });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  listMigrationFiles,
  runMigrations,
};
