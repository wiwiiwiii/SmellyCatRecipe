const { createPoolFromEnv } = require("./db/pool");
const { createApp, listen } = require("./http/app");
const { createMenuItemsRepository } = require("./repositories/menu-items-repository");

async function main() {
  const pool = createPoolFromEnv();
  const app = createApp({
    menuItemsRepository: createMenuItemsRepository(pool),
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
