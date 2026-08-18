import express from 'express';
import multer from 'multer';
import mime from 'mime-types';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, logActivity } from '../db/database.js';
import { saveObjectFile, deleteObjectFile, streamPartialFile, calculateMD5, getBucketDir } from '../services/storageEngine.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'data/temp') });

const CHUNKS_DIR = path.join(process.cwd(), 'data/temp_chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// Helper: Structured Path Generator {user}/{YYYY-MM-DD}/{guid}/{file_name}
function generateStructuredObjectKey(userId, originalFileName) {
  const user = userId && userId.trim() ? userId.trim() : 'user_default';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const guid = uuidv4();
  const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${user}/${today}/${guid}/${safeFileName}`;
}

// GET /api/buckets/:bucket/objects - List objects
router.get('/buckets/:bucket/objects', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { search, prefix } = req.query;

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    let sql = `SELECT * FROM objects WHERE bucket_name = ?`;
    const params = [bucketName];

    if (search) {
      sql += ` AND (file_name LIKE ? OR object_key LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (prefix) {
      sql += ` AND object_key LIKE ?`;
      params.push(`${prefix}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const objects = await query(sql, params);
    res.json({ success: true, objects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/buckets/:bucket/trash - List soft-deleted objects (Trash Bin)
router.get('/buckets/:bucket/trash', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const objects = await query(`SELECT * FROM objects WHERE bucket_name = ? AND is_deleted = 1`, [bucketName]);
    res.json({ success: true, objects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Single file upload
router.post('/storage/:bucket/upload', upload.single('file'), async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    const userId = req.body.user_id || 'user_default';
    const useStructuredPath = req.body.structured_path === 'true' || req.body.structured_path === '1';

    let objectKey = req.body.key || req.body.object_key;
    if (useStructuredPath || !objectKey) {
      objectKey = generateStructuredObjectKey(userId, file.originalname);
    } else {
      objectKey = objectKey.replace(/^\/+/, '');
    }

    const contentType = file.mimetype || mime.lookup(file.originalname) || 'application/octet-stream';
    const isPublic = req.body.is_public === 'true' || req.body.is_public === '1' ? 1 : bucket.is_public;

    const savedInfo = await saveObjectFile(bucketName, objectKey, file.path);

    const existing = await get(
      `SELECT id, file_path, version_id FROM objects WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, objectKey]
    );

    const newVersionId = `v${Date.now()}`;

    if (existing) {
      await run(
        `UPDATE objects SET size_bytes = ?, content_type = ?, etag = ?, is_public = ?, file_path = ?, version_id = ? WHERE id = ?`,
        [savedInfo.sizeBytes, contentType, savedInfo.etag, isPublic, savedInfo.filePath, newVersionId, existing.id]
      );
    } else {
      await run(
        `INSERT INTO objects (bucket_name, object_key, file_name, file_path, size_bytes, content_type, etag, is_public, user_id, version_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bucketName, objectKey, file.originalname, savedInfo.filePath, savedInfo.sizeBytes, contentType, savedInfo.etag, isPublic, userId, newVersionId]
      );
    }

    await logActivity('UPLOAD_OBJECT', bucketName, objectKey, `Size: ${savedInfo.sizeBytes} bytes, StructuredPath: ${useStructuredPath}`);

    const objectMeta = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, objectKey]
    );

    res.status(201).json({
      success: true,
      message: 'Object stored successfully',
      object: objectMeta,
      url: `/api/storage/${bucketName}/${encodeURIComponent(objectKey)}`
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- MULTIPART CHUNKED UPLOAD ENDPOINTS ---

function appendChunkFileStream(sourcePath, targetStream) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath);
    readStream.on('error', reject);
    readStream.on('end', resolve);
    readStream.pipe(targetStream, { end: false });
  });
}

// 1. Initiate Multipart Upload (Supports Structured Pathing)
router.post('/storage/:bucket/multipart/initiate', async (req, res) => {
  try {
    const { bucket: bucketName } = req.params;
    const { object_key, file_name, total_chunks, file_size, user_id, structured_path } = req.body;

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    let finalKey = object_key;
    if (structured_path || !finalKey) {
      finalKey = generateStructuredObjectKey(user_id || 'user_default', file_name || object_key);
    }

    const uploadId = 'upload_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    await fs.promises.mkdir(uploadDir, { recursive: true });

    res.json({
      success: true,
      uploadId,
      objectKey: finalKey,
      message: 'Multipart upload initiated'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Upload Chunk
router.post('/storage/:bucket/multipart/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || !file) {
      if (file && fs.existsSync(file.path)) try { await fs.promises.unlink(file.path); } catch (_) {}
      return res.status(400).json({ success: false, error: 'Missing chunk data' });
    }

    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      if (file && fs.existsSync(file.path)) try { await fs.promises.unlink(file.path); } catch (_) {}
      return res.status(404).json({ success: false, error: 'Upload session not found' });
    }

    const chunkTarget = path.join(uploadDir, `chunk_${chunkIndex}`);
    await fs.promises.copyFile(file.path, chunkTarget);
    try { await fs.promises.unlink(file.path); } catch (_) {}

    res.json({
      success: true,
      chunkIndex: parseInt(chunkIndex, 10),
      message: `Chunk ${chunkIndex} received`
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { await fs.promises.unlink(req.file.path); } catch (_) {}
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Complete Multipart Upload
router.post('/storage/:bucket/multipart/complete', async (req, res) => {
  try {
    const { bucket: bucketName } = req.params;
    const { uploadId, object_key, file_name, content_type, user_id } = req.body;

    const uploadDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadDir)) {
      return res.status(404).json({ success: false, error: 'Upload session not found' });
    }

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    const bucketDir = getBucketDir(bucketName);
    const normalizedKey = object_key.replace(/\\/g, '/').replace(/^\/+/, '');
    const targetFilePath = path.join(bucketDir, normalizedKey);

    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const files = (await fs.promises.readdir(uploadDir))
      .filter(f => f.startsWith('chunk_'))
      .sort((a, b) => parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10));

    const writeStream = fs.createWriteStream(targetFilePath);

    for (const chunkFile of files) {
      const chunkPath = path.join(uploadDir, chunkFile);
      await appendChunkFileStream(chunkPath, writeStream);
      try { await fs.promises.unlink(chunkPath); } catch (_) {}
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    try { await fs.promises.rmdir(uploadDir); } catch (_) {}

    const etag = await calculateMD5(targetFilePath);
    const stats = await fs.promises.stat(targetFilePath);
    const finalContentType = content_type || mime.lookup(file_name) || 'application/octet-stream';

    const existing = await get(
      `SELECT id FROM objects WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, normalizedKey]
    );

    const newVersionId = `v${Date.now()}`;

    if (existing) {
      await run(
        `UPDATE objects SET size_bytes = ?, content_type = ?, etag = ?, file_path = ?, version_id = ? WHERE id = ?`,
        [stats.size, finalContentType, etag, targetFilePath, newVersionId, existing.id]
      );
    } else {
      await run(
        `INSERT INTO objects (bucket_name, object_key, file_name, file_path, size_bytes, content_type, etag, is_public, user_id, version_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bucketName, normalizedKey, file_name || normalizedKey, targetFilePath, stats.size, finalContentType, etag, bucket.is_public, user_id || 'user_default', newVersionId]
      );
    }

    await logActivity('MULTIPART_UPLOAD_COMPLETE', bucketName, normalizedKey, `Merged ${files.length} chunks, Size: ${stats.size} bytes`);

    const objectMeta = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, normalizedKey]
    );

    res.json({
      success: true,
      message: 'Multipart upload completed successfully',
      object: objectMeta
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/storage/:bucket/download-zip - Stream Dynamic ZIP of selected objects
router.post('/storage/:bucket/download-zip', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { keys = [] } = req.body;

    if (!keys || keys.length === 0) {
      return res.status(400).json({ success: false, error: 'No object keys provided for ZIP archive' });
    }

    const archive = archiver('zip', { zlib: { level: 6 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${bucketName}-export-${Date.now()}.zip"`);

    archive.pipe(res);

    for (const key of keys) {
      const object = await get(
        `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
        [bucketName, key]
      );
      if (object && fs.existsSync(object.file_path)) {
        archive.file(object.file_path, { name: object.object_key });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('ZIP Stream error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/storage/:bucket/restore - Restore soft-deleted object from Trash Bin
router.post('/storage/:bucket/restore', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { object_key } = req.body;

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, object_key]
    );

    if (!object) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    await run(`UPDATE objects SET IS_DELETED = 0 WHERE id = ?`, [object.id]);
    await logActivity('RESTORE_OBJECT', bucketName, object_key, `Object restored from Trash Bin`);

    res.json({ success: true, message: `Object ${object_key} restored successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/storage/:bucket/versions - List object versions
router.get('/storage/:bucket/versions', async (req, res) => {
  try {
    const { object_key } = req.query;
    const versions = await query(`SELECT * FROM OBJECT_VERSIONS WHERE object_key = ?`, [object_key]);
    res.json({ success: true, versions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/storage/:bucket/* - Download/Stream Object
router.get('/storage/:bucket/*', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const objectKey = decodeURIComponent(req.params[0]);
    const downloadParam = req.query.download;

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, objectKey]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    res.setHeader('ETag', object.etag);
    res.setHeader('Accept-Ranges', 'bytes');

    if (downloadParam === 'true' || downloadParam === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(object.file_name)}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(object.file_name)}"`);
    }

    streamPartialFile(req, res, object.file_path, object.content_type);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/storage/:bucket/* - Soft Delete or Permanent Delete
router.delete('/storage/:bucket/*', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const objectKey = decodeURIComponent(req.params[0]);
    const isPermanent = req.query.permanent === 'true';

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, objectKey]
    );

    if (!object) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    if (isPermanent) {
      deleteObjectFile(object.file_path);
      await run(`DELETE FROM objects WHERE id = ?`, [object.id]);
      await logActivity('PERMANENT_DELETE_OBJECT', bucketName, objectKey, `Object permanently purged`);
      res.json({ success: true, message: `Object ${objectKey} permanently deleted` });
    } else {
      await run(`UPDATE objects SET IS_DELETED = 1 WHERE id = ?`, [object.id]);
      await logActivity('SOFT_DELETE_OBJECT', bucketName, objectKey, `Object moved to Trash Bin`);
      res.json({ success: true, message: `Object ${objectKey} moved to Trash Bin` });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
