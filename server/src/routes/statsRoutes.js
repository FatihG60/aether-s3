import express from 'express';
import crypto from 'crypto';
import { query, get, run, logActivity } from '../db/database.js';
import { liveUploadSessions } from './objectRoutes.js';

const router = express.Router();

// Real-Time Ingress & Egress Bandwidth Rolling Registry
let currentSecondIngress = 0;
let currentSecondEgress = 0;

// Rolling 60-second timeline (samples every 1s)
const rollingTimeline = [];
for (let i = 59; i >= 0; i--) {
  const d = new Date(Date.now() - i * 1000);
  rollingTimeline.push({
    time: d.toLocaleTimeString('tr-TR'),
    ingressMB: 0,
    egressMB: 0
  });
}

// Every 1 second, sample current ingress & egress and rotate rolling array
setInterval(() => {
  const timeStr = new Date().toLocaleTimeString('tr-TR');
  const ingressMB = parseFloat((currentSecondIngress / (1024 * 1024)).toFixed(2));
  const egressMB = parseFloat((currentSecondEgress / (1024 * 1024)).toFixed(2));

  rollingTimeline.push({
    time: timeStr,
    ingressMB,
    egressMB
  });

  if (rollingTimeline.length > 60) {
    rollingTimeline.shift();
  }

  currentSecondIngress = 0;
  currentSecondEgress = 0;
}, 1000);

export function recordBandwidthIngress(bytes) {
  currentSecondIngress += (bytes || 0);
}

export function recordBandwidthEgress(bytes) {
  currentSecondEgress += (bytes || 0);
}

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

// GET /api/stats/bandwidth-history - Real-time Bandwidth Timeline & 7-Day Storage Flow
router.get('/stats/bandwidth-history', async (req, res) => {
  try {
    const buckets = await query(`SELECT * FROM BUCKETS`);
    const objects = await query(`SELECT * FROM OBJECTS WHERE is_deleted = 0`);
    const transferSessions = await query(`SELECT * FROM TRANSFER_SESSIONS`);

    // 1. Bucket distribution for Chart
    const bucketDistribution = buckets.map(b => {
      const bObjs = objects.filter(o => o.bucket_name === b.name);
      const totalBytes = bObjs.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
      return {
        name: b.name,
        sizeBytes: totalBytes,
        sizeMB: parseFloat((totalBytes / (1024 * 1024)).toFixed(2)),
        objectCount: bObjs.length
      };
    });

    // 2. Last 7-day daily transfer flow
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short' });

      // Calculate total uploaded on that date
      const dayObjects = objects.filter(o => (o.created_at || '').startsWith(dateStr));
      const dayTransfers = transferSessions.filter(s => (s.created_at || s.updated_at || '').startsWith(dateStr));

      const dayUploadedBytes = dayObjects.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0) +
        dayTransfers.reduce((acc, curr) => acc + (curr.uploaded_bytes || 0), 0);

      last7Days.push({
        date: dateStr,
        day: dayName,
        uploadMB: parseFloat((dayUploadedBytes / (1024 * 1024)).toFixed(1)),
        uploadGB: parseFloat((dayUploadedBytes / (1024 * 1024 * 1024)).toFixed(2)),
        objectCount: dayObjects.length
      });
    }

    // Peak Speed in last 60 seconds
    const peakIngressMB = Math.max(...rollingTimeline.map(p => p.ingressMB), 0);
    const peakEgressMB = Math.max(...rollingTimeline.map(p => p.egressMB), 0);

    res.json({
      success: true,
      liveTimeline: rollingTimeline,
      last7Days,
      bucketDistribution,
      peakIngressMB,
      peakEgressMB
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
        status: s.status,
        startedAt: s.started_at || s.created_at,
        endedAt: s.ended_at || (isCompleted ? (s.updated_at || s.created_at) : null),
        createdAt: s.created_at,
        updatedAt: s.updated_at || s.created_at
      });
    });

    // 2. Include all uploaded OBJECTS as Completed Sessions
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
          startedAt: obj.created_at,
          endedAt: obj.updated_at || obj.created_at,
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
        startedAt: new Date(ms.startTime).toISOString(),
        endedAt: isCompleted ? new Date(ms.lastUpdated).toISOString() : null,
        createdAt: new Date(ms.startTime).toISOString(),
        updatedAt: new Date(ms.lastUpdated).toISOString()
      });
    });

    let mergedList = Array.from(sessionMap.values()).map(s => {
      const startTimeMs = s.startedAt ? new Date(s.startedAt).getTime() : new Date(s.createdAt).getTime();
      const isDone = s.status === 'COMPLETED';
      const endTimeMs = s.endedAt ? new Date(s.endedAt).getTime() : (isDone ? (s.updatedAt ? new Date(s.updatedAt).getTime() : startTimeMs + 1000) : Date.now());
      
      const durationSeconds = Math.max(0.1, parseFloat(((endTimeMs - startTimeMs) / 1000).toFixed(1)));
      const sizeMB = parseFloat(((s.fileSize || 0) / (1024 * 1024)).toFixed(2));
      const speedMBps = parseFloat((sizeMB / durationSeconds).toFixed(2));

      return {
        ...s,
        durationSeconds,
        sizeMB,
        speedMBps
      };
    });

    const targetDateStr = date || new Date().toISOString().split('T')[0];
    const todaySessions = mergedList.filter(s => {
      const sDate = (s.updatedAt || s.createdAt || '').split('T')[0];
      return sDate === targetDateStr;
    });

    const todayCompleted = todaySessions.filter(s => s.status === 'COMPLETED');
    const todayOngoing = todaySessions.filter(s => s.status === 'IN_PROGRESS');
    const todayFailed = todaySessions.filter(s => s.status === 'FAILED');

    const todayCompletedBytes = todayCompleted.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
    const todayOngoingBytes = todayOngoing.reduce((acc, curr) => acc + (curr.uploadedBytes || 0), 0);
    const todayTotalTransferredBytes = todaySessions.reduce((acc, curr) => acc + (curr.uploadedBytes || curr.fileSize || 0), 0);

    // Duration & Correlation Statistics
    const avgDurationSec = todayCompleted.length > 0
      ? parseFloat((todayCompleted.reduce((a, b) => a + b.durationSeconds, 0) / todayCompleted.length).toFixed(1))
      : 0;

    const avgSpeedMBps = todayCompleted.length > 0
      ? parseFloat((todayCompleted.reduce((a, b) => a + b.speedMBps, 0) / todayCompleted.length).toFixed(2))
      : 0;

    const maxSpeedMBps = todayCompleted.length > 0
      ? parseFloat(Math.max(...todayCompleted.map(s => s.speedMBps)).toFixed(2))
      : 0;

    // Size vs Duration points for chart
    const sizeVsDurationPoints = todayCompleted.map(s => ({
      fileName: s.fileName,
      sizeMB: s.sizeMB,
      durationSec: s.durationSeconds,
      speedMBps: s.speedMBps
    }));

    let filtered = [...todaySessions];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(s => 
        (s.userId && s.userId.toLowerCase().includes(q)) ||
        (s.fileName && s.fileName.toLowerCase().includes(search.toLowerCase())) ||
        (s.objectKey && s.objectKey.toLowerCase().includes(search.toLowerCase()))
      );
    }

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
        todayTotalTransferredBytes,
        avgDurationSec,
        avgSpeedMBps,
        maxSpeedMBps,
        sizeVsDurationPoints
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
