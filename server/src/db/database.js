import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 's3_storage.json');

// Memory state of DB
let state = {
  buckets: [],
  objects: [],
  object_versions: [],
  transfer_sessions: [],
  api_keys: [],
  presigned_urls: [],
  activity_logs: [],
  webhooks: [],
  lifecycle_rules: [],
  users: []
};

// Save DB state to file asynchronously
function saveState() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save DB file:', err);
  }
}

// Load DB state from file and run migrations
function loadState() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      state = { ...state, ...JSON.parse(data) };
    } catch (err) {
      console.error('Failed to load DB file, starting fresh:', err);
    }
  }

  // Ensure arrays exist
  if (!state.object_versions) state.object_versions = [];
  if (!state.transfer_sessions) state.transfer_sessions = [];
  if (!state.webhooks) state.webhooks = [];
  if (!state.lifecycle_rules) state.lifecycle_rules = [];
  if (!state.users) state.users = [];

  // Migration for objects schema
  state.objects.forEach(obj => {
    if (!obj.user_id) obj.user_id = 'user_default';
    if (obj.is_latest === undefined) obj.is_latest = 1;
    if (obj.is_deleted === undefined) obj.is_deleted = 0;
    if (!obj.version_id) obj.version_id = 'v1';
  });

  // Migration for transfer_sessions schema
  state.transfer_sessions.forEach(s => {
    if (!s.started_at) s.started_at = s.created_at || new Date().toISOString();
    if (!s.ended_at && (s.status === 'COMPLETED' || s.status === 'TAMAMLANDI')) {
      s.ended_at = s.updated_at || s.created_at || new Date().toISOString();
    }
  });

  saveState();
}

export async function initDatabase() {
  loadState();

  // Seed default bucket if empty
  if (state.buckets.length === 0) {
    state.buckets.push({
      id: 1,
      name: 'general-storage',
      region: 'eu-central-1',
      is_public: 1,
      quota_bytes: 1099511627776, // 1 TB
      created_at: new Date().toISOString()
    });
    saveState();
  }

  // Seed default API key if empty
  if (state.api_keys.length === 0) {
    const accessKey = 'AKIA' + Math.random().toString(36).substring(2, 10).toUpperCase() + 'S3';
    const secretKey = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    state.api_keys.push({
      id: 1,
      access_key: accessKey,
      secret_key: secretKey,
      name: 'Master Admin Key',
      created_at: new Date().toISOString()
    });
    saveState();
  }

  // Seed default RBAC Users if empty
  if (state.users.length === 0) {
    state.users.push(
      {
        id: 1,
        username: 'admin',
        full_name: 'Master Sistem Yöneticisi',
        role: 'ADMIN',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        username: 'developer_101',
        full_name: 'Ahmet Geliştirici',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      },
      {
        id: 3,
        username: 'viewer_auditor',
        full_name: 'Denetçi / Gözlemci',
        role: 'VIEWER',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      }
    );
    saveState();
  }

  // Seed default Lifecycle Rule if empty
  if (state.lifecycle_rules.length === 0) {
    state.lifecycle_rules.push({
      id: 1,
      name: 'Geçici Dosyaları 7 Gün Sonra Çöpe Taşı',
      bucket_name: 'general-storage',
      prefix: 'temp/',
      action: 'EXPIRE_SOFT_DELETE',
      days_after_creation: 7,
      is_active: 1,
      last_run_at: null,
      affected_objects_count: 0,
      created_at: new Date().toISOString()
    });
    saveState();
  }

  console.log('✅ Custom S3 Storage Engine Database (Lifecycle Rules & RBAC Enabled) initialized.');
}

// --- Query methods ---

export async function query(sql, params = []) {
  const cleanSql = sql.trim().toUpperCase();

  if (cleanSql.includes('FROM BUCKETS')) {
    if (cleanSql.includes('COUNT(O.ID)') || cleanSql.includes('LEFT JOIN OBJECTS')) {
      return state.buckets.map(b => {
        const bucketObjs = state.objects.filter(o => o.bucket_name === b.name && !o.is_deleted);
        const total_bytes = bucketObjs.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
        return {
          ...b,
          object_count: bucketObjs.length,
          total_bytes: total_bytes
        };
      });
    }
    return [...state.buckets];
  }

  if (cleanSql.includes('FROM OBJECTS')) {
    let result = [...state.objects];

    if (cleanSql.includes('IS_DELETED = 1')) {
      result = result.filter(o => o.is_deleted === 1);
    } else {
      result = result.filter(o => !o.is_deleted);
    }

    if (params[0] && typeof params[0] === 'string' && !cleanSql.includes('LIKE')) {
      result = result.filter(o => o.bucket_name === params[0]);
    }

    if (params.length > 1 && cleanSql.includes('LIKE')) {
      const bucket = params[0];
      result = result.filter(o => o.bucket_name === bucket);
      
      const searchPattern = params[1] ? params[1].replace(/%/g, '').toLowerCase() : '';
      if (searchPattern) {
        result = result.filter(o => 
          (o.file_name && o.file_name.toLowerCase().includes(searchPattern)) ||
          (o.object_key && o.object_key.toLowerCase().includes(searchPattern))
        );
      }
    }

    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (cleanSql.includes('FROM TRANSFER_SESSIONS')) {
    let result = [...state.transfer_sessions];
    return result.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  }

  if (cleanSql.includes('FROM OBJECT_VERSIONS')) {
    const objectKey = params[0];
    return state.object_versions.filter(v => v.object_key === objectKey).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (cleanSql.includes('FROM API_KEYS')) {
    return [...state.api_keys];
  }

  if (cleanSql.includes('FROM WEBHOOKS')) {
    return [...state.webhooks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (cleanSql.includes('FROM USERS')) {
    return [...state.users].sort((a, b) => a.id - b.id);
  }

  if (cleanSql.includes('FROM LIFECYCLE_RULES')) {
    return [...state.lifecycle_rules].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (cleanSql.includes('FROM ACTIVITY_LOGS')) {
    return [...state.activity_logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  return [];
}

export async function get(sql, params = []) {
  const cleanSql = sql.trim().toUpperCase();

  if (cleanSql.includes('FROM USERS')) {
    if (cleanSql.includes('WHERE ID = ?')) {
      const id = parseInt(params[0], 10);
      return state.users.find(u => u.id === id) || null;
    }
    if (cleanSql.includes('WHERE USERNAME = ?')) {
      return state.users.find(u => u.username === params[0]) || null;
    }
    return state.users[0] || null;
  }

  if (cleanSql.includes('FROM LIFECYCLE_RULES')) {
    const id = parseInt(params[0], 10);
    return state.lifecycle_rules.find(r => r.id === id) || null;
  }

  if (cleanSql.includes('FROM WEBHOOKS')) {
    const id = parseInt(params[0], 10);
    return state.webhooks.find(w => w.id === id) || null;
  }

  if (cleanSql.includes('FROM BUCKETS')) {
    const bucketName = params[0];
    const b = state.buckets.find(item => item.name === bucketName);
    if (!b) return null;

    const bucketObjs = state.objects.filter(o => o.bucket_name === b.name && !o.is_deleted);
    const total_bytes = bucketObjs.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
    return {
      ...b,
      object_count: bucketObjs.length,
      total_bytes: total_bytes
    };
  }

  if (cleanSql.includes('FROM OBJECTS')) {
    if (cleanSql.includes('SUM(SIZE_BYTES)') || cleanSql.includes('COALESCE')) {
      const bucketName = params[0];
      const bucketObjs = state.objects.filter(o => o.bucket_name === bucketName && !o.is_deleted);
      const total = bucketObjs.reduce((acc, curr) => acc + (curr.size_bytes || 0), 0);
      return { total };
    }
    if (cleanSql.includes('BUCKET_NAME = ? AND OBJECT_KEY = ?')) {
      const [bucketName, objectKey] = params;
      return state.objects.find(o => o.bucket_name === bucketName && o.object_key === objectKey && !o.is_deleted) || null;
    }
    if (cleanSql.includes('INCLUDING_DELETED')) {
      const [bucketName, objectKey] = params;
      return state.objects.find(o => o.bucket_name === bucketName && o.object_key === objectKey) || null;
    }
    if (cleanSql.includes('COUNT(*)')) {
      const bucketName = params[0];
      const count = state.objects.filter(o => o.bucket_name === bucketName && !o.is_deleted).length;
      return { count };
    }
  }

  if (cleanSql.includes('FROM TRANSFER_SESSIONS')) {
    const uploadId = params[0];
    return state.transfer_sessions.find(s => s.upload_id === uploadId) || null;
  }

  if (cleanSql.includes('FROM API_KEYS')) {
    if (params.length > 0) {
      return state.api_keys.find(k => k.access_key === params[0]) || null;
    }
    return state.api_keys[0] || null;
  }

  if (cleanSql.includes('FROM PRESIGNED_URLS')) {
    const token = params[0];
    return state.presigned_urls.find(p => p.token === token) || null;
  }

  return null;
}

export async function run(sql, params = []) {
  const cleanSql = sql.trim().toUpperCase();

  if (cleanSql.startsWith('INSERT INTO BUCKETS')) {
    const [name, region, is_public, quota_bytes] = params;
    const newId = state.buckets.length > 0 ? Math.max(...state.buckets.map(b => b.id)) + 1 : 1;
    const newBucket = {
      id: newId,
      name,
      region: region || 'us-east-1',
      is_public: is_public ? 1 : 0,
      quota_bytes: quota_bytes || 1099511627776,
      created_at: new Date().toISOString()
    };
    state.buckets.push(newBucket);
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE BUCKETS')) {
    const [is_public, quota_bytes, region, name] = params;
    const b = state.buckets.find(item => item.name === name);
    if (b) {
      b.is_public = is_public;
      b.quota_bytes = quota_bytes;
      b.region = region;
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('DELETE FROM BUCKETS')) {
    const name = params[0];
    const initialLen = state.buckets.length;
    state.buckets = state.buckets.filter(b => b.name !== name);
    saveState();
    return { changes: initialLen - state.buckets.length };
  }

  if (cleanSql.startsWith('INSERT INTO TRANSFER_SESSIONS')) {
    const [upload_id, user_id, bucket_name, object_key, file_name, file_size, total_chunks, status] = params;
    const existing = state.transfer_sessions.find(s => s.upload_id === upload_id);
    const now = new Date().toISOString();
    if (existing) {
      existing.status = status;
      existing.updated_at = now;
      if (status === 'COMPLETED' || status === 'FAILED') {
        existing.ended_at = now;
      }
      saveState();
      return { changes: 1 };
    }
    const newId = state.transfer_sessions.length > 0 ? Math.max(...state.transfer_sessions.map(s => s.id)) + 1 : 1;
    state.transfer_sessions.push({
      id: newId,
      upload_id,
      user_id: user_id || 'user_default',
      bucket_name,
      object_key,
      file_name,
      file_size: file_size || 0,
      uploaded_bytes: 0,
      completed_chunks: 0,
      total_chunks: total_chunks || 1,
      status: status || 'IN_PROGRESS',
      error_message: null,
      started_at: now,
      ended_at: (status === 'COMPLETED' ? now : null),
      created_at: now,
      updated_at: now
    });
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE TRANSFER_SESSIONS')) {
    const [status, uploaded_bytes, completed_chunks, upload_id] = params;
    const session = state.transfer_sessions.find(s => s.upload_id === upload_id);
    if (session) {
      session.status = status || session.status;
      if (uploaded_bytes !== undefined) session.uploaded_bytes = uploaded_bytes;
      if (completed_chunks !== undefined) session.completed_chunks = completed_chunks;
      session.updated_at = new Date().toISOString();
      if (status === 'COMPLETED' || status === 'FAILED') {
        session.ended_at = new Date().toISOString();
      }
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('INSERT INTO OBJECTS')) {
    const [bucket_name, object_key, file_name, file_path, size_bytes, content_type, etag, is_public, user_id, version_id] = params;
    const newId = state.objects.length > 0 ? Math.max(...state.objects.map(o => o.id)) + 1 : 1;
    const newObj = {
      id: newId,
      bucket_name,
      object_key,
      file_name,
      file_path,
      size_bytes,
      content_type: content_type || 'application/octet-stream',
      etag,
      is_public: is_public ? 1 : 0,
      user_id: user_id || 'user_default',
      version_id: version_id || 'v1',
      is_latest: 1,
      is_deleted: 0,
      metadata_json: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    state.objects.push(newObj);
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE OBJECTS')) {
    if (cleanSql.includes('SET IS_DELETED = 1')) {
      const id = params[0];
      const obj = state.objects.find(o => o.id === id);
      if (obj) {
        obj.is_deleted = 1;
        saveState();
        return { changes: 1 };
      }
    }
    if (cleanSql.includes('SET IS_DELETED = 0')) {
      const id = params[0];
      const obj = state.objects.find(o => o.id === id);
      if (obj) {
        obj.is_deleted = 0;
        saveState();
        return { changes: 1 };
      }
    }
    const [size_bytes, content_type, etag, is_public, file_path, version_id, id] = params;
    const obj = state.objects.find(o => o.id === id);
    if (obj) {
      state.object_versions.push({
        id: state.object_versions.length + 1,
        object_id: obj.id,
        bucket_name: obj.bucket_name,
        object_key: obj.object_key,
        file_name: obj.file_name,
        file_path: obj.file_path,
        size_bytes: obj.size_bytes,
        content_type: obj.content_type,
        etag: obj.etag,
        version_id: obj.version_id || 'v1',
        created_at: obj.updated_at || obj.created_at
      });

      obj.size_bytes = size_bytes;
      obj.content_type = content_type;
      obj.etag = etag;
      obj.is_public = is_public;
      obj.file_path = file_path;
      obj.version_id = version_id || `v${state.object_versions.filter(v => v.object_key === obj.object_key).length + 1}`;
      obj.updated_at = new Date().toISOString();
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('DELETE FROM OBJECTS')) {
    if (cleanSql.includes('WHERE BUCKET_NAME = ?')) {
      const bucketName = params[0];
      const initial = state.objects.length;
      state.objects = state.objects.filter(o => o.bucket_name !== bucketName);
      saveState();
      return { changes: initial - state.objects.length };
    }
    if (cleanSql.includes('WHERE ID = ?')) {
      const id = params[0];
      const initial = state.objects.length;
      state.objects = state.objects.filter(o => o.id !== id);
      saveState();
      return { changes: initial - state.objects.length };
    }
  }

  if (cleanSql.startsWith('INSERT INTO PRESIGNED_URLS')) {
    const [token, bucket_name, object_key, action, expires_at] = params;
    const newId = state.presigned_urls.length > 0 ? Math.max(...state.presigned_urls.map(p => p.id)) + 1 : 1;
    state.presigned_urls.push({
      id: newId,
      token,
      bucket_name,
      object_key,
      action,
      expires_at,
      created_at: new Date().toISOString()
    });
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('INSERT INTO WEBHOOKS')) {
    const [name, target_url, events, format, is_active] = params;
    const newId = state.webhooks.length > 0 ? Math.max(...state.webhooks.map(w => w.id)) + 1 : 1;
    state.webhooks.push({
      id: newId,
      name: name || 'Custom Webhook',
      target_url,
      events: events || 's3:ObjectCreated:*',
      format: format || 'standard_s3_json',
      is_active: is_active === undefined ? 1 : is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE WEBHOOKS')) {
    const [name, target_url, events, format, is_active, id] = params;
    const webhook = state.webhooks.find(w => w.id === parseInt(id, 10));
    if (webhook) {
      if (name !== undefined) webhook.name = name;
      if (target_url !== undefined) webhook.target_url = target_url;
      if (events !== undefined) webhook.events = events;
      if (format !== undefined) webhook.format = format;
      if (is_active !== undefined) webhook.is_active = is_active;
      webhook.updated_at = new Date().toISOString();
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('DELETE FROM WEBHOOKS')) {
    const id = parseInt(params[0], 10);
    const initial = state.webhooks.length;
    state.webhooks = state.webhooks.filter(w => w.id !== id);
    saveState();
    return { changes: initial - state.webhooks.length };
  }

  if (cleanSql.startsWith('INSERT INTO USERS')) {
    const [username, full_name, role, status] = params;
    const newId = state.users.length > 0 ? Math.max(...state.users.map(u => u.id)) + 1 : 1;
    state.users.push({
      id: newId,
      username,
      full_name: full_name || username,
      role: role || 'DEVELOPER',
      status: status || 'ACTIVE',
      created_at: new Date().toISOString()
    });
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE USERS')) {
    const [full_name, role, status, id] = params;
    const user = state.users.find(u => u.id === parseInt(id, 10));
    if (user) {
      if (full_name !== undefined) user.full_name = full_name;
      if (role !== undefined) user.role = role;
      if (status !== undefined) user.status = status;
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('DELETE FROM USERS')) {
    const id = parseInt(params[0], 10);
    const initial = state.users.length;
    state.users = state.users.filter(u => u.id !== id);
    saveState();
    return { changes: initial - state.users.length };
  }

  if (cleanSql.startsWith('INSERT INTO LIFECYCLE_RULES')) {
    const [name, bucket_name, prefix, action, days_after_creation, is_active] = params;
    const newId = state.lifecycle_rules.length > 0 ? Math.max(...state.lifecycle_rules.map(r => r.id)) + 1 : 1;
    state.lifecycle_rules.push({
      id: newId,
      name: name || 'Lifecycle Rule',
      bucket_name: bucket_name || '*',
      prefix: prefix || '',
      action: action || 'EXPIRE_SOFT_DELETE',
      days_after_creation: parseInt(days_after_creation, 10) || 7,
      is_active: is_active === undefined ? 1 : is_active,
      last_run_at: null,
      affected_objects_count: 0,
      created_at: new Date().toISOString()
    });
    saveState();
    return { lastID: newId, changes: 1 };
  }

  if (cleanSql.startsWith('UPDATE LIFECYCLE_RULES')) {
    const [name, bucket_name, prefix, action, days_after_creation, is_active, id] = params;
    const rule = state.lifecycle_rules.find(r => r.id === parseInt(id, 10));
    if (rule) {
      if (name !== undefined) rule.name = name;
      if (bucket_name !== undefined) rule.bucket_name = bucket_name;
      if (prefix !== undefined) rule.prefix = prefix;
      if (action !== undefined) rule.action = action;
      if (days_after_creation !== undefined) rule.days_after_creation = parseInt(days_after_creation, 10);
      if (is_active !== undefined) rule.is_active = is_active;
      saveState();
      return { changes: 1 };
    }
    return { changes: 0 };
  }

  if (cleanSql.startsWith('DELETE FROM LIFECYCLE_RULES')) {
    const id = parseInt(params[0], 10);
    const initial = state.lifecycle_rules.length;
    state.lifecycle_rules = state.lifecycle_rules.filter(r => r.id !== id);
    saveState();
    return { changes: initial - state.lifecycle_rules.length };
  }

  return { changes: 0 };
}

export async function logActivity(action, bucketName, objectKey, details) {
  try {
    const newId = state.activity_logs.length > 0 ? Math.max(...state.activity_logs.map(l => l.id)) + 1 : 1;
    state.activity_logs.unshift({
      id: newId,
      action,
      bucket_name: bucketName || null,
      object_key: objectKey || null,
      details: details || null,
      timestamp: new Date().toISOString()
    });

    if (state.activity_logs.length > 200) {
      state.activity_logs = state.activity_logs.slice(0, 200);
    }
    saveState();
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}
