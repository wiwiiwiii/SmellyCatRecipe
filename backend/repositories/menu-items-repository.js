const crypto = require("node:crypto");
const { createHttpError } = require("../auth/dev-auth-service");

function createMenuItemsRepository(pool) {
  return {
    async create(input) {
      const item = normalizeMenuInput({
        ...input,
        id: input.id || nextMenuItemId(),
      });
      const response = await pool.query(
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
          returning
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
        `,
        [
          item.id,
          item.categoryId,
          item.category,
          item.name,
          item.description,
          item.catReason,
          item.tags,
          item.recommendedMealTimes,
          item.recommendedMoods,
          item.estimatedMinutes,
          item.cookingMinutes,
          item.hidden,
        ],
      );

      return {
        item: mapMenuItemRow(response.rows[0]),
      };
    },

    async list(filters = {}) {
      const clauses = [];
      const params = [];

      if (!filters.includeHidden) {
        clauses.push("hidden = false");
      }
      if (filters.mealTime) {
        params.push(filters.mealTime);
        clauses.push(`recommended_meal_times @> array[$${params.length}]::text[]`);
      }
      if (filters.mood) {
        params.push(filters.mood);
        clauses.push(`recommended_moods @> array[$${params.length}]::text[]`);
      }
      if (filters.q) {
        params.push(`%${filters.q.trim().toLowerCase()}%`);
        clauses.push(`(
          lower(name) like $${params.length}
          or lower(description) like $${params.length}
          or lower(cat_reason) like $${params.length}
          or lower(array_to_string(tags, ' ')) like $${params.length}
        )`);
      }

      const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const response = await pool.query(
        `
          select
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
          from menu_items
          ${whereSql}
          order by created_at asc, id asc
        `,
        params,
      );

      return {
        items: response.rows.map(mapMenuItemRow),
        nextCursor: null,
      };
    },

    async update(menuItemId, patch = {}) {
      const assignments = [];
      const params = [];
      const normalized = normalizeMenuPatch(patch);

      for (const [column, value] of Object.entries(normalized)) {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      }

      if (!assignments.length) {
        const response = await pool.query(
          `
            select
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
            from menu_items
            where id = $1
          `,
          [menuItemId],
        );
        return { item: mapMenuItemRow(requireMenuItemRow(response.rows[0], menuItemId)) };
      }

      params.push(menuItemId);
      const response = await pool.query(
        `
          update menu_items
          set
            ${assignments.join(",\n            ")},
            updated_at = now()
          where id = $${params.length}
          returning
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
        `,
        params,
      );

      return {
        item: mapMenuItemRow(requireMenuItemRow(response.rows[0], menuItemId)),
      };
    },
  };
}

function normalizeMenuInput(input) {
  const category = input.category || input.categoryId || "main";
  const estimatedMinutes = Number(input.estimatedMinutes || input.cookingMinutes || 0);
  return {
    id: input.id,
    categoryId: input.categoryId || category,
    category,
    name: input.name,
    description: input.description,
    catReason: input.catReason,
    tags: input.tags || [],
    recommendedMealTimes: input.recommendedMealTimes || [],
    recommendedMoods: input.recommendedMoods || [],
    estimatedMinutes,
    cookingMinutes: Number(input.cookingMinutes || estimatedMinutes),
    hidden: Boolean(input.hidden),
  };
}

function normalizeMenuPatch(patch) {
  const normalized = {};

  const columnMap = {
    catReason: "cat_reason",
    categoryId: "category_id",
    cookingMinutes: "cooking_minutes",
    description: "description",
    estimatedMinutes: "estimated_minutes",
    hidden: "hidden",
    name: "name",
    recommendedMealTimes: "recommended_meal_times",
    recommendedMoods: "recommended_moods",
    tags: "tags",
  };

  for (const [key, column] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      normalized[column] = patch[key];
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "category")) {
    normalized.category = patch.category;
    normalized.category_id = patch.category;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "estimatedMinutes")) {
    normalized.estimated_minutes = Number(patch.estimatedMinutes);
    normalized.cooking_minutes = Number(patch.estimatedMinutes);
  }

  return normalized;
}

function mapMenuItemRow(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    category: row.category,
    name: row.name,
    description: row.description,
    catReason: row.cat_reason,
    tags: row.tags || [],
    recommendedMealTimes: row.recommended_meal_times || [],
    recommendedMoods: row.recommended_moods || [],
    estimatedMinutes: row.estimated_minutes,
    cookingMinutes: row.cooking_minutes,
    hidden: row.hidden,
  };
}

function requireMenuItemRow(row, menuItemId) {
  if (row) return row;
  throw createHttpError(404, "MENU_ITEM_NOT_FOUND", "菜品不存在", { menuItemId });
}

function nextMenuItemId() {
  return `menu_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

module.exports = {
  createMenuItemsRepository,
  mapMenuItemRow,
  normalizeMenuInput,
};
