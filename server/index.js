const { pool } = require('./db');
const { app, ensureDB } = require('./app');

const PORT = process.env.PORT || 3001;

// Keep Neon database awake by pinging every 4 minutes
function startHeartbeat() {
  const HEARTBEAT_INTERVAL = 4 * 60 * 1000; // 4 minutes
  setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
    }
  }, HEARTBEAT_INTERVAL);
  console.log('Database heartbeat started (every 4 minutes)');
}

async function start(retries = 5) {
  try {
    console.log(`Connecting to database... (${6 - retries}/5)`);
    await ensureDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API server running on port ${PORT}`);
      startHeartbeat();
    });
  } catch (err) {
    console.error('Failed to start:', err.message);
    if (retries > 0) {
      console.log('Retrying in 5 seconds...');
      setTimeout(() => start(retries - 1), 5000);
    } else {
      console.error('Max retries reached. Exiting.');
      process.exit(1);
    }
  }
}

start();
