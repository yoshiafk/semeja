import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { app, ensureDB } = require('../server/app');

// Initialize DB on cold start (runs once per container)
const ready = ensureDB().catch(err => {
  console.error('DB initialization failed:', err);
});

export default async function handler(req, res) {
  await ready;
  app(req, res);
}
