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
  Layers,
  Archive,
  RotateCcw,
  History,
  User,
  GitBranch,
  ShieldCheck,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function ObjectsTab({ buckets, selectedBucket, setSelectedBucket, onGeneratePresigned }) {
  const [objects, setObjects] = useState([]);
  const [trashObjects, setTrashObjects] = useState([]);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'trash'
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [previewObj, setPreviewObj] = useState(null);
  const [versionsModalObj, setVersionsModalObj] = useState(null);
  const [versionsList, setVersionsList] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // Structured Pathing Options
  const [useStructuredPath, setUseStructuredPath] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('user_101');

  // Multi-select for ZIP download
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Sorting & Pagination State
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (selectedBucket) {
      fetchObjects();
      fetchTrash();
    }
  }, [selectedBucket, search, viewMode]);

  // Reset page when search or viewMode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewMode, pageSize, sortField, sortDir]);

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

  async function fetchTrash() {
    if (!selectedBucket) return;
    try {
      const res = await fetch(`${API_BASE}/api/buckets/${selectedBucket}/trash`);
      const data = await res.json();
      if (data.success) {
        setTrashObjects(data.objects || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Sort
  function handleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  // Get Sorted & Paginated Data
  const targetList = viewMode === 'active' ? objects : trashObjects;
  
  const sortedObjects = [...targetList].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedObjects.length / pageSize) || 1;
  const paginatedObjects = sortedObjects.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 3-Parallel Worker Pool for High-Speed Multipart Upload
  async function handleFileUpload(files) {
    if (!files || files.length === 0 || !selectedBucket) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      let chunkSize = 10 * 1024 * 1024;
      if (file.size > 5 * 1024 * 1024 * 1024) {
        chunkSize = 50 * 1024 * 1024;
      } else if (file.size > 500 * 1024 * 1024) {
        chunkSize = 20 * 1024 * 1024;
      }

      if (file.size > 20 * 1024 * 1024) {
        await uploadLargeFileParallelChunks(file, chunkSize);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', currentUserId);
        formData.append('structured_path', useStructuredPath ? 'true' : 'false');
        if (!useStructuredPath) formData.append('key', file.name);

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

  // Parallel Chunk Uploader (Concurrency pool = 3)
  async function uploadLargeFileParallelChunks(file, chunkSize) {
    const totalChunks = Math.ceil(file.size / chunkSize);

    const initRes = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object_key: file.name,
        file_name: file.name,
        total_chunks: totalChunks,
        file_size: file.size,
        user_id: currentUserId,
        structured_path: useStructuredPath
      })
    });
    const initData = await initRes.json();
    if (!initData.success) {
      alert('Yükleme başlatılamadı: ' + (initData.error || 'Bilinmeyen hata'));
      return;
    }

    const { uploadId, objectKey } = initData;
    let completedCount = 0;

    const CONCURRENCY = 3;
    const chunkIndices = Array.from({ length: totalChunks }, (_, idx) => idx);

    async function worker(index) {
      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunkBlob = file.slice(start, end);

      let attempts = 0;
      let success = false;

      while (attempts < 5 && !success) {
        try {
          attempts++;
          const chunkData = new FormData();
          chunkData.append('chunk', chunkBlob, `chunk_${index}`);
          chunkData.append('uploadId', uploadId);
          chunkData.append('chunkIndex', index);

          const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/chunk`, {
            method: 'POST',
            body: chunkData
          });
          const result = await res.json();
          if (result.success) {
            success = true;
          }
        } catch (err) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      if (!success) throw new Error(`Chunk ${index} failed`);

      completedCount++;
      const percent = Math.round((completedCount / totalChunks) * 100);
      setUploadProgress({
        fileName: objectKey || file.name,
        currentChunk: completedCount,
        totalChunks,
        percent,
        mode: `3x Paralel Parçalı (${Math.round(chunkSize / (1024*1024))}MB)`
      });
    }

    const queue = [...chunkIndices];
    async function runPoolWorker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) {
          await worker(item);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => runPoolWorker()));

    setUploadProgress({
      fileName: (objectKey || file.name) + " (Sunucuda Birleştiriliyor...)",
      currentChunk: totalChunks,
      totalChunks,
      percent: 99,
      mode: 'Diskte Birleştiriliyor'
    });

    const compRes = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        object_key: objectKey || file.name,
        file_name: file.name,
        content_type: file.type,
        user_id: currentUserId
      })
    });

    const compData = await compRes.json();
    if (!compData.success) {
      alert('Dosya birleştirme hatası: ' + compData.error);
    }
  }

  // ZIP Stream Download for Selected Files
  async function handleDownloadZIP() {
    if (selectedKeys.length === 0) {
      alert('Lütfen ZIP olarak indirmek istediğiniz dosyaları seçin.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/download-zip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: selectedKeys })
      });

      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedBucket}-export-${Date.now()}.zip`;
      link.click();
    } catch (err) {
      alert('ZIP indirme hatası: ' + err.message);
    }
  }

  async function handleSoftDelete(objectKey) {
    if (!window.confirm(`"${objectKey}" nesnesi Geri Dönüşüm Kutusu'na taşınsın mı?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/${encodeURIComponent(objectKey)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchObjects();
        fetchTrash();
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    }
  }

  async function handleRestoreFromTrash(objectKey) {
    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_key: objectKey })
      });
      const data = await res.json();
      if (data.success) {
        fetchObjects();
        fetchTrash();
      }
    } catch (err) {
      alert('Geri yükleme hatası: ' + err.message);
    }
  }

  async function handlePermanentDelete(objectKey) {
    if (!window.confirm(`"${objectKey}" nesnesi KALICI OLARAK silinsin mi? Bu işlem geri alınamaz!`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/${encodeURIComponent(objectKey)}?permanent=true`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchTrash();
      }
    } catch (err) {
      alert('Silme hatası: ' + err.message);
    }
  }

  async function fetchVersions(objectKey) {
    try {
      const res = await fetch(`${API_BASE}/api/storage/${selectedBucket}/versions?object_key=${encodeURIComponent(objectKey)}`);
      const data = await res.json();
      if (data.success) {
        setVersionsList(data.versions || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function toggleSelectKey(key) {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter(k => k !== key));
    } else {
      setSelectedKeys([...selectedKeys, key]);
    }
  }

  function toggleSelectAll() {
    if (selectedKeys.length === objects.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(objects.map(o => o.object_key));
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

  function renderSortIcon(field) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 inline ml-1" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 inline ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 text-blue-400 inline ml-1" />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Structured Pathing & Controls Bar */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Bucket Dropdown */}
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bucket:</span>
            <select
              value={selectedBucket || ''}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="bg-slate-950 border border-blue-500/30 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-blue-500 shadow-inner"
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.name}>🪣 {b.name} ({b.object_count || 0} nesne)</option>
              ))}
            </select>
          </div>

          {/* User ID & Structured Path Config */}
          <div className="flex items-center space-x-4 bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 text-xs">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400 font-medium">User ID:</span>
              <input 
                type="text"
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs w-24 focus:outline-none focus:border-blue-500"
              />
            </div>

            <label className="flex items-center space-x-2 cursor-pointer border-l border-slate-800 pl-4">
              <input 
                type="checkbox"
                checked={useStructuredPath}
                onChange={(e) => setUseStructuredPath(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-slate-200 font-semibold">Otomatik Pathing ({`user/date/guid/file`})</span>
            </label>
          </div>

          {/* Search */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input 
              type="text"
              placeholder="Nesne adı veya ETag ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

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
          Dosyaları buraya sürükleyip bırakın (3x Paralel Parçalı Yükleme)
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Hedef Yol: <span className="text-cyan-300 font-mono font-bold">
            {useStructuredPath ? `${currentUserId}/${new Date().toISOString().split('T')[0]}/[GUID]/[DOSYA]` : 'Direkt İsim'}
          </span>
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

      {/* Main Table Container: Active Files vs Trash Bin Tabs */}
      <div className="glass-panel overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                viewMode === 'active' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Aktif Dosyalar ({objects.length})</span>
            </button>

            <button
              onClick={() => setViewMode('trash')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                viewMode === 'trash' 
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Geri Dönüşüm Kutusu ({trashObjects.length})</span>
            </button>
          </div>

          {/* Action Bar for Active Files */}
          {viewMode === 'active' && selectedKeys.length > 0 && (
            <button 
              onClick={handleDownloadZIP}
              className="btn-accent py-2 px-4 text-xs font-bold animate-fadeIn"
            >
              <Archive className="w-4 h-4" />
              <span>Seçilenleri ZIP İndir ({selectedKeys.length})</span>
            </button>
          )}
        </div>

        {/* ACTIVE FILES TABLE */}
        {viewMode === 'active' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {selectedKeys.length === objects.length && objects.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th onClick={() => handleSort('object_key')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Dosya Yolu & Object Key {renderSortIcon('object_key')}
                  </th>
                  <th onClick={() => handleSort('size_bytes')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Boyut {renderSortIcon('size_bytes')}
                  </th>
                  <th onClick={() => handleSort('etag')} className="px-4 py-3.5 font-mono cursor-pointer hover:text-white transition select-none">
                    ETag / Sürüm {renderSortIcon('etag')}
                  </th>
                  <th onClick={() => handleSort('user_id')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Kullanıcı {renderSortIcon('user_id')}
                  </th>
                  <th onClick={() => handleSort('created_at')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Tarih {renderSortIcon('created_at')}
                  </th>
                  <th className="px-4 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : paginatedObjects.length > 0 ? (
                  paginatedObjects.map((obj) => {
                    const directUrl = `${API_BASE || window.location.origin}/api/storage/${obj.bucket_name}/${encodeURIComponent(obj.object_key)}`;
                    const isSelected = selectedKeys.includes(obj.object_key);

                    return (
                      <tr key={obj.id} className={`hover:bg-slate-900/60 transition ${isSelected ? 'bg-blue-950/20' : ''}`}>
                        <td className="px-4 py-4">
                          <button onClick={() => toggleSelectKey(obj.object_key)} className="text-slate-400 hover:text-white">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-slate-900 border border-white/5">
                              {getFileIcon(obj.content_type)}
                            </div>
                            <div>
                              <span 
                                onClick={() => setPreviewObj({ ...obj, directUrl })}
                                className="font-bold text-white hover:text-blue-400 cursor-pointer block text-sm font-mono truncate max-w-xs sm:max-w-md"
                              >
                                {obj.object_key}
                              </span>
                              <span className="text-[11px] text-slate-400 font-sans">{obj.file_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-200 font-semibold">{formatBytes(obj.size_bytes)}</td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-400">
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-white/5">{obj.etag}</span>
                          <span className="ml-2 text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded">{obj.version_id || 'v1'}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-400 font-mono text-xs">
                          <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">{obj.user_id || 'user_default'}</span>
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(obj.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Versions */}
                          <button 
                            onClick={() => { setVersionsModalObj(obj); fetchVersions(obj.object_key); }}
                            className="btn-subtle p-2 text-xs text-amber-400 hover:text-amber-300"
                            title="Sürüm Geçmişi"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Preview */}
                          <button 
                            onClick={() => setPreviewObj({ ...obj, directUrl })}
                            className="btn-subtle p-2 text-xs" 
                            title="Önizle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Presigned */}
                          <button 
                            onClick={() => onGeneratePresigned(obj.bucket_name, obj.object_key)}
                            className="btn-subtle p-2 text-xs text-cyan-400"
                            title="İmzalı URL"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>

                          {/* Copy URL */}
                          <button 
                            onClick={() => copyToClipboard(directUrl, obj.id)}
                            className="btn-subtle p-2 text-xs"
                            title="URL Kopyala"
                          >
                            {copiedKey === obj.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>

                          {/* Soft Delete */}
                          <button 
                            onClick={() => handleSoftDelete(obj.object_key)}
                            className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                            title="Çöp Kutusu'na Taşı"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-16 text-slate-500">Kayıtlı dosya yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TRASH BIN TABLE */}
        {viewMode === 'trash' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
                <tr>
                  <th onClick={() => handleSort('object_key')} className="px-5 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Silinen Dosya Yolu {renderSortIcon('object_key')}
                  </th>
                  <th onClick={() => handleSort('size_bytes')} className="px-5 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Boyut {renderSortIcon('size_bytes')}
                  </th>
                  <th onClick={() => handleSort('user_id')} className="px-5 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Kullanıcı {renderSortIcon('user_id')}
                  </th>
                  <th className="px-5 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedObjects.length > 0 ? (
                  paginatedObjects.map((obj) => (
                    <tr key={obj.id} className="hover:bg-slate-900/60">
                      <td className="px-5 py-4 font-mono text-slate-300 font-semibold">{obj.object_key}</td>
                      <td className="px-5 py-4 font-mono text-slate-400">{formatBytes(obj.size_bytes)}</td>
                      <td className="px-5 py-4 font-mono text-slate-400">{obj.user_id}</td>
                      <td className="px-5 py-4 text-right space-x-2">
                        <button 
                          onClick={() => handleRestoreFromTrash(obj.object_key)}
                          className="btn-accent py-1.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-500"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Geri Yükle (Restore)</span>
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(obj.object_key)}
                          className="btn-danger py-1.5 px-3 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Kalıcı Sil</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-16 text-slate-500">Geri Dönüşüm Kutusu boş.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION FOOTER BAR */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span>Sayfa Başına Göster:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>Toplam <strong className="text-white font-mono">{sortedObjects.length}</strong> kayıttan <strong className="text-white font-mono">{Math.min(sortedObjects.length, (currentPage - 1) * pageSize + 1)}-{Math.min(sortedObjects.length, currentPage * pageSize)}</strong> gösteriliyor</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-bold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Önceki</span>
            </button>

            <span className="px-3 py-1.5 font-mono text-xs font-bold text-slate-300 bg-slate-900 border border-white/5 rounded-lg">
              Sayfa {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-bold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <span>Sonraki</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* File Preview Modal */}
      {previewObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-2xl border border-slate-700 bg-slate-950 shadow-2xl relative">
            <button onClick={() => setPreviewObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3.5 mb-5">
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10">{getFileIcon(previewObj.content_type)}</div>
              <div>
                <h3 className="font-extrabold text-white text-lg font-mono">{previewObj.object_key}</h3>
                <p className="text-xs text-slate-400">{formatBytes(previewObj.size_bytes)} • {previewObj.content_type}</p>
              </div>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 border border-white/10 my-4 max-h-[400px] overflow-auto flex items-center justify-center">
              {previewObj.content_type.startsWith('image/') ? (
                <img src={previewObj.directUrl} alt={previewObj.object_key} className="max-h-80 object-contain rounded-lg" />
              ) : previewObj.content_type.startsWith('video/') ? (
                <video controls src={previewObj.directUrl} className="w-full max-h-80 rounded-lg" />
              ) : (
                <p className="text-slate-400 text-sm py-10">Canlı önizleme mevcut değil.</p>
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-slate-400 font-mono">ETag: {previewObj.etag}</div>
              <a href={`${previewObj.directUrl}?download=true`} download className="btn-accent">
                <Download className="w-4 h-4" />
                <span>İndir</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Versions History Modal */}
      {versionsModalObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-xl border border-slate-700 bg-slate-950 shadow-2xl relative">
            <button onClick={() => setVersionsModalObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-white text-lg mb-1 flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              <span>Sürüm Geçmişi</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">{versionsModalObj.object_key}</p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {versionsList.length > 0 ? (
                versionsList.map((ver) => (
                  <div key={ver.id} className="p-3 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-cyan-400 font-mono">{ver.version_id}</span>
                      <span className="text-slate-400 ml-2">{formatBytes(ver.size_bytes)}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{new Date(ver.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded">{ver.etag}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-xs py-6 text-center">Bu nesne için henüz eski sürüm bulunmuyor.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
