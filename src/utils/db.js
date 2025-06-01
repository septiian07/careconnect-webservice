import mysql from 'mysql2/promise';

let pool;

async function getPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  return pool;
}

export async function query(sql, params) {
  const pool = await getPool();
  const [results,] = await pool.execute(sql, params);
  return results;
}

// Optional: A function to close the pool when the application exits
// This might be more relevant for long-running scripts rather than serverless functions
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}