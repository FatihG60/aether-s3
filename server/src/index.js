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
import s3StandardRoutes from './routes/s3StandardRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import lifecycleRoutes from './routes/lifecycleRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { startLifecycleScheduler } from './services/lifecycleEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*',
  exposedHeaders: ['ETag', 'Content-Length', 'Content-Type', 'Accept-Ranges', 'Last-Modified', 'x-amz-request-id']
}));

// Body parsing with streaming bypass for direct binary PUT requests
app.use((req, res, next) => {
  // If it's a binary PUT to a standard S3 path (e.g. PUT /:bucket/*), skip JSON parsing so req stream can be piped directly
  if (req.method === 'PUT' && !req.path.startsWith('/api')) {
    return next();
  }
  express.json({ limit: '100mb' })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit: '100mb' })(req, res, next);
  });
});

// Disable HTTP request timeout for large (1TB+) transfers
app.use((req, res, next) => {
  req.setTimeout(0);
  res.setTimeout(0);
  next();
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Custom S3 Storage Engine',
    s3_compatibility: 'AWS S3 REST XML Protocol Enabled',
    timestamp: new Date().toISOString()
  });
});

// REST API Routes (Web Dashboard)
app.use('/api/buckets', bucketRoutes);
app.use('/api', objectRoutes);
app.use('/api/presigned', presignedRoutes);
app.use('/api', statsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/users', userRoutes);

// AWS S3 Standard REST XML Protocol Router (AWS CLI, Boto3, Cyberduck, Rclone)
app.use('/', s3StandardRoutes);

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
    console.log(`📦 AWS S3 Standard REST / XML API active at http://localhost:${PORT}`);
    console.log(`📊 Storage Dashboard API ready at http://localhost:${PORT}/api/stats`);
    
    // Start background automated S3 lifecycle rules scheduler
    startLifecycleScheduler();
  });

  server.keepAliveTimeout = 86400000; // 24 Hours
  server.headersTimeout = 86400000;
  server.setTimeout(0);
});
