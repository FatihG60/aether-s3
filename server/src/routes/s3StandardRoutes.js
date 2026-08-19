import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mime from 'mime-types';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { query, get, run, logActivity } from '../db/database.js';
import { saveObjectFile, deleteObjectFile, streamPartialFile, calculateMD5, getBucketDir } from '../services/storageEngine.js';
import { recordBandwidthIngress, recordBandwidthEgress } from './statsRoutes.js';

const router = express.Router();
const xmlParser = new XMLParser();

const CHUNKS_DIR = path.join(process.cwd(), 'data/temp_chunks');
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// In-memory multipart registry for standard S3 uploads
const s3MultipartSessions = new Map();

// Helper to send XML responses
function sendXml(res, xmlString, statusCode = 200) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.status(statusCode).send(xmlString);
}

// 1. GET / - List All Buckets (Standard S3 ListAllMyBucketsResult)
router.get('/', async (req, res, next) => {
  // If request has query parameters or headers meant for other routes, skip
  if (req.path !== '/') return next();

  try {
    const buckets = await query(`SELECT * FROM BUCKETS`);
    const ownerId = 'aether-owner-id';
    const ownerName = 'aether-storage-admin';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Owner>
    <ID>${ownerId}</ID>
    <DisplayName>${ownerName}</DisplayName>
  </Owner>
  <Buckets>
${buckets.map(b => `    <Bucket>
      <Name>${b.name}</Name>
      <CreationDate>${new Date(b.created_at).toISOString()}</CreationDate>
    </Bucket>`).join('\n')}
  </Buckets>
</ListAllMyBucketsResult>`;

    sendXml(res, xml);
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

// 2. HEAD /:bucket - Check if bucket exists
router.head('/:bucket', async (req, res, next) => {
  const bucketName = req.params.bucket;
  if (bucketName === 'api') return next();

  const bucket = await get(`SELECT * FROM BUCKETS WHERE name = ?`, [bucketName]);
  if (!bucket) {
    return res.status(404).end();
  }
  res.status(200).end();
});

// 3. PUT /:bucket - Create Bucket (Standard S3 PutBucket)
router.put('/:bucket', async (req, res, next) => {
  const bucketName = req.params.bucket;
  if (bucketName === 'api') return next();

  try {
    const existing = await get(`SELECT * FROM BUCKETS WHERE name = ?`, [bucketName]);
    if (existing) {
      return res.status(200).end();
    }

    await run(
      `INSERT INTO BUCKETS (name, region, is_public, quota_bytes) VALUES (?, ?, ?, ?)`,
      [bucketName, 'eu-central-1', 1, 1099511627776]
    );

    await logActivity('CREATE_BUCKET', bucketName, null, 'Bucket created via AWS S3 REST API');
    res.setHeader('Location', `/${bucketName}`);
    res.status(200).end();
  } catch (err) {
    sendXml(res, `<Error><Code>BucketAlreadyExists</Code><Message>${err.message}</Message></Error>`, 409);
  }
});

// 4. DELETE /:bucket - Delete Bucket (Standard S3 DeleteBucket)
router.delete('/:bucket', async (req, res, next) => {
  const bucketName = req.params.bucket;
  if (bucketName === 'api') return next();

  try {
    await run(`DELETE FROM BUCKETS WHERE name = ?`, [bucketName]);
    await logActivity('DELETE_BUCKET', bucketName, null, 'Bucket deleted via AWS S3 REST API');
    res.status(204).end();
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

// 5. GET /:bucket - List Objects inside Bucket (ListObjects & ListObjectsV2)
router.get('/:bucket', async (req, res, next) => {
  const bucketName = req.params.bucket;
  if (bucketName === 'api' || req.query.download || req.query.view) return next();

  try {
    const bucket = await get(`SELECT * FROM BUCKETS WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return sendXml(res, `<Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist.</Message></Error>`, 404);
    }

    const prefix = req.query.prefix || '';
    const delimiter = req.query.delimiter || '';
    const maxKeys = parseInt(req.query['max-keys'] || req.query.maxKeys || '1000', 10);
    const isV2 = req.query['list-type'] === '2';

    let sql = `SELECT * FROM OBJECTS WHERE bucket_name = ? AND is_deleted = 0`;
    const params = [bucketName];

    if (prefix) {
      sql += ` AND object_key LIKE ?`;
      params.push(`${prefix}%`);
    }

    sql += ` ORDER BY created_at DESC`;

    const allObjects = await query(sql, params);
    const directObjects = [];
    const commonPrefixesSet = new Set();

    allObjects.forEach(obj => {
      const key = obj.object_key;
      const relativeKey = prefix ? key.slice(prefix.length) : key;
      const slashIndex = delimiter ? relativeKey.indexOf(delimiter) : -1;

      if (slashIndex !== -1) {
        const subfolder = relativeKey.slice(0, slashIndex + 1);
        commonPrefixesSet.add(prefix + subfolder);
      } else {
        directObjects.push(obj);
      }
    });

    const commonPrefixes = Array.from(commonPrefixesSet);
    const objectsToRender = directObjects.slice(0, maxKeys);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix>${prefix}</Prefix>
  <MaxKeys>${maxKeys}</MaxKeys>
  <Delimiter>${delimiter}</Delimiter>
  <IsTruncated>false</IsTruncated>
  ${isV2 ? `<KeyCount>${objectsToRender.length}</KeyCount>` : ''}
${objectsToRender.map(obj => `  <Contents>
    <Key>${obj.object_key}</Key>
    <LastModified>${new Date(obj.updated_at || obj.created_at).toISOString()}</LastModified>
    <ETag>${obj.etag}</ETag>
    <Size>${obj.size_bytes}</Size>
    <StorageClass>STANDARD</StorageClass>
  </Contents>`).join('\n')}
${commonPrefixes.map(cp => `  <CommonPrefixes>
    <Prefix>${cp}</Prefix>
  </CommonPrefixes>`).join('\n')}
</ListBucketResult>`;

    sendXml(res, xml);
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

// 6. HEAD /:bucket/* - Object Metadata (Standard S3 HeadObject)
router.head('/:bucket/*', async (req, res, next) => {
  const bucketName = req.params.bucket;
  const objectKey = decodeURIComponent(req.params[0]);
  if (bucketName === 'api') return next();

  try {
    const object = await get(
      `SELECT * FROM OBJECTS WHERE bucket_name = ? AND object_key = ? AND is_deleted = 0`,
      [bucketName, objectKey]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return res.status(404).end();
    }

    res.setHeader('ETag', object.etag);
    res.setHeader('Content-Length', object.size_bytes);
    res.setHeader('Content-Type', object.content_type || 'application/octet-stream');
    res.setHeader('Last-Modified', new Date(object.updated_at || object.created_at).toUTCString());
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(200).end();
  } catch (err) {
    res.status(500).end();
  }
});

// 7. GET /:bucket/* - Download/Stream Object (Standard S3 GetObject)
router.get('/:bucket/*', async (req, res, next) => {
  const bucketName = req.params.bucket;
  const objectKey = decodeURIComponent(req.params[0]);
  if (bucketName === 'api' || bucketName === 'assets') return next();

  try {
    const object = await get(
      `SELECT * FROM OBJECTS WHERE bucket_name = ? AND object_key = ? AND is_deleted = 0`,
      [bucketName, objectKey]
    );

    if (!object || !fs.existsSync(object.file_path)) {
      return sendXml(res, `<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>${objectKey}</Key></Error>`, 404);
    }

    recordBandwidthEgress(object.size_bytes);

    res.setHeader('ETag', object.etag);
    res.setHeader('Content-Type', object.content_type || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Last-Modified', new Date(object.updated_at || object.created_at).toUTCString());

    streamPartialFile(req, res, object.file_path, object.content_type);
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

// 8. PUT /:bucket/* - Upload Object Stream (Standard S3 PutObject & AWS CLI / Boto3 stream)
router.put('/:bucket/*', async (req, res, next) => {
  const bucketName = req.params.bucket;
  const objectKey = decodeURIComponent(req.params[0]);
  if (bucketName === 'api') return next();

  try {
    const bucket = await get(`SELECT * FROM BUCKETS WHERE name = ?`, [bucketName]);
    if (!bucket) {
      return sendXml(res, `<Error><Code>NoSuchBucket</Code><Message>Bucket does not exist.</Message></Error>`, 404);
    }

    const bucketDir = getBucketDir(bucketName);
    const normalizedKey = objectKey.replace(/\\/g, '/').replace(/^\/+/, '');
    const targetFilePath = path.join(bucketDir, normalizedKey);

    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(targetFilePath);
    const hash = crypto.createHash('md5');
    let totalBytes = 0;

    req.on('data', (chunk) => {
      hash.update(chunk);
      totalBytes += chunk.length;
    });

    req.pipe(writeStream);

    writeStream.on('finish', async () => {
      recordBandwidthIngress(totalBytes);
      const etag = `"${hash.digest('hex')}"`;
      const fileName = path.basename(normalizedKey);
      const contentType = req.headers['content-type'] || mime.lookup(fileName) || 'application/octet-stream';
      const newVersionId = `v${Date.now()}`;
      const userId = req.headers['x-amz-meta-userid'] || 'aws_cli_user';

      const existing = await get(
        `SELECT id FROM OBJECTS WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
        [bucketName, normalizedKey]
      );

      if (existing) {
        await run(
          `UPDATE OBJECTS SET size_bytes = ?, content_type = ?, etag = ?, file_path = ?, version_id = ?, is_deleted = 0 WHERE id = ?`,
          [totalBytes, contentType, etag, targetFilePath, newVersionId, existing.id]
        );
      } else {
        await run(
          `INSERT INTO OBJECTS (bucket_name, object_key, file_name, file_path, size_bytes, content_type, etag, is_public, user_id, version_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [bucketName, normalizedKey, fileName, targetFilePath, totalBytes, contentType, etag, bucket.is_public, userId, newVersionId]
        );
      }

      // Record transfer session
      const uploadId = 's3_put_' + Date.now();
      await run(
        `INSERT INTO TRANSFER_SESSIONS (upload_id, user_id, bucket_name, object_key, file_name, file_size, total_chunks, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uploadId, userId, bucketName, normalizedKey, fileName, totalBytes, 1, 'COMPLETED']
      );

      await logActivity('S3_PUT_OBJECT', bucketName, normalizedKey, `Uploaded via AWS S3 REST API (${totalBytes} bytes)`);

      res.setHeader('ETag', etag);
      res.status(200).end();
    });

    writeStream.on('error', (err) => {
      sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
    });
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

// 9. DELETE /:bucket/* - Delete Object (Standard S3 DeleteObject)
router.delete('/:bucket/*', async (req, res, next) => {
  const bucketName = req.params.bucket;
  const objectKey = decodeURIComponent(req.params[0]);
  if (bucketName === 'api') return next();

  try {
    const object = await get(
      `SELECT * FROM OBJECTS WHERE bucket_name = ? AND object_key = ? INCLUDING_DELETED`,
      [bucketName, objectKey]
    );

    if (object) {
      deleteObjectFile(object.file_path);
      await run(`DELETE FROM OBJECTS WHERE id = ?`, [object.id]);
      await logActivity('S3_DELETE_OBJECT', bucketName, objectKey, 'Deleted via AWS S3 REST API');
    }

    res.status(204).end();
  } catch (err) {
    sendXml(res, `<Error><Code>InternalError</Code><Message>${err.message}</Message></Error>`, 500);
  }
});

export default router;
