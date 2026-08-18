import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Search, 
  Trash2, 
  Download, 
  Eye, 
  Link2, 
  Copy, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  File, 
  Check, 
  X, 
  Folder, 
  HardDrive,
  Layers
} from 'lucide-react';

// Direct backend URL when running on Vite dev server (port 3000) to bypass Vite proxy timeouts for multi-gigabyte uploads
const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function ObjectsTab({ buckets, selectedBucket, setSelectedBucket, onGeneratePresigned }) {
  const [objects, setObjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [previewObj, setPreviewObj] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (selectedBucket) {
      fetchObjects();
    }
  }, [selectedBucket, search]);

  async function fetchObjects() {
    if (!selectedBucket) return;
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API_BASE}/api/buckets/${selectedBucket}/objects${query}`);
      const data = await res.json();
      if (data.success) {
        setObjects(data.objects || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // High-performance direct-to-backend Multipart Uploader
  async function handleFileUpload(files) {
    if (!files || files.length === 0 || !selectedBucket) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Dynamic chunk size: 50MB for files > 5GB, 20MB for files > 500MB, 10MB default
      let chunkSize = 10 * 1024 * 1024;
      if (file.size > 5 * 1024 * 1024 * 1024) {
        chunkSize = 50 * 1024 * 1024; // 50MB chunks for 5GB - 100GB+ files
      } else if (file.size > 500 * 1024 * 1024) {
        chunkSize = 20 * 1024 * 1024; // 20MB chunks
      }

      if (file.size > 20 * 1024 * 1024) {
        await uploadLargeFileInChunks(file, chunkSize);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('key', file.name);

        setUploadProgress({ 
          fileName: file.name, 
          currentChunk: 1, 
          totalChunks: 1, 
          percent: 50,
          mode: 'Tek Parça'
        });

        try {
          await fetch(`${API_BASE}/api/storage/${selectedBucket}/upload`, {
            method: 'POST',
            body: formData
          });
        } catch (err) {
          console.error('Upload error:', err);
        }
      }
    }

    setUploadProgress(null);
    fetchObjects();
  }

  async function uploadLargeFileInChunks(file, chunkSize) {
    const totalChunks = Math.ceil(file.size / chunkSize);

    // 1. Initiate Session directly on Express Backend
    const initRes = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object_key: file.name,
        file_name: file.name,
        total_chunks: totalChunks,
        file_size: file.size
      })
    });
    const initData = await initRes.json();
    if (!initData.success) {
      alert('Yükleme başlatılamadı: ' + (initData.error || 'Bilinmeyen hata'));
      return;
    }

    const uploadId = initData.uploadId;

    // 2. Upload Chunks Sequentially with Auto-Retry & Direct Backend Socket
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunkBlob = file.slice(start, end);

      let attempts = 0;
      let success = false;

      while (attempts < 5 && !success) {
        try {
          attempts++;
          const chunkData = new FormData();
          chunkData.append('chunk', chunkBlob, `chunk_${chunkIndex}`);
          chunkData.append('uploadId', uploadId);
          chunkData.append('chunkIndex', chunkIndex);

          const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/chunk`, {
            method: 'POST',
            body: chunkData
          });
          const result = await res.json();
          if (result.success) {
            success = true;
          }
        } catch (err) {
          console.warn(`Parça ${chunkIndex + 1} deneme ${attempts} başarısız, tekrar deneniyor...`);
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (!success) {
        alert(`Parça ${chunkIndex + 1}/${totalChunks} yüklenemedi. Ağ bağlantınızı kontrol edin.`);
        return;
      }

      const percent = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      setUploadProgress({
        fileName: file.name,
        currentChunk: chunkIndex + 1,
        totalChunks,
        percent,
        mode: `Özel Parçalı (${Math.round(chunkSize / (1024*1024))}MB Parçalar)`
      });

      // Yield event loop briefly
      await new Promise(r => setTimeout(r, 10));
    }

    // 3. Complete & Merge All Chunks
    setUploadProgress({
      fileName: file.name + " (Sunucuda Birleştiriliyor...)",
      currentChunk: totalChunks,
      totalChunks,
      percent: 99,
      mode: 'Son İşlem: Diskte Birleştiriliyor'
    });

    const compRes = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        object_key: file.name,
        file_name: file.name,
        content_type: file.type
      })
    });

    const compData = await compRes.json();
    if (!compData.success) {
      alert('Dosya birleştirme hatası: ' + compData.error);
    }
  }

  async function handleDeleteObject(objectKey) {
    if (!window.confirm(`"${objectKey}" nesnesini silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/${encodeURIComponent(objectKey)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchObjects();
      }
    } catch (err) {
      alert('Silme hatası: ' + err.message);
    }
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getFileIcon(contentType) {
    const type = (contentType || '').split('/')[0];
    if (type === 'image') return <FileImage className="w-4.5 h-4.5 text-pink-400" />;
    if (type === 'video') return <FileVideo className="w-4.5 h-4.5 text-purple-400" />;
    if (type === 'audio') return <FileAudio className="w-4.5 h-4.5 text-amber-400" />;
    if (type === 'text' || type === 'application') return <FileText className="w-4.5 h-4.5 text-blue-400" />;
    return <File className="w-4.5 h-4.5 text-slate-400" />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Controls */}
      <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Bucket Dropdown */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hedef Bucket:</span>
          <select
            value={selectedBucket || ''}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-blue-500 transition shadow-inner"
          >
            {buckets.map((b) => (
              <option key={b.id} value={b.name}>
                🪣 {b.name} ({b.object_count || 0} nesne)
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input 
            type="text"
            placeholder="Nesne adı veya ETag ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Drag & Drop Upload Zone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`glass-panel p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center group relative overflow-hidden ${
          dragActive 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' 
            : 'border-slate-700/80 hover:border-blue-500/60 bg-slate-950/40 hover:bg-slate-900/60'
        }`}
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          onChange={(e) => handleFileUpload(e.target.files)} 
          className="hidden" 
        />
        
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition duration-200 shadow-lg shadow-blue-500/10">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="mt-4 font-bold text-white text-lg tracking-tight">
          Dosyaları buraya sürükleyip bırakın (10GB - 100GB+ Destekli)
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Direkt Motor Bağlantılı • Bucket: <span className="text-blue-400 font-mono font-bold">{selectedBucket}</span>
        </p>

        {uploadProgress && (
          <div className="mt-5 max-w-md mx-auto p-4 rounded-xl bg-blue-950/90 border border-blue-500/40 text-xs text-blue-200 space-y-2 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>{uploadProgress.mode}: Parça {uploadProgress.currentChunk} / {uploadProgress.totalChunks}</span>
              </span>
              <span className="font-mono font-bold text-cyan-300">%{uploadProgress.percent}</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 rounded-full transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }}></div>
            </div>
            <span className="text-[11px] font-mono text-slate-400 block truncate">{uploadProgress.fileName}</span>
          </div>
        )}
      </div>

      {/* Objects Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-200 text-base">S3 Nesneleri ({objects.length})</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Dosya Adı & Object Key</th>
                <th className="px-5 py-3.5">Boyut</th>
                <th className="px-5 py-3.5">MIME Tipi</th>
                <th className="px-5 py-3.5 font-mono">ETag (MD5)</th>
                <th className="px-5 py-3.5">Yüklenme Tarihi</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-500">
                    <div className="inline-flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span>Nesneler Yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : objects.length > 0 ? (
                objects.map((obj) => {
                  const directUrl = `${API_BASE || window.location.origin}/api/storage/${obj.bucket_name}/${encodeURIComponent(obj.object_key)}`;

                  return (
                    <tr key={obj.id} className="hover:bg-slate-900/60 transition duration-150 group">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-xl bg-slate-900 border border-white/5 group-hover:border-blue-500/30 transition">
                            {getFileIcon(obj.content_type)}
                          </div>
                          <div>
                            <span 
                              onClick={() => setPreviewObj({ ...obj, directUrl })}
                              className="font-bold text-white hover:text-blue-400 cursor-pointer block text-sm transition"
                            >
                              {obj.object_key}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{obj.file_name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-200 font-semibold">{formatBytes(obj.size_bytes)}</td>
                      <td className="px-5 py-4">
                        <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md text-[10px] text-slate-300 font-mono">
                          {obj.content_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-white/5">{obj.etag}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(obj.created_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* Preview */}
                        <button 
                          onClick={() => setPreviewObj({ ...obj, directUrl })}
                          className="btn-subtle p-2 text-xs" 
                          title="Önizle"
                        >
                          <Eye className="w-4 h-4 text-slate-300" />
                        </button>

                        {/* Presigned */}
                        <button 
                          onClick={() => onGeneratePresigned(obj.bucket_name, obj.object_key)}
                          className="btn-subtle p-2 text-xs text-cyan-400 hover:text-cyan-300"
                          title="İmzalı Bağlantı Oluştur"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>

                        {/* Copy URL */}
                        <button 
                          onClick={() => copyToClipboard(directUrl, obj.id)}
                          className="btn-subtle p-2 text-xs"
                          title="Direkt URL Kopyala"
                        >
                          {copiedKey === obj.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {/* Delete */}
                        <button 
                          onClick={() => handleDeleteObject(obj.object_key)}
                          className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-16 text-slate-500">
                    <div className="space-y-2">
                      <Folder className="w-10 h-10 mx-auto text-slate-700" />
                      <p className="text-sm font-medium">Bu bucket'ta kayıtlı nesne yok.</p>
                      <p className="text-xs text-slate-400 font-normal">Yukarıdaki alana dosya sürükleyip bırakabilirsiniz.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* File Preview Modal */}
      {previewObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-2xl border border-slate-700 bg-slate-950 shadow-2xl relative">
            <button 
              onClick={() => setPreviewObj(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-900 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3.5 mb-5">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                {getFileIcon(previewObj.content_type)}
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg">{previewObj.object_key}</h3>
                <p className="text-xs text-slate-400">{formatBytes(previewObj.size_bytes)} • {previewObj.content_type}</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 border border-white/10 my-4 max-h-[400px] overflow-auto flex items-center justify-center">
              {previewObj.content_type.startsWith('image/') ? (
                <img src={previewObj.directUrl} alt={previewObj.object_key} className="max-h-80 object-contain rounded-lg shadow-xl" />
              ) : previewObj.content_type.startsWith('video/') ? (
                <video controls src={previewObj.directUrl} className="w-full max-h-80 rounded-lg shadow-xl" />
              ) : previewObj.content_type.startsWith('audio/') ? (
                <audio controls src={previewObj.directUrl} className="w-full" />
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm space-y-2">
                  <FileText className="w-12 h-12 mx-auto text-slate-600" />
                  <p>Bu dosya türü için canlı önizleme desteklenmiyor.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
                ETag: {previewObj.etag}
              </div>
              <a 
                href={`${previewObj.directUrl}?download=true`} 
                download
                className="btn-accent"
              >
                <Download className="w-4 h-4" />
                <span>İndir</span>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
