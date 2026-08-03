function createUsersRepository(pool) {
  return {
    async upsertWechatUser(user) {
      const response = await pool.query(
        `
          insert into users (id, role, display_name, openid, openid_bound)
          values ($1, $2, $3, $4, $5)
          on conflict (id) do update set
            role = excluded.role,
            display_name = excluded.display_name,
            openid = excluded.openid,
            openid_bound = excluded.openid_bound,
            updated_at = now()
          returning id, role, display_name, openid_bound
        `,
        [
          user.id,
          user.role,
          user.displayName,
          user.openid || null,
          Boolean(user.openidBound),
        ],
      );

      return mapUserRow(response.rows[0]);
    },
  };
}

function mapUserRow(row) {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    openidBound: Boolean(row.openid_bound),
  };
}

module.exports = {
  createUsersRepository,
  mapUserRow,
};
