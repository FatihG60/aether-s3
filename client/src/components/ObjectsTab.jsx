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
  FolderPlus,
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
  ChevronRight,
  FolderTree,
  List,
  MoveRight,
  FileArchive,
  ExternalLink,
  ChevronRight as ChevronBreadcrumb
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function ObjectsTab({ buckets, selectedBucket, setSelectedBucket, onGeneratePresigned }) {
  const [objects, setObjects] = useState([]);
  const [commonPrefixes, setCommonPrefixes] = useState([]);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [folderView, setFolderView] = useState(true);
  
  const [trashObjects, setTrashObjects] = useState([]);
  const [viewMode, setViewMode] = useState('active');
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [previewObj, setPreviewObj] = useState(null);
  const [versionsModalObj, setVersionsModalObj] = useState(null);
  const [versionsList, setVersionsList] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  // ZIP Inspection Modal State
  const [inspectZipObj, setInspectZipObj] = useState(null);
  const [zipEntries, setZipEntries] = useState([]);
  const [zipLoading, setZipLoading] = useState(false);

  // Move / Rename Modal State
  const [moveObj, setMoveObj] = useState(null);
  const [targetKeyInput, setTargetKeyInput] = useState('');
  const [targetBucketInput, setTargetBucketInput] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);

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
  }, [selectedBucket, search, viewMode, currentPrefix, folderView]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewMode, pageSize, sortField, sortDir, currentPrefix, folderView]);

  async function fetchObjects() {
    if (!selectedBucket) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (folderView && !search) {
        params.append('delimiter', '/');
        if (currentPrefix) params.append('prefix', currentPrefix);
      } else if (currentPrefix && !search) {
        params.append('prefix', currentPrefix);
      }

      const res = await fetch(`${API_BASE}/api/buckets/${selectedBucket}/objects?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setObjects(data.objects || []);
        setCommonPrefixes(data.commonPrefixes || []);
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

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

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
        if (!useStructuredPath) {
          const finalKey = currentPrefix ? `${currentPrefix}${file.name}` : file.name;
          formData.append('key', finalKey);
        }

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

  // Parallel Chunk Uploader
  async function uploadLargeFileParallelChunks(file, chunkSize) {
    const totalChunks = Math.ceil(file.size / chunkSize);
    const initialKey = currentPrefix ? `${currentPrefix}${file.name}` : file.name;

    const initRes = await fetch(`${API_BASE}/api/storage/${selectedBucket}/multipart/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object_key: initialKey,
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
        mode: `3x Paralel (${Math.round(chunkSize / (1024*1024))}MB)`
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

  async function handleInspectZip(obj) {
    setInspectZipObj(obj);
    setZipLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/storage/${obj.bucket_name}/zip-inspect?key=${encodeURIComponent(obj.object_key)}`);
      const data = await res.json();
      if (data.success) {
        setZipEntries(data.entries || []);
      } else {
        alert('Arşiv incelenemedi: ' + data.error);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setZipLoading(false);
    }
  }

  function handleOpenMoveModal(obj) {
    setMoveObj(obj);
    setTargetKeyInput(obj.object_key);
    setTargetBucketInput(obj.bucket_name);
  }

  async function handleExecuteMove() {
    if (!moveObj || !targetKeyInput.trim()) return;
    setMoveLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/storage/${moveObj.bucket_name}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_key: moveObj.object_key,
          target_key: targetKeyInput.trim(),
          new_bucket: targetBucketInput || moveObj.bucket_name
        })
      });
      const data = await res.json();
      if (data.success) {
        setMoveObj(null);
        fetchObjects();
      } else {
        alert('Taşıma hatası: ' + data.error);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setMoveLoading(false);
    }
  }

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

  function getFileIcon(contentType, objectKey, bucketName) {
    const isImage = contentType && contentType.startsWith('image/');
    if (isImage && !contentType.includes('svg')) {
      const thumbUrl = `${API_BASE}/api/storage/${bucketName}/thumbnail/${encodeURIComponent(objectKey)}`;
      return (
        <img 
          src={thumbUrl} 
          alt="" 
          className="w-7 h-7 object-cover rounded-lg border border-white/10 shadow-sm"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }
    const type = (contentType || '').split('/')[0];
    if (objectKey.endsWith('.zip') || objectKey.endsWith('.tar.gz') || objectKey.endsWith('.rar')) {
      return <FileArchive className="w-5 h-5 text-amber-400" />;
    }
    if (type === 'image') return <FileImage className="w-5 h-5 text-pink-400" />;
    if (type === 'video') return <FileVideo className="w-5 h-5 text-purple-400" />;
    if (type === 'audio') return <FileAudio className="w-5 h-5 text-amber-400" />;
    if (type === 'text' || type === 'application') return <FileText className="w-5 h-5 text-indigo-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
  }

  function renderSortIcon(field) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 inline ml-1" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />;
  }

  const breadcrumbSegments = currentPrefix ? currentPrefix.split('/').filter(Boolean) : [];

  function navigateToBreadcrumb(index) {
    if (index === -1) {
      setCurrentPrefix('');
    } else {
      const nextPrefix = breadcrumbSegments.slice(0, index + 1).join('/') + '/';
      setCurrentPrefix(nextPrefix);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Structured Pathing & Controls Bar */}
      <div className="glass-panel p-6 space-y-4 border border-indigo-500/20 bg-gradient-to-r from-[#0c0f18] via-[#101422] to-[#141226]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Bucket Dropdown */}
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bucket:</span>
            <select
              value={selectedBucket || ''}
              onChange={(e) => { setSelectedBucket(e.target.value); setCurrentPrefix(''); }}
              className="bg-[#080b13] border border-indigo-500/30 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-indigo-500 shadow-inner"
            >
              {buckets.map((b) => (
                <option key={b.id} value={b.name}>🪣 {b.name} ({b.object_count || 0} nesne)</option>
              ))}
            </select>
          </div>

          {/* User ID & Structured Path Config */}
          <div className="flex items-center space-x-4 bg-[#080b13]/80 border border-white/10 rounded-xl px-4 py-2 text-xs">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-400 font-medium">User ID:</span>
              <input 
                type="text"
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="bg-[#0c101c] border border-slate-700/80 rounded px-2.5 py-1 font-mono text-white text-xs w-24 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <label className="flex items-center space-x-2 cursor-pointer border-l border-slate-800 pl-4">
              <input 
                type="checkbox"
                checked={useStructuredPath}
                onChange={(e) => setUseStructuredPath(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-slate-200 font-semibold">Otomatik Pathing ({`user/date/guid/file`})</span>
            </label>
          </div>

          {/* View Mode Toggle & Search */}
          <div className="flex items-center space-x-3">
            <div className="flex bg-[#080b13] border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setFolderView(true)}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  folderView ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="Klasör Ağacı Görünümü"
              >
                <FolderTree className="w-4 h-4" />
                <span className="hidden sm:inline">Klasörler</span>
              </button>
              <button
                onClick={() => setFolderView(false)}
                className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  !folderView ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
                title="Düz Liste Görünümü"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Düz Liste</span>
              </button>
            </div>

            <div className="relative w-full lg:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input 
                type="text"
                placeholder="Dosya veya ETag ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#080b13] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
              />
            </div>
          </div>

        </div>

        {/* 📂 BREADCRUMB FOLDER NAVIGATION BAR */}
        {folderView && !search && (
          <div className="flex items-center space-x-2 pt-2 border-t border-white/[0.06] text-xs text-slate-400 overflow-x-auto pb-1">
            <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px] shrink-0">Dizin:</span>
            
            <button
              onClick={() => navigateToBreadcrumb(-1)}
              className={`hover:text-indigo-300 font-bold px-2.5 py-1 rounded-lg bg-[#080b13] border transition shrink-0 ${
                !currentPrefix ? 'text-indigo-400 border-indigo-500/40' : 'text-slate-300 border-slate-800'
              }`}
            >
              🪣 {selectedBucket}
            </button>

            {breadcrumbSegments.map((segment, index) => {
              const isLast = index === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={index}>
                  <ChevronBreadcrumb className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className={`hover:text-indigo-300 font-mono px-2.5 py-1 rounded-lg bg-[#080b13] border transition shrink-0 ${
                      isLast ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 font-bold border-indigo-500/40 shadow-sm' : 'text-slate-300 border-slate-800'
                    }`}
                  >
                    📁 {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}
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
        className={`glass-panel p-10 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-200 text-center group relative overflow-hidden ${
          dragActive 
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
            : 'border-indigo-500/30 hover:border-indigo-500/60 bg-[#0c0f18]/60 hover:bg-[#101424]/80'
        }`}
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef} 
          onChange={(e) => handleFileUpload(e.target.files)} 
          className="hidden" 
        />
        
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition duration-200 shadow-lg shadow-indigo-500/10">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="mt-4 font-bold text-white text-lg tracking-tight">
          Dosyaları buraya sürükleyip bırakın (3x Paralel Parçalı Yükleme)
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium">
          Hedef Yol: <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 font-mono font-bold">
            {useStructuredPath 
              ? `${currentUserId}/${new Date().toISOString().split('T')[0]}/[GUID]/[DOSYA]` 
              : currentPrefix ? `${currentPrefix}[DOSYA]` : 'Direkt İsim'}
          </span>
        </p>

        {uploadProgress && (
          <div className="mt-5 max-w-md mx-auto p-4.5 rounded-2xl bg-[#090d18] border border-indigo-500/40 text-xs text-indigo-200 space-y-2 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>{uploadProgress.mode}: Parça {uploadProgress.currentChunk} / {uploadProgress.totalChunks}</span>
              </span>
              <span className="font-mono font-bold text-indigo-300">%{uploadProgress.percent}</span>
            </div>
            <div className="w-full h-2 bg-[#05070d] rounded-full overflow-hidden p-0.5 border border-white/5">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-200" style={{ width: `${uploadProgress.percent}%` }}></div>
            </div>
            <span className="text-[11px] font-mono text-slate-400 block truncate">{uploadProgress.fileName}</span>
          </div>
        )}
      </div>

      {/* Main Table Container: Active Files vs Trash Bin Tabs */}
      <div className="glass-panel overflow-hidden border border-white/[0.06] bg-[#070910]/70">
        
        {/* Table Header Controls */}
        <div className="p-5 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                viewMode === 'active' 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'bg-[#0b0e18] text-slate-400 hover:text-white'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Aktif Dosyalar ({objects.length + commonPrefixes.length})</span>
            </button>

            <button
              onClick={() => setViewMode('trash')}
              className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
                viewMode === 'trash' 
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
                  : 'bg-[#0b0e18] text-slate-400 hover:text-white'
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
              className="btn-accent py-2 px-4 text-xs font-bold animate-fadeIn bg-gradient-to-r from-emerald-600 to-teal-600"
            >
              <Archive className="w-4 h-4" />
              <span>Seçilenleri ZIP İndir ({selectedKeys.length})</span>
            </button>
          )}
        </div>

        {/* ACTIVE FILES & FOLDERS TABLE */}
        {viewMode === 'active' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
                <tr>
                  <th className="px-4 py-3.5 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                      {selectedKeys.length === objects.length && objects.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
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
              <tbody className="divide-y divide-white/[0.04]">
                {/* Up-level button when inside subfolder */}
                {folderView && currentPrefix && (
                  <tr 
                    onClick={() => {
                      const parts = currentPrefix.split('/').filter(Boolean);
                      parts.pop();
                      setCurrentPrefix(parts.length > 0 ? parts.join('/') + '/' : '');
                    }}
                    className="hover:bg-white/[0.03] cursor-pointer bg-[#090c16]/50 text-indigo-400 font-bold"
                  >
                    <td className="px-4 py-3 text-center">📁</td>
                    <td colSpan="6" className="px-4 py-3 font-mono">.. (Üst Klasöre Çık)</td>
                  </tr>
                )}

                {/* Subfolder rows */}
                {folderView && commonPrefixes.map(folder => (
                  <tr 
                    key={folder.prefix}
                    onClick={() => setCurrentPrefix(folder.prefix)}
                    className="hover:bg-white/[0.03] cursor-pointer transition group bg-[#080a12]/40"
                  >
                    <td className="px-4 py-3.5 text-center text-amber-400">
                      <Folder className="w-5 h-5 mx-auto fill-amber-400/20 group-hover:scale-110 transition" />
                    </td>
                    <td className="px-4 py-3.5 font-bold text-white font-mono flex items-center gap-2">
                      <span className="text-amber-300">{folder.name}/</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-mono">Klasör</td>
                    <td className="px-4 py-3.5 text-slate-600">—</td>
                    <td className="px-4 py-3.5 text-slate-600">—</td>
                    <td className="px-4 py-3.5 text-slate-600">—</td>
                    <td className="px-4 py-3.5 text-right">
                      <button className="btn-subtle py-1 px-2.5 text-xs text-indigo-400">Klasörü Aç ➔</button>
                    </td>
                  </tr>
                ))}

                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500">Yükleniyor...</td>
                  </tr>
                ) : paginatedObjects.length > 0 ? (
                  paginatedObjects.map((obj) => {
                    const directUrl = `${API_BASE || window.location.origin}/api/storage/${obj.bucket_name}/${encodeURIComponent(obj.object_key)}`;
                    const isSelected = selectedKeys.includes(obj.object_key);
                    const isZip = obj.object_key.endsWith('.zip') || obj.object_key.endsWith('.tar.gz');

                    return (
                      <tr key={obj.id} className={`hover:bg-white/[0.02] transition ${isSelected ? 'bg-indigo-950/30' : ''}`}>
                        <td className="px-4 py-4">
                          <button onClick={() => toggleSelectKey(obj.object_key)} className="text-slate-400 hover:text-white">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-1 rounded-xl bg-[#090d18] border border-white/5 shrink-0 flex items-center justify-center">
                              {getFileIcon(obj.content_type, obj.object_key, obj.bucket_name)}
                            </div>
                            <div>
                              <span 
                                onClick={() => setPreviewObj({ ...obj, directUrl })}
                                className="font-bold text-white hover:text-indigo-400 cursor-pointer block text-sm font-mono truncate max-w-xs sm:max-w-md"
                              >
                                {folderView && currentPrefix ? obj.object_key.slice(currentPrefix.length) : obj.object_key}
                              </span>
                              <span className="text-[11px] text-slate-400 font-sans">{obj.file_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-slate-200 font-semibold">{formatBytes(obj.size_bytes)}</td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-400">
                          <span className="bg-[#05070d] px-2 py-0.5 rounded border border-white/5">{obj.etag}</span>
                          <span className="ml-2 text-indigo-400 font-bold bg-indigo-950/60 px-1.5 py-0.5 rounded">{obj.version_id || 'v1'}</span>
                        </td>
                        <td className="px-4 py-4 text-slate-400 font-mono text-xs">
                          <span className="bg-[#090d18] border border-slate-800 px-2 py-0.5 rounded">{obj.user_id || 'user_default'}</span>
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(obj.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                          {isZip && (
                            <button 
                              onClick={() => handleInspectZip(obj)}
                              className="btn-subtle p-2 text-xs text-amber-400 hover:text-amber-300"
                              title="Arşiv İçi İncele & Çıkar"
                            >
                              <FileArchive className="w-4 h-4" />
                            </button>
                          )}

                          <button 
                            onClick={() => handleOpenMoveModal(obj)}
                            className="btn-subtle p-2 text-xs text-indigo-400 hover:text-indigo-300"
                            title="Taşı / Yeniden Adlandır"
                          >
                            <MoveRight className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => { setVersionsModalObj(obj); fetchVersions(obj.object_key); }}
                            className="btn-subtle p-2 text-xs text-purple-400 hover:text-purple-300"
                            title="Sürüm Geçmişi"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => setPreviewObj({ ...obj, directUrl })}
                            className="btn-subtle p-2 text-xs" 
                            title="Önizle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => onGeneratePresigned(obj.bucket_name, obj.object_key)}
                            className="btn-subtle p-2 text-xs text-cyan-400"
                            title="İmzalı URL"
                          >
                            <Link2 className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => copyToClipboard(directUrl, obj.id)}
                            className="btn-subtle p-2 text-xs"
                            title="URL Kopyala"
                          >
                            {copiedKey === obj.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>

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
                ) : commonPrefixes.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-16 text-slate-500">Kayıtlı dosya veya klasör yok.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {/* TRASH BIN TABLE */}
        {viewMode === 'trash' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
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
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedObjects.length > 0 ? (
                  paginatedObjects.map((obj) => (
                    <tr key={obj.id} className="hover:bg-white/[0.02]">
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
        <div className="p-4 bg-[#05070c]/80 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-3">
            <span>Sayfa Başına Göster:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[#0b0e18] border border-slate-700/80 rounded-lg px-2.5 py-1 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>Toplam <strong className="text-white font-mono">{sortedObjects.length}</strong> dosyadan <strong className="text-white font-mono">{sortedObjects.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(sortedObjects.length, currentPage * pageSize)}</strong> gösteriliyor</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-[#0b0e18] border border-slate-700 font-bold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Önceki</span>
            </button>

            <span className="px-3 py-1.5 font-mono text-xs font-bold text-slate-300 bg-[#0b0e18] border border-white/5 rounded-lg">
              Sayfa {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-[#0b0e18] border border-slate-700 font-bold text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition"
            >
              <span>Sonraki</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* 🗂️ ZIP ARCHIVE INSPECTOR MODAL */}
      {inspectZipObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-3xl border border-amber-500/40 bg-[#080b13] shadow-2xl relative space-y-4">
            <button onClick={() => setInspectZipObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <FileArchive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg font-mono">Arşiv İçi Dosya Gezgini</h3>
                <p className="text-xs text-slate-400 font-mono">{inspectZipObj.object_key}</p>
              </div>
            </div>

            <div className="bg-[#05070d] rounded-2xl border border-white/[0.08] p-4 max-h-[380px] overflow-y-auto space-y-2">
              {zipLoading ? (
                <p className="text-center py-12 text-slate-400">Arşiv içeriği okunuyor...</p>
              ) : zipEntries.length > 0 ? (
                zipEntries.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#090d18] border border-white/[0.04] hover:border-amber-500/30 text-xs">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-amber-400">{entry.isDirectory ? '📁' : '📄'}</span>
                      <span className={`font-mono truncate ${entry.isDirectory ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
                        {entry.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      {!entry.isDirectory && (
                        <span className="font-mono text-slate-400 text-[11px]">{formatBytes(entry.size)}</span>
                      )}
                      {!entry.isDirectory && (
                        <a
                          href={`${API_BASE}/api/storage/${inspectZipObj.bucket_name}/zip-extract?key=${encodeURIComponent(inspectZipObj.object_key)}&entry=${encodeURIComponent(entry.name)}`}
                          download
                          className="btn-accent py-1 px-2.5 text-[11px] bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Çıkar & İndir</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-12 text-slate-500">Arşiv içi boş veya okunamadı.</p>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setInspectZipObj(null)} className="btn-subtle">Kapat</button>
            </div>
          </div>
        </div>
      )}

      {/* 🚚 MOVE / RENAME OBJECT MODAL */}
      {moveObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-lg border border-indigo-500/40 bg-[#080b13] shadow-2xl relative space-y-4">
            <button onClick={() => setMoveObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <MoveRight className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-lg">Sunucu Taraflı Taşı / Yeniden Adlandır</h3>
                <p className="text-xs text-slate-400">Ağ üzerinden tekrar yüklemeden sıfır gecikmeyle taşır.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Mevcut Yol (Source):</label>
                <div className="p-2.5 rounded-xl bg-[#05070d] border border-slate-800 font-mono text-slate-400 truncate">
                  {moveObj.bucket_name} / {moveObj.object_key}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Hedef Bucket:</label>
                <select
                  value={targetBucketInput}
                  onChange={(e) => setTargetBucketInput(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-indigo-500"
                >
                  {buckets.map(b => (
                    <option key={b.id} value={b.name}>🪣 {b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Yeni Dosya Yolu / Key (Target):</label>
                <input
                  type="text"
                  value={targetKeyInput}
                  onChange={(e) => setTargetKeyInput(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="örn: backup/2026/yeni-ad.pdf"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button onClick={() => setMoveObj(null)} className="btn-subtle">İptal</button>
              <button 
                onClick={handleExecuteMove}
                disabled={moveLoading}
                className="btn-accent"
              >
                {moveLoading ? 'Taşınıyor...' : 'Taşı / Yeniden Adlandır'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewObj && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-2xl border border-slate-700/80 bg-[#080b13] shadow-2xl relative">
            <button onClick={() => setPreviewObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3.5 mb-5">
              <div className="p-3 rounded-xl bg-[#05070d] border border-white/10">{getFileIcon(previewObj.content_type, previewObj.object_key, previewObj.bucket_name)}</div>
              <div>
                <h3 className="font-extrabold text-white text-lg font-mono">{previewObj.object_key}</h3>
                <p className="text-xs text-slate-400">{formatBytes(previewObj.size_bytes)} • {previewObj.content_type}</p>
              </div>
            </div>
            <div className="bg-[#05070d] rounded-2xl p-4 border border-white/10 my-4 max-h-[400px] overflow-auto flex items-center justify-center">
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
          <div className="glass-panel p-8 w-full max-w-xl border border-purple-500/40 bg-[#080b13] shadow-2xl relative">
            <button onClick={() => setVersionsModalObj(null)} className="absolute top-5 right-5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-white text-lg mb-1 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <span>Sürüm Geçmişi</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4 font-mono">{versionsModalObj.object_key}</p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {versionsList.length > 0 ? (
                versionsList.map((ver) => (
                  <div key={ver.id} className="p-3 rounded-xl bg-[#090d18] border border-white/[0.04] flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-purple-300 font-mono">{ver.version_id}</span>
                      <span className="text-slate-400 ml-2">{formatBytes(ver.size_bytes)}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">{new Date(ver.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 bg-[#05070d] px-2 py-1 rounded border border-white/5">{ver.etag}</span>
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
