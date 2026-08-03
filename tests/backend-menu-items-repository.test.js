const test = require("node:test");
const assert = require("node:assert/strict");

const { createMenuItemsRepository } = require("../backend/repositories/menu-items-repository");

test("menu repository creates and updates menu items with postgres fields", async () => {
  const pool = createRecordingPool();
  const repository = createMenuItemsRepository(pool);

  await repository.create({
    name: "葱油拌面",
    description: "香香的面。",
    catReason: "咪想吃面。",
    category: "main",
    tags: ["快手"],
    recommendedMealTimes: ["dinner"],
    recommendedMoods: ["tired"],
    estimatedMinutes: 12,
    hidden: false,
  });
  await repository.update("tomato-egg-rice", { hidden: true, estimatedMinutes: 16 });

  assert.match(pool.calls[0].sql, /insert into menu_items/i);
  assert.match(pool.calls[0].params[0], /^menu_[0-9a-f]{16}$/);
  assert.equal(pool.calls[0].params[3], "葱油拌面");
  assert.match(pool.calls[1].sql, /update menu_items/i);
  assert.match(pool.calls[1].sql, /hidden = /i);
  assert.match(pool.calls[1].sql, /estimated_minutes = /i);
  assert.match(pool.calls[1].sql, /cooking_minutes = /i);
  assert.equal(pool.calls[1].params.includes(true), true);
  assert.equal(pool.calls[1].params.filter((item) => item === 16).length, 2);
  assert.equal(pool.calls[1].params.at(-1), "tomato-egg-rice");
});

test("menu repository reports missing menu item on update", async () => {
  const repository = createMenuItemsRepository({
    async query() {
      return { rows: [] };
    },
  });

  await assert.rejects(
    () => repository.update("missing-menu-item", { hidden: true }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, "MENU_ITEM_NOT_FOUND");
      return true;
    },
  );
});

function createRecordingPool() {
  return {
    calls: [],
    async query(sql, params = []) {
      this.calls.push({ sql, params });
      return {
        rows: [
          {
            id: params[params.length - 1] || "menu_1",
            category_id: "main",
            category: "main",
            name: "葱油拌面",
            description: "香香的面。",
            cat_reason: "咪想吃面。",
            tags: ["快手"],
            recommended_meal_times: ["dinner"],
            recommended_moods: ["tired"],
            estimated_minutes: 12,
            cooking_minutes: 12,
            hidden: Boolean(params[0]),
          },
        ],
      };
    },
  };
}
