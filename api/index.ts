import express from 'express';
import { apiRouter } from '../server/routes.js';
import { getDb } from '../server/db.js';

const app = express();

app.use(express.json({ limit: '8mb' }));

getDb();

app.use('/api/v1', apiRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default app;
