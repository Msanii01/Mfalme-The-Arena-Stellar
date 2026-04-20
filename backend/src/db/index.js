import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL is not set. Database operations will fail.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

/**
 * Execute a query against the database.
 * @param {string} text  SQL query string
 * @param {Array}  params Query parameters
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`Slow query (${duration}ms): ${text.substring(0, 80)}...`);
    }
    return result;
  } catch (err) {
    console.error(`Database query error: ${err.message}`);
    console.error(`Query: ${text.substring(0, 150)}`);
    throw err;
  }
}

/**
 * Get a client from the pool for transactions.
 */
export async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Override release to log when client is held too long
  const timeout = setTimeout(() => {
    console.error('Database client leak detected — client held for >5s');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    release();
  };

  return client;
}

/**
 * Test the database connection. Called on startup.
 */
export async function testConnection() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  Skipping DB connection test — DATABASE_URL not set');
    return;
  }
  try {
    const result = await pool.query('SELECT NOW() as now');
    console.log(`✅  Database connected — server time: ${result.rows[0].now}`);
  } catch (err) {
    console.error(`❌  Database connection failed: ${err.message}`);
    console.error('    Check DATABASE_URL in your .env file.');
    // Don't exit — allow server to start so dev can see error
  }
}

export function getDb() {
  return { query, getClient, testConnection };
}

export default { query, getClient, testConnection, getDb };
