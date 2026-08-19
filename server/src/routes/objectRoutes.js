import express from 'express';
import multer from 'multer';
import mime from 'mime-types';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import Jimp from 'jimp';
import { v4 as uuidv4 } from 'uuid';
import { query, get, run, logActivity } from '../db/database.js';
import { saveObjectFile, deleteObjectFile, streamPartialFile, calculateMD5, getBucketDir } from '../services/storageEngine.js';
import { recordBandwidthIngress, recordBandwidthEgress } from './statsRoutes.js';

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), 'data/temp') });

const CHUNKS_DIR = path.join(process.cwd(), 'data/temp_chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

const THUMBNAIL_DIR = path.join(process.cwd(), 'data/thumbnails');
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

// In-Memory Live Upload Telemetry Registry
export const liveUploadSessions = new Map();

// Cleanup inactive sessions older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of liveUploadSessions.entries()) {
    if (now - session.lastUpdated > 10 * 60 * 1000) {
      liveUploadSessions.delete(id);
    }
  }
}, 30000);

// Helper: Structured Path Generator {user}/{YYYY-MM-DD}/{guid}/{file_name}
function generateStructuredObjectKey(userId, originalFileName) {
  const user = userId && userId.trim() ? userId.trim() : 'user_default';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const guid = uuidv4();
  const safeFileName = path.basename(originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${user}/${today}/${guid}/${safeFileName}`;
}

// GET /api/buckets/:bucket/objects - List objects (with Folder Hierarchy / Delimiter support)
router.get('/buckets/:bucket/objects', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { search, prefix = '', delimiter } = req.query;

    const bucket = await get(`SELECT * FROM buckets WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return res.status(404).json({ success: false, error: 'Bucket not found' });
    }

    let sql = `SELECT * FROM objects WHERE bucket_name = ?`;
    const params = [bucketName];

    if (search) {
      sql += ` AND (file_name LIKE ? OR object_key LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    } else if (prefix) {
      sql += ` AND object_key LIKE ?`;
      params.push(`${prefix}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const allObjects = await query(sql, params);

    // If delimiter is specified (e.g. '/'), compute CommonPrefixes (Folders) and direct Objects
    if (delimiter === '/' && !search) {
      const commonPrefixesSet = new Set();
      const directObjects = [];

      allObjects.forEach(obj => {
        const key = obj.object_key;
        const relativeKey = prefix ? key.slice(prefix.length) : key;
        const slashIndex = relativeKey.indexOf('/');

        if (slashIndex !== -1) {
          const folderName = relativeKey.slice(0, slashIndex + 1);
          commonPrefixesSet.add(prefix + folderName);
        } else {
          directObjects.push(obj);
        }
      });

      const commonPrefixes = Array.from(commonPrefixesSet).sort().map(p => ({
        prefix: p,
        name: p.slice(prefix.length).replace(/\/$/, '')
      }));

      return res.json({
        success: true,
        objects: directObjects,
        commonPrefixes,
        currentPrefix: prefix,
        totalCount: allObjects.length
      });
    }

    res.json({ success: true, objects: allObjects, totalCount: allObjects.length });
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
    recordBandwidthIngress(savedInfo.sizeBytes);

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

    // Persistent Transfer Tracking Record
    const uploadId = 'upload_single_' + Date.now();
    await run(
      `INSERT INTO TRANSFER_SESSIONS (upload_id, user_id, bucket_name, object_key, file_name, file_size, total_chunks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uploadId, userId, bucketName, objectKey, file.originalname, savedInfo.sizeBytes, 1, 'COMPLETED']
    );
    await run(
      `UPDATE TRANSFER_SESSIONS SET status = 'COMPLETED', uploaded_bytes = ?, completed_chunks = 1 WHERE upload_id = ?`,
      [savedInfo.sizeBytes, uploadId]
    );

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

// --- MULTIPART CHUNKED UPLOAD ENDPOINTS & LIVE TELEMETRY ---

// 1. Initiate Multipart Upload
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

    const totalChunksInt = parseInt(total_chunks, 10) || 1;
    const fileSizeInt = parseInt(file_size, 10) || 0;
    const userStr = user_id || 'user_default';

    // Telemetry memory state
    liveUploadSessions.set(uploadId, {
      uploadId,
      userId: userStr,
      bucketName,
      objectKey: finalKey,
      fileName: file_name || finalKey,
      totalChunks: totalChunksInt,
      completedChunks: 0,
      fileSize: fileSizeInt,
      uploadedBytes: 0,
      speedBytesPerSec: 0,
      status: 'IN_PROGRESS',
      startTime: Date.now(),
      lastUpdated: Date.now()
    });

    // DB Persistence Record
    await run(
      `INSERT INTO TRANSFER_SESSIONS (upload_id, user_id, bucket_name, object_key, file_name, file_size, total_chunks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uploadId, userStr, bucketName, finalKey, file_name || finalKey, fileSizeInt, totalChunksInt, 'IN_PROGRESS']
    );

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

// 2. Upload Chunk & Update Telemetry + DB
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

    recordBandwidthIngress(file.size);

    // Telemetry Update
    const session = liveUploadSessions.get(uploadId);
    let currentUploadedBytes = 0;
    let currentCompletedChunks = 0;

    if (session) {
      session.completedChunks += 1;
      session.uploadedBytes += file.size;
      const now = Date.now();
      const elapsedSec = (now - session.startTime) / 1000;
      if (elapsedSec > 0) {
        session.speedBytesPerSec = session.uploadedBytes / elapsedSec;
      }
      session.lastUpdated = now;
      currentUploadedBytes = session.uploadedBytes;
      currentCompletedChunks = session.completedChunks;
    }

    // Async DB update
    run(
      `UPDATE TRANSFER_SESSIONS SET status = 'IN_PROGRESS', uploaded_bytes = ?, completed_chunks = ? WHERE upload_id = ?`,
      [currentUploadedBytes, currentCompletedChunks, uploadId]
    ).catch(() => {});

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

    const fileHandle = await fs.promises.open(targetFilePath, 'w');
    const hash = crypto.createHash('md5');
    let totalSizeBytes = 0;

    for (const chunkFile of files) {
      const chunkPath = path.join(uploadDir, chunkFile);
      const chunkBuffer = await fs.promises.readFile(chunkPath);
      
      hash.update(chunkBuffer);
      await fileHandle.write(chunkBuffer, 0, chunkBuffer.length, totalSizeBytes);
      totalSizeBytes += chunkBuffer.length;

      fs.promises.unlink(chunkPath).catch(() => {});
    }

    await fileHandle.close();

    try { await fs.promises.rmdir(uploadDir); } catch (_) {}

    const etag = `"${hash.digest('hex')}"`;
    const finalContentType = content_type || mime.lookup(file_name) || 'application/octet-stream';

    const existing = await get(
      `SELECT id FROM objects WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, normalizedKey]
    );

    const newVersionId = `v${Date.now()}`;

    if (existing) {
      await run(
        `UPDATE objects SET size_bytes = ?, content_type = ?, etag = ?, file_path = ?, version_id = ? WHERE id = ?`,
        [totalSizeBytes, finalContentType, etag, targetFilePath, newVersionId, existing.id]
      );
    } else {
      await run(
        `INSERT INTO objects (bucket_name, object_key, file_name, file_path, size_bytes, content_type, etag, is_public, user_id, version_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bucketName, normalizedKey, file_name || normalizedKey, targetFilePath, totalSizeBytes, finalContentType, etag, bucket.is_public, user_id || 'user_default', newVersionId]
      );
    }

    await logActivity('MULTIPART_UPLOAD_COMPLETE', bucketName, normalizedKey, `Fast-merged ${files.length} chunks, Size: ${totalSizeBytes} bytes`);

    // Update telemetry memory & DB state
    const session = liveUploadSessions.get(uploadId);
    if (session) {
      session.status = 'COMPLETED';
      session.uploadedBytes = totalSizeBytes;
      session.completedChunks = session.totalChunks;
      session.lastUpdated = Date.now();
    }

    await run(
      `UPDATE TRANSFER_SESSIONS SET status = 'COMPLETED', uploaded_bytes = ?, completed_chunks = total_chunks WHERE upload_id = ?`,
      [totalSizeBytes, uploadId]
    );

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
    console.error('Multipart complete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ZIP / ARCHIVE INSPECTION & EXTRACTION ENDPOINTS ---

// GET /api/storage/:bucket/zip-inspect - Inspect file tree inside a .zip file
router.get('/storage/:bucket/zip-inspect', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ success: false, error: 'Object key is required' });
    }

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, key]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).json({ success: false, error: 'ZIP file not found' });
    }

    const zip = new AdmZip(object.file_path);
    const zipEntries = zip.getEntries();

    const entries = zipEntries.map(entry => ({
      name: entry.entryName,
      size: entry.header.size,
      compressedSize: entry.header.compressedSize,
      isDirectory: entry.isDirectory,
      time: entry.header.time
    }));

    res.json({
      success: true,
      zipFile: object.object_key,
      totalEntries: entries.length,
      entries
    });
  } catch (err) {
    console.error('ZIP Inspect error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to inspect ZIP file' });
  }
});

// GET /api/storage/:bucket/zip-extract - Extract & download a single file from inside a .zip archive
router.get('/storage/:bucket/zip-extract', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const { key, entry: entryName } = req.query;

    if (!key || !entryName) {
      return res.status(400).json({ success: false, error: 'Object key and entry name are required' });
    }

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, key]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).json({ success: false, error: 'ZIP file not found' });
    }

    const zip = new AdmZip(object.file_path);
    const zipEntry = zip.getEntry(entryName);

    if (!zipEntry || zipEntry.isDirectory) {
      return res.status(404).json({ success: false, error: 'Entry not found or is a directory' });
    }

    const fileBuffer = zip.readFile(zipEntry);
    const baseFileName = path.basename(entryName);
    const mimeType = mime.lookup(baseFileName) || 'application/octet-stream';

    recordBandwidthEgress(fileBuffer.length);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseFileName)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (err) {
    console.error('ZIP Extract error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to extract from ZIP' });
  }
});

// --- SERVER-SIDE FAST MOVE / RENAME OBJECT (COPY OBJECT) ---

// POST /api/storage/:bucket/move - Move or Rename object on server with zero network re-upload
router.post('/storage/:bucket/move', async (req, res) => {
  try {
    const currentBucket = req.params.bucket;
    const { source_key, target_key, new_bucket } = req.body;

    if (!source_key || !target_key) {
      return res.status(400).json({ success: false, error: 'source_key and target_key are required' });
    }

    const destBucket = new_bucket || currentBucket;

    const sourceObj = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [currentBucket, source_key]
    );

    if (!sourceObj || !fs.existsSync(sourceObj.file_path)) {
      return res.status(404).json({ success: false, error: 'Source object not found' });
    }

    const destBucketDir = getBucketDir(destBucket);
    const normalizedDestKey = target_key.replace(/\\/g, '/').replace(/^\/+/, '');
    const newFilePath = path.join(destBucketDir, normalizedDestKey);

    const newFileDir = path.dirname(newFilePath);
    if (!fs.existsSync(newFileDir)) {
      await fs.promises.mkdir(newFileDir, { recursive: true });
    }

    await fs.promises.copyFile(sourceObj.file_path, newFilePath);
    try { await fs.promises.unlink(sourceObj.file_path); } catch (_) {}

    const newFileName = path.basename(normalizedDestKey);
    const newContentType = mime.lookup(newFileName) || sourceObj.content_type;

    await run(
      `UPDATE objects SET bucket_name = ?, object_key = ?, file_name = ?, file_path = ?, content_type = ? WHERE id = ?`,
      [destBucket, normalizedDestKey, newFileName, newFilePath, newContentType, sourceObj.id]
    );

    await logActivity('MOVE_OBJECT', currentBucket, source_key, `Moved to ${destBucket}/${normalizedDestKey}`);

    const updatedObj = await get(`SELECT * FROM objects WHERE id = ?`, [sourceObj.id]);

    res.json({
      success: true,
      message: 'Object moved/renamed successfully',
      object: updatedObj
    });
  } catch (err) {
    console.error('Move object error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- AUTOMATIC MEDIA THUMBNAIL ENGINE ---

// GET /api/storage/:bucket/thumbnail/* - Generate & serve lightweight cached image thumbnail
router.get('/storage/:bucket/thumbnail/*', async (req, res) => {
  try {
    const bucketName = req.params.bucket;
    const objectKey = decodeURIComponent(req.params[0]);

    const object = await get(
      `SELECT * FROM objects WHERE bucket_name = ? AND object_key = ?`,
      [bucketName, objectKey]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    const isImage = object.content_type && object.content_type.startsWith('image/');
    if (!isImage || object.content_type.includes('svg')) {
      return streamPartialFile(req, res, object.file_path, object.content_type);
    }

    const thumbHash = crypto.createHash('md5').update(`${bucketName}_${objectKey}_${object.etag}`).digest('hex');
    const thumbPath = path.join(THUMBNAIL_DIR, `${thumbHash}.jpg`);

    if (fs.existsSync(thumbPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(thumbPath).pipe(res);
    }

    try {
      const image = await Jimp.read(object.file_path);
      await image
        .cover(160, 160)
        .quality(80)
        .writeAsync(thumbPath);

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      fs.createReadStream(thumbPath).pipe(res);
    } catch (jimpErr) {
      streamPartialFile(req, res, object.file_path, object.content_type);
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/storage/:bucket/download-zip - Stream Dynamic ZIP
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
        recordBandwidthEgress(object.size_bytes);
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

    recordBandwidthEgress(object.size_bytes);

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
