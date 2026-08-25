const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { ROLE } = require("../services/constants");
const {
  buildCurrentLoginInput,
  buildRoleLoginInput,
  getLaunchRouteForRole,
  loginAsRole,
  resolveApiMode,
} = require("../services/auth-session");

test("role login input lets backend derive identity from openid", () => {
  assert.deepEqual(buildRoleLoginInput(ROLE.CAT, { apiBaseUrl: "https://api.example.com/v1" }), {});
  assert.deepEqual(buildRoleLoginInput(ROLE.OWNER, { apiBaseUrl: "https://api.example.com/v1" }), {});
});

test("role login input preserves mock role switching without backend", () => {
  assert.deepEqual(buildRoleLoginInput(ROLE.CAT, { apiBaseUrl: "" }), {
    code: "dev-code",
    devRoleOverride: ROLE.CAT,
  });
  assert.deepEqual(buildRoleLoginInput(ROLE.OWNER, { apiBaseUrl: "" }), {
    code: "dev-code",
    devRoleOverride: ROLE.OWNER,
  });
});

test("api client marker overrides local api config when building login input", () => {
  const mockMode = resolveApiMode({ api: { isBackendApi: false }, apiBaseUrl: "http://localhost:3000/v1" });
  const backendMode = resolveApiMode({ api: { isBackendApi: true }, apiBaseUrl: "" });

  assert.deepEqual(buildRoleLoginInput(ROLE.CAT, mockMode), {
    code: "dev-code",
    devRoleOverride: ROLE.CAT,
  });
  assert.deepEqual(buildCurrentLoginInput(backendMode), {});
});

test("loginAsRole rejects a backend user who opens the wrong side", async () => {
  await assert.rejects(
    loginAsRole({
      api: {
        async wechatLogin(input) {
          assert.deepEqual(input, {});
          return { user: { role: ROLE.CAT } };
        },
      },
      apiBaseUrl: "https://api.example.com/v1",
      role: ROLE.OWNER,
    }),
    /当前微信不是主人/,
  );
});

test("launch routes use backend-returned roles", () => {
  assert.equal(getLaunchRouteForRole(ROLE.CAT), "/pages/menu/menu");
  assert.equal(getLaunchRouteForRole(ROLE.OWNER), "/pages/owner/owner");
});

test("app metadata uses the new Puppy Cat Feeder name", () => {
  const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const projectConfig = JSON.parse(fs.readFileSync("project.config.json", "utf8"));
  const appSource = fs.readFileSync("app.js", "utf8");

  assert.equal(appJson.pages[0], "pages/launch/launch");
  assert.equal(appJson.window.navigationBarTitleText, "小狗咪的喂食器");
  assert.equal(projectConfig.projectname, "小狗咪的喂食器");
  assert.match(projectConfig.description, /Puppy Cat Feeder/);
  assert.match(appSource, /appName: "小狗咪的喂食器"/);
  assert.match(appSource, /appEnglishName: "Puppy Cat Feeder"/);
});
