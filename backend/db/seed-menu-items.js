const { MENU_ITEMS } = require("../../data/menu");
const { createPoolFromEnv } = require("./pool");

async function seedMenuItems({ pool, menuItems = MENU_ITEMS }) {
  for (const item of menuItems) {
    await pool.query(
      `
        insert into menu_items (
          id,
          category_id,
          category,
          name,
          description,
          cat_reason,
          tags,
          recommended_meal_times,
          recommended_moods,
          estimated_minutes,
          cooking_minutes,
          hidden
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        on conflict (id) do update set
          category_id = excluded.category_id,
          category = excluded.category,
          name = excluded.name,
          description = excluded.description,
          cat_reason = excluded.cat_reason,
          tags = excluded.tags,
          recommended_meal_times = excluded.recommended_meal_times,
          recommended_moods = excluded.recommended_moods,
          estimated_minutes = excluded.estimated_minutes,
          cooking_minutes = excluded.cooking_minutes,
          hidden = excluded.hidden,
          updated_at = now()
      `,
      [
        item.id,
        item.categoryId || item.category,
        item.category,
        item.name,
        item.description,
        item.catReason,
        item.tags || [],
        item.recommendedMealTimes || [],
        item.recommendedMoods || [],
        item.estimatedMinutes,
        item.cookingMinutes || item.estimatedMinutes,
        Boolean(item.hidden),
      ],
    );
  }

  return {
    count: menuItems.length,
  };
}

async function runCli() {
  const pool = createPoolFromEnv();
  try {
    const result = await seedMenuItems({ pool });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  seedMenuItems,
};
