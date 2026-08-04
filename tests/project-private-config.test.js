const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("local WeChat private config keeps dependency filtering disabled when present", () => {
  const privateConfigPath = "project.private.config.json";
  if (!fs.existsSync(privateConfigPath)) return;

  const config = JSON.parse(fs.readFileSync(privateConfigPath, "utf8"));

  for (const key of ["ignoreDevUnusedFiles", "ignoreUploadUnusedFiles"]) {
    assert.notEqual(
      config.setting && config.setting[key],
      true,
      `${privateConfigPath} setting.${key} must not re-enable DevTools dependency filtering`,
    );
  }
});

test("project check validates private WeChat config overrides", () => {
  const source = fs.readFileSync("scripts/check-project.js", "utf8");

  assert.match(source, /project\.private\.config\.json/);
  assert.match(source, /assertUnusedFileFilteringDisabled/);
});
