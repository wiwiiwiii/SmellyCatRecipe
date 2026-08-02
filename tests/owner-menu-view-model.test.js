const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOwnerMenuEditScrollOptions,
  buildOwnerMenuItemInput,
  buildOwnerMenuView,
} = require("../services/owner-menu-view-model");

test("owner menu view shows visible and hidden menu items with owner copy", () => {
  const view = buildOwnerMenuView({
    items: [
      {
        id: "tomato-egg-rice",
        name: "番茄炒蛋盖饭",
        description: "酸甜番茄汁拌米饭。",
        catReason: "咪觉得这个拌饭会很安心。",
        category: "main",
        tags: ["不辣", "快手"],
        recommendedMealTimes: ["lunch", "dinner"],
        recommendedMoods: ["hungry", "tired"],
        estimatedMinutes: 15,
        hidden: false,
      },
      {
        id: "hidden-noodle",
        name: "隐藏拌面",
        description: "今天不做。",
        catReason: "以后再说。",
        category: "main",
        tags: ["面"],
        recommendedMealTimes: ["dinner"],
        recommendedMoods: ["tired"],
        estimatedMinutes: 12,
        hidden: true,
      },
    ],
  });

  assert.equal(view.heroTitle, "主人有 2 道菜");
  assert.equal(view.items[0].visibilityText, "小猫看得到");
  assert.equal(view.items[0].visibilityActionLabel, "藏起来");
  assert.equal(view.items[0].tagsText, "不辣 / 快手");
  assert.equal(view.items[0].mealTimesText, "午饭、晚饭");
  assert.equal(view.items[1].visibilityText, "已藏起来");
  assert.equal(view.items[1].visibilityActionLabel, "恢复显示");
});

test("owner menu form input trims text and parses tags and minutes", () => {
  const input = buildOwnerMenuItemInput({
    name: " 葱油拌面 ",
    description: " 香香的葱油和热面条。 ",
    catReason: " 咪想吃简单但很香的一碗。 ",
    category: "main",
    tagsText: "快手，面, 不辣",
    recommendedMealTimes: ["lunch", "dinner"],
    recommendedMoods: ["hungry", "tired"],
    estimatedMinutes: "12",
    hidden: false,
  });

  assert.deepEqual(input, {
    name: "葱油拌面",
    description: "香香的葱油和热面条。",
    catReason: "咪想吃简单但很香的一碗。",
    category: "main",
    tags: ["快手", "面", "不辣"],
    recommendedMealTimes: ["lunch", "dinner"],
    recommendedMoods: ["hungry", "tired"],
    estimatedMinutes: 12,
    hidden: false,
  });
});

test("owner menu edit action scrolls back to the form section", () => {
  assert.deepEqual(buildOwnerMenuEditScrollOptions(), {
    selector: "#owner-menu-form",
    duration: 280,
  });
});
