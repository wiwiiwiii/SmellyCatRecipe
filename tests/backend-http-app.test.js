const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../backend/http/app");

test("backend app exposes a JSON health endpoint", async () => {
  const app = createApp();

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    service: "smelly-cat-recipe-api",
    status: "ok",
  });
});

test("backend app exposes development wechat login stub", async () => {
  const app = createApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/wechat-login",
    body: {
      code: "dev-code",
      devRoleOverride: "owner",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, "owner");
  assert.equal(response.body.user.displayName, "主人");
  assert.match(response.body.token, /^dev-token-owner-/);
});

test("backend app lists visible menu items through repository boundary", async () => {
  const seenFilters = [];
  const app = createApp({
    menuItemsRepository: {
      async list(filters) {
        seenFilters.push(filters);
        return {
          items: [
            {
              id: "tomato-egg-rice",
              category: "main",
              categoryId: "main",
              name: "番茄炒蛋盖饭",
              description: "酸甜番茄汁拌米饭。",
              catReason: "咪觉得这个拌饭会很安心。",
              tags: ["不辣"],
              recommendedMealTimes: ["lunch", "dinner"],
              recommendedMoods: ["hungry"],
              estimatedMinutes: 15,
              cookingMinutes: 15,
              hidden: false,
            },
          ],
          nextCursor: null,
        };
      },
    },
  });

  const response = await app.inject({
    method: "GET",
    url: "/v1/menu-items?mealTime=dinner&q=%E7%95%AA%E8%8C%84",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.items[0].name, "番茄炒蛋盖饭");
  assert.deepEqual(seenFilters[0], {
    includeHidden: false,
    mealTime: "dinner",
    mood: "",
    q: "番茄",
  });
});
