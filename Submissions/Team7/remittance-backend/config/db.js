const { Pool } = require('pg');

// Parse DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set!');
  process.exit(1);
}

// Configuration for Neon PostgreSQL
const poolConfig = {
  connectionString,
  ssl: {
    rejectUnauthorized: true, // Required for Neon
  },
  // Connection settings
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000, // 30 seconds
  max: 20, // Maximum 20 clients in the pool
};

// Create the connection pool
const pool = new Pool(poolConfig);

// Set up basic error handling
pool.on('error', (err, client) => {
  console.error('Unexpected database error:', err);
  if (client) client.release(true);
});

// Properly close all connections when needed
pool.end = async () => {
  try {
    console.log('Closing all database connections...');
    await pool.end();
    console.log('All database connections closed successfully');
    return true;
  } catch (error) {
    console.error('Error closing database connections:', error);
    throw error;
  }
};

module.exports = pool;