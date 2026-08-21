import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

async function prebuild() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("⚠️ No DATABASE_URL found, skipping prebuild cleanup.");
    return;
  }

  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    try {
      // Check if users table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);

      if (tableCheck.rows[0]?.exists) {
        console.log("🧹 Prebuild: Cleaning up duplicate warehouseId in users table before applying unique constraint...");
        
        // 1. Clear warehouseId for non-WAREHOUSE_ADMIN roles
        await client.query(`
          UPDATE users 
          SET "warehouseId" = NULL 
          WHERE role != 'WAREHOUSE_ADMIN';
        `);

        // 2. Clear duplicate warehouseId so each warehouseId is unique across users
        await client.query(`
          UPDATE users
          SET "warehouseId" = NULL
          WHERE id NOT IN (
            SELECT DISTINCT ON ("warehouseId") id
            FROM users
            WHERE "warehouseId" IS NOT NULL
            ORDER BY "warehouseId", "createdAt" ASC
          );
        `);

        console.log("✅ Prebuild cleanup completed successfully.");
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("⚠️ Prebuild cleanup warning (non-fatal):", err?.message || err);
  } finally {
    await pool.end();
  }
}

prebuild().catch((err) => {
  console.warn("⚠️ Prebuild failed (non-fatal):", err?.message || err);
});
