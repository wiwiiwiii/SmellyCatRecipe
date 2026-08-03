function createPostgresExecutor(pool) {
  return {
    async query(sql, params = []) {
      return pool.query(sql, params);
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await work({
          query(sql, params = []) {
            return client.query(sql, params);
          },
        });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = {
  createPostgresExecutor,
};
