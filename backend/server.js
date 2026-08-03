const { createPostgresApiClient } = require("./api/postgres-api-client");
const { createWechatAuthService } = require("./auth/wechat-auth-service");
const { createPoolFromEnv } = require("./db/pool");
const { createApp, listen } = require("./http/app");
const { createWechatSubscribeService } = require("./notifications/wechat-subscribe-service");
const { createMenuItemsRepository } = require("./repositories/menu-items-repository");
const { createUsersRepository } = require("./repositories/users-repository");

async function main() {
  const pool = createPoolFromEnv();
  const menuItemsRepository = createMenuItemsRepository(pool);
  const usersRepository = createUsersRepository(pool);
  const app = createApp({
    apiClient: createPostgresApiClient({
      pool,
      menuItemsRepository,
      notificationService: createWechatSubscribeService(),
    }),
    authService: createWechatAuthService({
      userRepository: usersRepository,
    }),
    menuItemsRepository,
  });
  const port = Number(process.env.PORT || 3000);
  await listen(app, { port });
  console.log(`smelly-cat-recipe-api listening on ${port}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
