#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const LOCAL_ENV_FILES = ["docker-compose.override.yml", ".env.local", ".env"];

function buildCode2SessionUrl({ appId, appSecret, code }) {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  return url;
}

async function exchangeCodeForOpenid({ code, env = process.env, localEnv = {}, fetchImpl = fetch } = {}) {
  const resolvedEnv = resolveWechatEnv({ env, localEnv });
  const appId = requireLocalValue(resolvedEnv.WECHAT_APP_ID, "WECHAT_APP_ID");
  const appSecret = requireLocalValue(resolvedEnv.WECHAT_APP_SECRET, "WECHAT_APP_SECRET");
  const loginCode = requireLocalValue(code, "js_code argument");
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this Node.js runtime");
  }

  const response = await fetchImpl(buildCode2SessionUrl({ appId, appSecret, code: loginCode }));
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`WeChat code2Session HTTP ${response.status || "error"}`);
  }
  if (payload.errcode) {
    throw new Error(`WeChat code2Session failed (${payload.errcode}): ${payload.errmsg || "unknown error"}`);
  }
  if (!payload.openid) {
    throw new Error("WeChat code2Session did not return openid");
  }
  return payload.openid;
}

function formatOpenidOutput(openid) {
  return `${openid}\n`;
}

function resolveWechatEnv({ env = process.env, localEnv = {} } = {}) {
  return {
    WECHAT_APP_ID: env.WECHAT_APP_ID || localEnv.WECHAT_APP_ID,
    WECHAT_APP_SECRET: env.WECHAT_APP_SECRET || localEnv.WECHAT_APP_SECRET,
  };
}

function loadLocalEnv({ cwd = process.cwd(), fsImpl = fs } = {}) {
  return LOCAL_ENV_FILES.reduce((result, fileName) => {
    const filePath = path.join(cwd, fileName);
    if (!fsImpl.existsSync(filePath)) return result;
    return {
      ...result,
      ...parseLocalEnvContent(fsImpl.readFileSync(filePath, "utf8")),
    };
  }, {});
}

function parseLocalEnvContent(content) {
  return content.split(/\r?\n/).reduce((result, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return result;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*[:=]\s*(.*)$/);
    if (!match) return result;

    const key = match[1];
    if (!key.startsWith("WECHAT_")) return result;
    result[key] = unquoteLocalValue(match[2]);
    return result;
  }, {});
}

function unquoteLocalValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function requireLocalValue(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required`);
  }
  const trimmed = String(value).trim();
  if (trimmed.startsWith("replace-with-")) {
    throw new Error(`${name} is still a placeholder`);
  }
  return trimmed;
}

async function main({ argv = process.argv.slice(2), env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    stdout.write("Usage: WECHAT_APP_ID=... WECHAT_APP_SECRET=... npm run wechat:openid -- <wx.login code>\n");
    return 0;
  }

  try {
    const openid = await exchangeCodeForOpenid({ code: argv[0], env, localEnv: loadLocalEnv() });
    stdout.write(formatOpenidOutput(openid));
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
}

if (require.main === module) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

module.exports = {
  buildCode2SessionUrl,
  exchangeCodeForOpenid,
  formatOpenidOutput,
  loadLocalEnv,
  main,
  parseLocalEnvContent,
  resolveWechatEnv,
};
