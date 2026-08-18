import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { get, run, logActivity } from '../db/database.js';
import { saveObjectFile, streamPartialFile } from '../services/storageEngine.js';

const router = express.Router();

// POST /api/presigned/generate - Generate temporary signed URL
router.post('/generate', async (req, res) => {
  try {
    const { bucket, key, action = 'read', expiresInMinutes = 60 } = req.body;

    if (!bucket || !key) {
      return res.status(400).json({ success: false, error: 'Bucket and object key are required' });
    }

    const bucketExist = await get(`SELECT * FROM buckets WHERE name = ?`, [bucket]);
    if (!bucketExist) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    // Generate random token and HMAC signature
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    const tokenPayload = `${bucket}:${key}:${action}:${expiresAt}:${randomBytes}`;
    const token = crypto.createHash('sha256').update(tokenPayload).digest('hex').substring(0, 32);

    await run(
      `INSERT INTO PRESIGNED_URLS (token, bucket_name, object_key, action, expires_at) VALUES (?, ?, ?, ?, ?)`,
      [token, bucket, key, action, expiresAt]
    );

    await logActivity('GENERATE_PRESIGNED_URL', bucket, key, `Action: ${action}, ExpiresIn: ${expiresInMinutes}m`);

    const host = req.get('host');
    const protocol = req.protocol;
    const signedUrl = `${protocol}://${host}/api/presigned/${action}/${token}`;

    res.json({
      success: true,
      token,
      action,
      expiresAt,
      url: signedUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/presigned/read/:token - Download via presigned token
router.get('/read/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const record = await get(`SELECT * FROM PRESIGNED_URLS WHERE token = ?`, [token]);

    if (!record) {
      return res.status(403).json({ success: false, error: 'Invalid presigned token' });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(403).json({ success: false, error: 'Presigned URL has expired' });
    }

    const object = await get(
      `SELECT * FROM OBJECTS WHERE bucket_name = ? AND object_key = ?`,
      [record.bucket_name, record.object_key]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).json({ success: false, error: 'Object no longer exists' });
    }

    res.setHeader('ETag', object.etag);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(object.file_name)}"`);
    streamPartialFile(req, res, object.file_path, object.content_type);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
