function createMenuItemsRepository(pool) {
  return {
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
  };
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

module.exports = {
  createMenuItemsRepository,
  mapMenuItemRow,
};
