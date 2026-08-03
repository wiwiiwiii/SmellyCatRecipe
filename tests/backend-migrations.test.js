const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  listMigrationFiles,
  runMigrations,
} = require("../backend/db/migrations");

test("migration files are listed in numeric filename order", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smelly-cat-migrations-"));
  fs.writeFileSync(path.join(dir, "010_later.sql"), "select 10;");
  fs.writeFileSync(path.join(dir, "001_initial_schema.sql"), "select 1;");
  fs.writeFileSync(path.join(dir, "002_seed_menu_items.sql"), "select 2;");
  fs.writeFileSync(path.join(dir, "README.md"), "ignore me");

  const files = listMigrationFiles(dir);

  assert.deepEqual(
    files.map((item) => item.id),
    ["001_initial_schema", "002_seed_menu_items", "010_later"],
  );
});

test("migration runner applies only pending migrations and records versions", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smelly-cat-migrations-"));
  fs.writeFileSync(path.join(dir, "001_initial_schema.sql"), "create table users(id text primary key);");
  fs.writeFileSync(path.join(dir, "002_seed_menu_items.sql"), "insert into menu_items(id) values ('tomato');");
  const executor = createFakeExecutor({
    applied: ["001_initial_schema"],
  });

  const result = await runMigrations({
    executor,
    migrationsDir: dir,
  });

  assert.deepEqual(result.applied, ["002_seed_menu_items"]);
  assert.equal(
    executor.executedSql.some((sql) => sql.includes("insert into menu_items")),
    true,
  );
  assert.deepEqual(executor.recordedVersions, ["002_seed_menu_items"]);
});

function createFakeExecutor({ applied = [] } = {}) {
  return {
    executedSql: [],
    recordedVersions: [],
    async query(sql, params = []) {
      this.executedSql.push(sql);
      if (sql.includes("select id from schema_migrations")) {
        return {
          rows: applied.map((id) => ({ id })),
        };
      }
      if (sql.includes("insert into schema_migrations")) {
        this.recordedVersions.push(params[0]);
      }
      return {
        rows: [],
      };
    },
    async transaction(work) {
      return work(this);
    },
  };
}
