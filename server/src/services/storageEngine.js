import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLOBS_DIR = path.join(__dirname, '../../data/storage_blobs');

if (!fs.existsSync(BLOBS_DIR)) {
  fs.mkdirSync(BLOBS_DIR, { recursive: true });
}

export function getBucketDir(bucketName) {
  // Sanitize bucket name to prevent path traversal
  const safeBucket = bucketName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dirPath = path.join(BLOBS_DIR, safeBucket);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function calculateMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(`"${hash.digest('hex')}"`));
    stream.on('error', (err) => reject(err));
  });
}

export async function saveObjectFile(bucketName, objectKey, sourceBufferOrPath) {
  const bucketDir = getBucketDir(bucketName);
  
  // Normalize object key path (e.g. "images/2026/photo.png")
  const normalizedKey = objectKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const targetFilePath = path.join(bucketDir, normalizedKey);

  // Ensure parent subfolders exist (for folder structures)
  const targetDir = path.dirname(targetFilePath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  if (typeof sourceBufferOrPath === 'string') {
    // Move or copy file from temp path
    fs.copyFileSync(sourceBufferOrPath, targetFilePath);
    try { fs.unlinkSync(sourceBufferOrPath); } catch (_) {}
  } else if (Buffer.isBuffer(sourceBufferOrPath)) {
    fs.writeFileSync(targetFilePath, sourceBufferOrPath);
  }

  const etag = await calculateMD5(targetFilePath);
  const stats = fs.statSync(targetFilePath);

  return {
    filePath: targetFilePath,
    sizeBytes: stats.size,
    etag: etag
  };
}

export function deleteObjectFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error('Error deleting file:', err);
      return false;
    }
  }
  return true;
}

export function streamPartialFile(req, res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Check if content is compressible text/code/json/csv
  const isCompressible = contentType && (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('javascript') ||
    contentType.includes('xml') ||
    contentType.includes('csv') ||
    contentType.includes('yaml')
  );

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else if (isCompressible && acceptEncoding.includes('gzip') && fileSize > 512) {
    // Transparent Gzip Compression
    const head = {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'Accept-Ranges': 'none'
    };
    res.writeHead(200, head);
    const rawStream = fs.createReadStream(filePath);
    const gzip = zlib.createGzip({ level: 6 });
    rawStream.pipe(gzip).pipe(res);
  } else if (isCompressible && acceptEncoding.includes('br') && fileSize > 512) {
    // Transparent Brotli Compression
    const head = {
      'Content-Type': contentType,
      'Content-Encoding': 'br',
      'Vary': 'Accept-Encoding',
      'Accept-Ranges': 'none'
    };
    res.writeHead(200, head);
    const rawStream = fs.createReadStream(filePath);
    const brotli = zlib.createBrotliCompress();
    rawStream.pipe(brotli).pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
}
