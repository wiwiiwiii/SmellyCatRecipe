const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("initial postgres schema contains migration and order tables", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../backend/db/migrations/001_initial_schema.sql"),
    "utf8",
  );

  for (const tableName of [
    "users",
    "menu_items",
    "orders",
    "order_items",
    "wish_items",
    "order_events",
    "replacement_requests",
    "notification_logs",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists ${tableName}`, "i"));
  }
});

test("notification subscription migration creates subscription table", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "../backend/db/migrations/002_notification_subscriptions.sql"),
    "utf8",
  );

  assert.match(schema, /create table if not exists notification_subscriptions/i);
  assert.match(schema, /template_key text not null/i);
  assert.match(schema, /status text not null/i);
});
