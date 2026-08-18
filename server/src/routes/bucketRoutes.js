import express from 'express';
import { query, get, run, logActivity } from '../db/database.js';

const router = express.Router();

// GET /api/buckets - List all buckets with object counts and storage usage
router.get('/', async (req, res) => {
  try {
    const buckets = await query(`
      SELECT 
        b.*,
        COUNT(o.id) as object_count,
        COALESCE(SUM(o.size_bytes), 0) as total_bytes
      FROM buckets b
      LEFT JOIN objects o ON b.name = o.bucket_name
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json({ success: true, buckets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/buckets/:name - Get single bucket details
router.get('/:name', async (req, res) => {
  try {
    const bucket = await get(`
      SELECT 
        b.*,
        COUNT(o.id) as object_count,
        COALESCE(SUM(o.size_bytes), 0) as total_bytes
      FROM buckets b
      LEFT JOIN objects o ON b.name = o.bucket_name
      WHERE b.name = ?
      GROUP BY b.id
    `, [req.params.name]);

    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    res.json({ success: true, bucket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/buckets - Create new bucket
router.post('/', async (req, res) => {
  try {
    const { name, region = 'us-east-1', is_public = 0, quota_gb = 10 } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Bucket name is required' });
    }

    // Bucket name validation (lowercase, alphanumeric, dashes, dots)
    const cleanName = name.toLowerCase().trim();
    if (!/^[a-z0-9.-]{3,63}$/.test(cleanName)) {
      return res.status(400).json({
        success: false,
        error: 'Bucket name must be 3-63 characters, lowercase letters, numbers, hyphens or dots.'
      });
    }

    const existing = await get(`SELECT id FROM buckets WHERE name = ?`, [cleanName]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Bucket with this name already exists' });
    }

    const quota_bytes = Math.max(1, parseInt(quota_gb, 10)) * 1024 * 1024 * 1024;

    await run(
      `INSERT INTO buckets (name, region, is_public, quota_bytes) VALUES (?, ?, ?, ?)`,
      [cleanName, region, is_public ? 1 : 0, quota_bytes]
    );

    await logActivity('CREATE_BUCKET', cleanName, null, `Quota: ${quota_gb} GB, Public: ${is_public}`);

    const newBucket = await get(`SELECT * FROM buckets WHERE name = ?`, [cleanName]);
    res.status(201).json({ success: true, bucket: newBucket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/buckets/:name - Update bucket settings
router.put('/:name', async (req, res) => {
  try {
    const { is_public, quota_gb, region } = req.body;
    const bucketName = req.params.name;

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    const newPublic = is_public !== undefined ? (is_public ? 1 : 0) : bucket.is_public;
    const newQuota = quota_gb !== undefined ? parseInt(quota_gb, 10) * 1024 * 1024 * 1024 : bucket.quota_bytes;
    const newRegion = region || bucket.region;

    await run(
      `UPDATE buckets SET is_public = ?, quota_bytes = ?, region = ? WHERE name = ?`,
      [newPublic, newQuota, newRegion, bucketName]
    );

    await logActivity('UPDATE_BUCKET', bucketName, null, `Public: ${newPublic}, QuotaBytes: ${newQuota}`);

    const updated = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    res.json({ success: true, bucket: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/buckets/:name - Delete bucket
router.delete('/:name', async (req, res) => {
  try {
    const bucketName = req.params.name;
    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);

    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    // Check if bucket has objects
    const objectCountRow = await get(`SELECT COUNT(*) as count FROM objects WHERE bucket_name = ?`, [bucketName]);
    if (objectCountRow.count > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        error: 'Bucket is not empty. Delete all objects first or use ?force=true'
      });
    }

    if (req.query.force === 'true') {
      await run(`DELETE FROM objects WHERE bucket_name = ?`, [bucketName]);
    }

    await run(`DELETE FROM buckets WHERE name = ?`, [bucketName]);
    await logActivity('DELETE_BUCKET', bucketName, null, `Bucket deleted`);

    res.json({ success: true, message: `Bucket ${bucketName} deleted successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
