const test = require("node:test");
const assert = require("node:assert/strict");

const { MEAL_TIME, MOOD } = require("../services/constants");
const {
  buildMenuViewModel,
  createWishItemDraft,
  searchMenuItems,
} = require("../services/menu-view-model");

test("builds meal and mood first home model", () => {
  const viewModel = buildMenuViewModel({
    mealTime: MEAL_TIME.DINNER,
    mood: MOOD.TIRED,
    selectedItemIds: ["tomato-egg-rice"],
  });

  assert.equal(viewModel.heroTitle, "咪晚饭想吃什么？");
  assert.equal(viewModel.mealTimes.length, 3);
  assert.equal(viewModel.moods.length, 6);
  assert.equal(viewModel.selectedCount, 1);
  assert.ok(viewModel.recommendedItems.every((item) => item.catReason));
});

test("search returns visible menu matches and hides hidden dishes", () => {
  const results = searchMenuItems({ query: "鸡翅" });

  assert.equal(results[0].name, "可乐鸡翅");
  assert.ok(results.every((item) => item.hidden === false));
});

test("empty search can become a wish item draft", () => {
  const results = searchMenuItems({ query: "咖喱猪排饭" });
  const draft = createWishItemDraft({
    query: "咖喱猪排饭",
    note: "如果主人方便的话",
  });

  assert.equal(results.length, 0);
  assert.deepEqual(draft, {
    name: "咖喱猪排饭",
    note: "如果主人方便的话",
  });
});

test("owner pick mood produces owner-arrange copy", () => {
  const viewModel = buildMenuViewModel({
    mealTime: "late_night",
    mood: "owner_pick",
    selectedItemIds: [],
  });

  assert.equal(viewModel.heroTitle, "咪夜宵想吃什么？");
  assert.equal(viewModel.heroSubtitle, "没主意也没关系，主人来安排。");
});
