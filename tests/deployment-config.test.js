const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("production compose defaults to localhost bind but documents temporary IP testing", () => {
  const compose = fs.readFileSync("docker-compose.prod.yml", "utf8");
  const deploymentDoc = fs.readFileSync("docs/deployment.md", "utf8");

  assert.match(compose, /\$\{API_HOST_BIND:-127\.0\.0\.1\}:3000:3000/);
  assert.match(deploymentDoc, /API_HOST_BIND=0\.0\.0\.0/);
  assert.match(deploymentDoc, /IP.*正式审核/);
});
