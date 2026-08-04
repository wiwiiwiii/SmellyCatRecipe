const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function assertPageFiles(appJson) {
  for (const page of appJson.pages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      assertFileExists(`${page}.${ext}`);
    }
  }
}

function assertPackIgnores(projectConfig) {
  const ignored = new Set(projectConfig.packOptions.ignore.map((entry) => entry.value));
  for (const expected of ["docs", "tests", "package.json", "README.md", "LICENSE"]) {
    if (!ignored.has(expected)) {
      throw new Error(`project.config.json packOptions.ignore must include ${expected}`);
    }
  }
}

function assertOpenApiShape() {
  const openApiPath = path.join("docs", "api", "openapi.yaml");
  assertFileExists(openApiPath);
  const content = fs.readFileSync(openApiPath, "utf8");
  for (const required of ["openapi: 3.0.3", "/auth/wechat-login:", "/orders:", "/notification-subscriptions:"]) {
    if (!content.includes(required)) {
      throw new Error(`OpenAPI contract missing ${required}`);
    }
  }
}

function assertCiCacheHasLockfile() {
  const workflowPath = path.join(".github", "workflows", "ci.yml");
  assertFileExists(workflowPath);
  const content = fs.readFileSync(workflowPath, "utf8");
  const hasNpmCache = /^\s*cache:\s*npm\s*$/m.test(content);
  const hasLockfile = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock"].some((filePath) =>
    fs.existsSync(filePath),
  );

  if (hasNpmCache && !hasLockfile) {
    throw new Error("CI workflow cannot enable setup-node npm cache without a dependency lockfile");
  }
}

function assertUnusedFileFilteringDisabled(projectConfig, filePath = "project.config.json") {
  const setting = projectConfig.setting || {};
  for (const key of ["ignoreDevUnusedFiles", "ignoreUploadUnusedFiles"]) {
    if (setting[key] !== false) {
      throw new Error(`${filePath} setting.${key} must be false for WeChat DevTools page loading`);
    }
  }
}

function assertPrivateConfigDoesNotOverrideUnusedFileFiltering() {
  const privateConfigPath = "project.private.config.json";
  if (!fs.existsSync(privateConfigPath)) return;

  const setting = readJson(privateConfigPath).setting || {};
  for (const key of ["ignoreDevUnusedFiles", "ignoreUploadUnusedFiles"]) {
    if (setting[key] === true) {
      throw new Error(`${privateConfigPath} setting.${key} must not override dependency filtering to true`);
    }
  }
}

function main() {
  const appJson = readJson("app.json");
  const projectConfig = readJson("project.config.json");
  readJson("sitemap.json");
  assertPageFiles(appJson);
  assertPackIgnores(projectConfig);
  assertUnusedFileFilteringDisabled(projectConfig);
  assertPrivateConfigDoesNotOverrideUnusedFileFiltering();
  assertOpenApiShape();
  assertCiCacheHasLockfile();
  console.log(`project check ok: ${appJson.pages.length} pages`);
}

main();
