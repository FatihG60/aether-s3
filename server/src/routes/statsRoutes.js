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

// GET /api/stats/daily-transfers & /api/daily-transfers - Filterable Daily Transfer Sessions & Metrics
const handleDailyTransfers = async (req, res) => {
  try {
    const { search = '', status = 'ALL', date } = req.query;

    const dbSessions = await query(`SELECT * FROM TRANSFER_SESSIONS`);
    const dbObjects = await query(`SELECT * FROM OBJECTS`);
    const memorySessions = Array.from(liveUploadSessions.values());

    const sessionMap = new Map();

    // 1. Load DB Transfer Sessions
    dbSessions.forEach(s => {
      const isCompleted = s.status === 'COMPLETED';
      const fSize = s.file_size || 0;
      const tChunks = s.total_chunks || 1;

      sessionMap.set(s.upload_id, {
        uploadId: s.upload_id,
        userId: s.user_id || 'user_default',
        bucketName: s.bucket_name,
        objectKey: s.object_key,
        fileName: s.file_name,
        fileSize: fSize,
        uploadedBytes: isCompleted ? fSize : (s.uploaded_bytes || 0),
        completedChunks: isCompleted ? tChunks : (s.completed_chunks || 0),
        totalChunks: tChunks,
        status: s.status, // 'COMPLETED', 'IN_PROGRESS', 'FAILED'
        createdAt: s.created_at,
        updatedAt: s.updated_at || s.created_at
      });
    });

    // 2. Include all uploaded OBJECTS as Completed Sessions for 100% accuracy
    dbObjects.forEach(obj => {
      const objectSessionId = `object_${obj.id}_${obj.object_key}`;
      const existsInSessions = Array.from(sessionMap.values()).some(
        s => s.objectKey === obj.object_key && s.status === 'COMPLETED'
      );

      if (!existsInSessions) {
        sessionMap.set(objectSessionId, {
          uploadId: objectSessionId,
          userId: obj.user_id || 'user_default',
          bucketName: obj.bucket_name,
          objectKey: obj.object_key,
          fileName: obj.file_name || obj.object_key,
          fileSize: obj.size_bytes || 0,
          uploadedBytes: obj.size_bytes || 0,
          completedChunks: 1,
          totalChunks: 1,
          status: 'COMPLETED',
          createdAt: obj.created_at,
          updatedAt: obj.updated_at || obj.created_at
        });
      }
    });

    // 3. Merge active live memory sessions
    memorySessions.forEach(ms => {
      const isCompleted = ms.status === 'TAMAMLANDI' || ms.status === 'COMPLETED';
      const fSize = ms.fileSize || 0;
      const tChunks = ms.totalChunks || 1;

      sessionMap.set(ms.uploadId, {
        uploadId: ms.uploadId,
        userId: ms.userId || 'user_default',
        bucketName: ms.bucketName,
        objectKey: ms.objectKey,
        fileName: ms.fileName,
        fileSize: fSize,
        uploadedBytes: isCompleted ? fSize : (ms.uploadedBytes || 0),
        completedChunks: isCompleted ? tChunks : (ms.completedChunks || 0),
        totalChunks: tChunks,
        status: isCompleted ? 'COMPLETED' : ms.status === 'HATA' ? 'FAILED' : 'IN_PROGRESS',
        speedBytesPerSec: ms.speedBytesPerSec || 0,
        createdAt: new Date(ms.startTime).toISOString(),
        updatedAt: new Date(ms.lastUpdated).toISOString()
      });
    });

    let mergedList = Array.from(sessionMap.values());

    // Filter by Date (default: Today YYYY-MM-DD)
    const targetDateStr = date || new Date().toISOString().split('T')[0];
    const todaySessions = mergedList.filter(s => {
      const sDate = (s.updatedAt || s.createdAt || '').split('T')[0];
      return sDate === targetDateStr;
    });

    // Calculate Today's Aggregated Metrics
    const todayCompleted = todaySessions.filter(s => s.status === 'COMPLETED');
    const todayOngoing = todaySessions.filter(s => s.status === 'IN_PROGRESS');
    const todayFailed = todaySessions.filter(s => s.status === 'FAILED');

    const todayCompletedBytes = todayCompleted.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
    const todayOngoingBytes = todayOngoing.reduce((acc, curr) => acc + (curr.uploadedBytes || 0), 0);
    const todayTotalTransferredBytes = todaySessions.reduce((acc, curr) => acc + (curr.uploadedBytes || curr.fileSize || 0), 0);

    // Apply Live Search Filter (user_id, file_name, object_key)
    let filtered = [...todaySessions];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(s => 
        (s.userId && s.userId.toLowerCase().includes(q)) ||
        (s.fileName && s.fileName.toLowerCase().includes(search.toLowerCase())) ||
        (s.objectKey && s.objectKey.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Apply Status Filter
    if (status !== 'ALL') {
      filtered = filtered.filter(s => s.status === status);
    }

    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    res.json({
      success: true,
      metrics: {
        targetDate: targetDateStr,
        todayCompletedCount: todayCompleted.length,
        todayCompletedBytes,
        todayOngoingCount: todayOngoing.length,
        todayOngoingBytes,
        todayFailedCount: todayFailed.length,
        todayTotalTransferredBytes
      },
      sessions: filtered
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/stats/daily-transfers', handleDailyTransfers);
router.get('/daily-transfers', handleDailyTransfers);

// GET /api/stats/live-uploads & /api/live-uploads
const handleLiveUploads = (req, res) => {
  try {
    const sessions = Array.from(liveUploadSessions.values());
    const activeSessions = sessions.filter(s => s.status === 'YÜKLENİYOR' || s.status === 'IN_PROGRESS');
    
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
};

router.get('/stats/live-uploads', handleLiveUploads);
router.get('/live-uploads', handleLiveUploads);

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
