import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { initDatabase } from './db/database.js';
import bucketRoutes from './routes/bucketRoutes.js';
import objectRoutes from './routes/objectRoutes.js';
import presignedRoutes from './routes/presignedRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Disable HTTP request timeout for ultra-large (1TB+) uploads/downloads
app.use((req, res, next) => {
  req.setTimeout(0); // Infinite timeout for long streaming
  res.setTimeout(0);
  next();
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Custom S3 Storage Engine',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/buckets', bucketRoutes);
app.use('/api', objectRoutes);
app.use('/api/presigned', presignedRoutes);
app.use('/api', statsRoutes);

// Static Client Dashboard Serving (for Production build)
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Initialize DB and start server with infinite timeouts for large file transfers
initDatabase().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Custom S3 Storage Engine running on http://localhost:${PORT}`);
    console.log(`📦 Storage Dashboard API ready at http://localhost:${PORT}/api/stats`);
  });

  // Set infinite socket timeouts for 1TB+ streaming
  server.keepAliveTimeout = 86400000; // 24 Hours
  server.headersTimeout = 86400000;
  server.setTimeout(0);
});
