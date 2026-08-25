const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("login code debug page is available and copies wx.login code", () => {
  const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
  assert.ok(appJson.pages.includes("pages/debug-login/debug-login"));

  const source = fs.readFileSync("pages/debug-login/debug-login.js", "utf8");
  assert.match(source, /wx\.login/);
  assert.match(source, /wx\.setClipboardData/);
  assert.match(source, /wx\.showModal/);
  assert.match(source, /NO_CODE/);
});
