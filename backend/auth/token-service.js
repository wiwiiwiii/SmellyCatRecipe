const crypto = require("node:crypto");

function createTokenService({ secret = process.env.TOKEN_SECRET } = {}) {
  if (!secret) {
    throw new Error("TOKEN_SECRET is required");
  }

  return {
    signUser(user) {
      const payload = encodeBase64Url(JSON.stringify({
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        openidBound: Boolean(user.openidBound),
      }));
      const signature = sign(payload, secret);
      return `app-token.${payload}.${signature}`;
    },

    verifyToken(token) {
      const parts = token.split(".");
      if (parts.length !== 3 || parts[0] !== "app-token") return null;
      const [, payload, signature] = parts;
      const expected = sign(payload, secret);
      const signatureBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expected);
      if (signatureBuffer.length !== expectedBuffer.length) {
        return null;
      }
      if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
      }
      return JSON.parse(decodeBase64Url(payload));
    },
  };
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

module.exports = {
  createTokenService,
};
