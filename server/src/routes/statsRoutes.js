import express from 'express';
import crypto from 'crypto';
import { query, get, run, logActivity } from '../db/database.js';
import { liveUploadSessions } from './objectRoutes.js';

const router = express.Router();

// GET /api/stats - Global storage metrics and analytics
router.get('/stats', async (req, res) => {
  try {
    const buckets = await query(`SELECT * FROM BUCKETS`);
    const objects = await query(`SELECT * FROM OBJECTS`);
    const logs = await query(`SELECT * FROM ACTIVITY_LOGS`);

    const totalBuckets = buckets.length;
    const totalObjects = objects.length;
    const totalBytesUsed = objects.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
    const totalQuotaBytes = buckets.reduce((acc, curr) => acc + (curr.quota_bytes || 0), 0);

    const mimeCategories = {};
    objects.forEach(obj => {
      const type = (obj.content_type || 'unknown').split('/')[0];
      mimeCategories[type] = (mimeCategories[type] || 0) + obj.size_bytes;
    });

    res.json({
      success: true,
      stats: {
        totalBuckets,
        totalObjects,
        totalBytesUsed,
        totalQuotaBytes,
        mimeCategories,
        recentActivity: logs.slice(0, 20)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stats/live-uploads - Real-Time Live User Upload Monitor Telemetry
router.get('/stats/live-uploads', (req, res) => {
  try {
    const sessions = Array.from(liveUploadSessions.values());
    const activeSessions = sessions.filter(s => s.status === 'YÜKLENİYOR');
    
    const totalSpeedBytesPerSec = activeSessions.reduce((acc, curr) => acc + (curr.speedBytesPerSec || 0), 0);
    const activeUsers = [...new Set(activeSessions.map(s => s.userId))];

    res.json({
      success: true,
      telemetry: {
        activeCount: activeSessions.length,
        activeUsersCount: activeUsers.length,
        totalSpeedMBps: parseFloat((totalSpeedBytesPerSec / (1024 * 1024)).toFixed(2)),
        sessions: sessions.sort((a, b) => b.lastUpdated - a.lastUpdated).slice(0, 50)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/keys - List API Keys
router.get('/keys', async (req, res) => {
  try {
    const keys = await query(`SELECT id, access_key, name, created_at FROM API_KEYS`);
    res.json({ success: true, keys });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/keys - Create API Key
router.post('/keys', async (req, res) => {
  try {
    const { name } = req.body;
    const keyName = name || 'New Access Key';

    const accessKey = 'AKIA' + crypto.randomBytes(6).toString('hex').toUpperCase() + 'S3';
    const secretKey = crypto.randomBytes(20).toString('hex');

    await run(
      `INSERT INTO API_KEYS (access_key, secret_key, name) VALUES (?, ?, ?)`,
      [accessKey, secretKey, keyName]
    );

    await logActivity('CREATE_API_KEY', null, null, `Key created: ${keyName}`);

    res.status(201).json({
      success: true,
      key: {
        accessKey,
        secretKey,
        name: keyName
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/keys/:id - Delete API Key
router.delete('/keys/:id', async (req, res) => {
  try {
    await run(`DELETE FROM API_KEYS WHERE id = ?`, [req.params.id]);
    await logActivity('DELETE_API_KEY', null, null, `Key ID ${req.params.id} deleted`);
    res.json({ success: true, message: 'API key deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
