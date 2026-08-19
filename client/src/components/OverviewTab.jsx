import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Database, 
  Files, 
  Activity, 
  PieChart as PieChartIcon, 
  PlusCircle, 
  Upload, 
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  File,
  Zap,
  Radio,
  User,
  Layers,
  Sparkles,
  Gauge,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Network
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function OverviewTab({ stats, onNavigate }) {
  const [transferSearch, setTransferSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sorting & Pagination State for Daily Transfers
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Live Bandwidth & Historical Analytics State
  const [analyticsData, setAnalyticsData] = useState({
    liveTimeline: [],
    last7Days: [],
    bucketDistribution: [],
    peakIngressMB: 0,
    peakEgressMB: 0
  });

  const [dailyData, setDailyData] = useState({
    metrics: {
      targetDate: new Date().toISOString().split('T')[0],
      todayCompletedCount: 0,
      todayCompletedBytes: 0,
      todayOngoingCount: 0,
      todayOngoingBytes: 0,
      todayFailedCount: 0,
      todayTotalTransferredBytes: 0
    },
    sessions: []
  });

  // Auto-poll daily transfers and bandwidth metrics every 1 second
  useEffect(() => {
    fetchDailyTransfers();
    fetchBandwidthHistory();
    const interval = setInterval(() => {
      fetchDailyTransfers();
      fetchBandwidthHistory();
    }, 1000);
    return () => clearInterval(interval);
  }, [transferSearch, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [transferSearch, statusFilter, pageSize, sortField, sortDir]);

  async function fetchBandwidthHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/stats/bandwidth-history`);
      const data = await res.json();
      if (data.success) {
        setAnalyticsData({
          liveTimeline: data.liveTimeline || [],
          last7Days: data.last7Days || [],
          bucketDistribution: data.bucketDistribution || [],
          peakIngressMB: data.peakIngressMB || 0,
          peakEgressMB: data.peakEgressMB || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch bandwidth history:', err);
    }
  }

  async function fetchDailyTransfers() {
    try {
      const q = new URLSearchParams({
        search: transferSearch,
        status: statusFilter
      }).toString();

      const res = await fetch(`${API_BASE}/api/stats/daily-transfers?${q}`);
      const data = await res.json();
      if (data.success) {
        setDailyData({
          metrics: data.metrics,
          sessions: data.sessions || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch daily transfers:', err);
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

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  function renderSortIcon(field) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 inline ml-1" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />
      : <ArrowDown className="w-3.5 h-3.5 text-indigo-400 inline ml-1" />;
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        <p className="text-sm text-slate-400 font-medium">S3 Depolama İstatistikleri Yükleniyor...</p>
      </div>
    );
  }

  const { metrics, sessions } = dailyData;

  const sortedSessions = [...sessions].sort((a, b) => {
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

  const totalPages = Math.ceil(sortedSessions.length / pageSize) || 1;
  const paginatedSessions = sortedSessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const quotaPercent = stats.totalQuotaBytes > 0 
    ? Math.min(100, Math.round((stats.totalBytesUsed / stats.totalQuotaBytes) * 100))
    : 0;

  // Current real-time rates
  const currentTimelinePoint = analyticsData.liveTimeline[analyticsData.liveTimeline.length - 1] || { ingressMB: 0, egressMB: 0 };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Hero Welcome Banner */}
      <div className="glass-panel p-8 relative overflow-hidden border border-indigo-500/20 bg-gradient-to-r from-[#0d101b] via-[#111626] to-[#15122b]">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-3.5 py-1 text-xs text-indigo-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Yüksek Hızlı Blob Motoru</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Özel S3 Storage Kontrol Paneli
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Canlı Ağ Bant Genişliği Grafikleri, Günlük Transfer Takibi ve Sayfalamalı/Sıralamalı Arama Konsolu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => onNavigate('objects')} className="btn-accent">
              <Upload className="w-4 h-4" />
              <span>Dosya Yükle</span>
            </button>
            <button onClick={() => onNavigate('buckets')} className="btn-subtle">
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>Yeni Bucket</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📈 REAL-TIME NETWORK BANDWIDTH & 7-DAY STORAGE FLOW CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart 1: Real-Time Live Bandwidth (Ingress / Egress) */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-4 border border-indigo-500/20 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#141226]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-white tracking-tight flex items-center gap-2">
                  <span>Canlı Ağ Bant Genişliği (Real-Time Throughput)</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Son 60 saniyelik anlık Ingress (Giriş) ve Egress (Çıkış) MB/s hızı</p>
              </div>
            </div>

            {/* Live Ingress & Egress Speed Badges */}
            <div className="flex items-center space-x-3">
              <div className="bg-[#070912] border border-indigo-500/30 rounded-xl px-3 py-1.5 text-xs flex items-center space-x-2">
                <ArrowDownCircle className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-slate-400">Giriş: <strong className="text-indigo-300 font-mono">{currentTimelinePoint.ingressMB} MB/s</strong></span>
              </div>

              <div className="bg-[#070912] border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs flex items-center space-x-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-slate-400">Çıkış: <strong className="text-emerald-300 font-mono">{currentTimelinePoint.egressMB} MB/s</strong></span>
              </div>
            </div>
          </div>

          {/* Area Chart Component */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.liveTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ingressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="egressGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                  interval={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  unit=" MB/s"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#090d18', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="ingressMB" 
                  name="Giriş (Upload)" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#ingressGradient)" 
                  isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="egressMB" 
                  name="Çıkış (Download)" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#egressGradient)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 7-Day Storage Growth & Daily Data Flow */}
        <div className="glass-panel p-6 space-y-4 border border-purple-500/20 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#17112c]">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-lg text-white tracking-tight">Son 7 Günlük Veri Akışı</h2>
                <p className="text-xs text-slate-400">Günlük yükleme hacimleri (MB/GB)</p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.last7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit=" MB" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#090d18', 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Bar 
                  dataKey="uploadMB" 
                  name="Yüklenen Veri (MB)" 
                  fill="#a855f7" 
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 📊 DAILY TRANSFERS ANALYTICS & SEARCH CONSOLE */}
      <div className="glass-panel p-8 space-y-6 border border-indigo-500/25 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#141226]">
        
        {/* Header & Date Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-xl text-white tracking-tight">
                Günlük Transfer İstatistikleri & Canlı Arama Konsolu
              </h2>
              <p className="text-xs text-slate-400">Tarih: <strong className="text-indigo-300 font-mono">{metrics.targetDate}</strong></p>
            </div>
          </div>

          {/* Daily Total Transferred Metric Pill */}
          <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-[#0e121e] border border-indigo-500/30 rounded-2xl px-5 py-2.5 text-xs text-white flex items-center space-x-3 shadow-lg">
            <Gauge className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Bugün Toplam Transfer Edilen</span>
              <span className="text-lg font-extrabold font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300">
                {formatBytes(metrics.todayTotalTransferredBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Daily Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-4.5 rounded-2xl bg-[#090c14]/70 border border-emerald-500/25 flex items-center justify-between shadow-sm hover:border-emerald-500/40 transition">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Bugün Tamamlanan</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">{metrics.todayCompletedCount} Dosya</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{formatBytes(metrics.todayCompletedBytes)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-[#090c14]/70 border border-indigo-500/25 flex items-center justify-between shadow-sm hover:border-indigo-500/40 transition">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Devam Edenler</span>
              <span className="text-2xl font-extrabold text-indigo-400 font-mono">{metrics.todayOngoingCount} Transfer</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{formatBytes(metrics.todayOngoingBytes)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-[#090c14]/70 border border-rose-500/25 flex items-center justify-between shadow-sm hover:border-rose-500/40 transition">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Hata Alanlar</span>
              <span className="text-2xl font-extrabold text-rose-400 font-mono">{metrics.todayFailedCount} Hata</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Kesintiye uğrayanlar</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="p-4.5 rounded-2xl bg-[#090c14]/70 border border-purple-500/25 flex items-center justify-between shadow-sm hover:border-purple-500/40 transition">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Tekil Kullanıcılar</span>
              <span className="text-2xl font-extrabold text-purple-400 font-mono">
                {[...new Set(sessions.map(s => s.userId))].length} Kullanıcı
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Aktif gönderim yapanlar</span>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <User className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Filter & Live Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input 
              type="text"
              placeholder="Kullanıcı Adı (user_101) veya Dosya Adı ara..."
              value={transferSearch}
              onChange={(e) => setTransferSearch(e.target.value)}
              className="w-full bg-[#080b13] border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition shadow-inner"
            />
            {transferSearch && (
              <button onClick={() => setTransferSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1.5 bg-[#080b13] p-1.5 rounded-xl border border-slate-800/80 overflow-x-auto">
            {[
              { id: 'ALL', label: 'Tümü' },
              { id: 'COMPLETED', label: 'Tamamlananlar' },
              { id: 'IN_PROGRESS', label: 'Devam Edenler' },
              { id: 'FAILED', label: 'Hata Alanlar' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === tab.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Transfer Sessions Data Table with Sorting */}
        <div className="glass-panel overflow-hidden border border-white/[0.06] bg-[#070910]/70">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
                <tr>
                  <th onClick={() => handleSort('userId')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Kullanıcı (User ID) {renderSortIcon('userId')}
                  </th>
                  <th onClick={() => handleSort('fileName')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Dosya Adı & Object Key {renderSortIcon('fileName')}
                  </th>
                  <th onClick={() => handleSort('completedChunks')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    İlerleme / Parçalar {renderSortIcon('completedChunks')}
                  </th>
                  <th onClick={() => handleSort('fileSize')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Transfer / Boyut {renderSortIcon('fileSize')}
                  </th>
                  <th onClick={() => handleSort('status')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Durum {renderSortIcon('status')}
                  </th>
                  <th onClick={() => handleSort('startedAt')} className="px-4 py-3.5 cursor-pointer hover:text-white transition select-none">
                    Başlama Tarih / Saat {renderSortIcon('startedAt')}
                  </th>
                  <th onClick={() => handleSort('endedAt')} className="px-4 py-3.5 text-right cursor-pointer hover:text-white transition select-none">
                    Bitiş Tarih / Saat {renderSortIcon('endedAt')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginatedSessions.length > 0 ? (
                  paginatedSessions.map((s) => {
                    const isDone = s.status === 'COMPLETED';
                    const isFailed = s.status === 'FAILED';

                    const currentCompletedChunks = isDone ? (s.totalChunks || 1) : s.completedChunks;
                    const currentUploadedBytes = isDone ? s.fileSize : s.uploadedBytes;

                    const percent = isDone 
                      ? 100 
                      : s.totalChunks > 0 
                      ? Math.min(100, Math.round((currentCompletedChunks / s.totalChunks) * 100))
                      : 0;

                    const startFormatted = s.startedAt 
                      ? new Date(s.startedAt).toLocaleString('tr-TR')
                      : '—';

                    const endFormatted = s.endedAt 
                      ? new Date(s.endedAt).toLocaleString('tr-TR')
                      : isDone 
                      ? (s.updatedAt ? new Date(s.updatedAt).toLocaleString('tr-TR') : '—')
                      : isFailed 
                      ? 'Kesildi ❌' 
                      : 'Devam Ediyor ⏳';

                    return (
                      <tr key={s.uploadId} className="hover:bg-white/[0.02] transition duration-150">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-mono text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{s.userId || 'user_default'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 max-w-xs truncate">
                          <span className="font-bold text-white block truncate text-sm">{s.fileName}</span>
                          <span className="text-[11px] text-slate-400 font-mono block truncate">{s.objectKey}</span>
                        </td>
                        <td className="px-4 py-4 font-mono">
                          <div className="space-y-1 min-w-[110px]">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Parça {currentCompletedChunks}/{s.totalChunks || 1}</span>
                              <span className="font-bold text-indigo-400">%{percent}</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#05070d] rounded-full overflow-hidden border border-white/5">
                              <div className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono whitespace-nowrap font-semibold">
                          <span className="text-slate-200">{formatBytes(currentUploadedBytes)}</span>
                          <span className="text-slate-400 text-[11px]"> / {formatBytes(s.fileSize)}</span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isDone 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : isFailed
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 animate-pulse'
                          }`}>
                            {isDone ? 'TAMAMLANDI' : isFailed ? 'HATALI' : 'DEVAM EDİYOR'}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          <span className="bg-[#090d18] border border-white/5 px-2 py-1 rounded">
                            {startFormatted}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded border ${
                            isDone 
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' 
                              : isFailed
                              ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                              : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 animate-pulse'
                          }`}>
                            {endFormatted}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-500">
                      Filtreleme kriterinize uygun transfer kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER BAR FOR DAILY TRANSFERS */}
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
              <span>Toplam <strong className="text-white font-mono">{sortedSessions.length}</strong> kayıttan <strong className="text-white font-mono">{sortedSessions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(sortedSessions.length, currentPage * pageSize)}</strong> gösteriliyor</span>
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

      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kullanılan Depolama</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition duration-200">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{formatBytes(stats.totalBytesUsed)}</span>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>Kapasite Oranı</span>
                <span className="font-mono text-indigo-400 font-bold">%{quotaPercent}</span>
              </div>
              <div className="w-full h-2 bg-[#05070d] rounded-full overflow-hidden p-0.5 border border-white/5">
                <div className="h-full progress-glow rounded-full transition-all duration-500" style={{ width: `${quotaPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Nesneler</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition duration-200">
              <Files className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{stats.totalObjects}</span>
            <p className="text-xs text-slate-400 mt-2 font-medium">İndekslenmiş aktif dosya sayısı</p>
          </div>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktif Bucket'lar</span>
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition duration-200">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{stats.totalBuckets}</span>
            <p className="text-xs text-slate-400 mt-2 font-medium">Mantıksal depolama alanları</p>
          </div>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tahsis Edilen Kota</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition duration-200">
              <PieChartIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{formatBytes(stats.totalQuotaBytes)}</span>
            <p className="text-xs text-slate-400 mt-2 font-medium">Toplam atanmış disk limiti</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Activity Stream & File Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-lg text-white">Canlı İşlem Logları (Audit Stream)</h2>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-[#090b14] border border-white/10 px-2.5 py-1 rounded-full">
              Son 20 Kayıt
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#070910]/70 border border-white/[0.04] hover:border-indigo-500/30 transition duration-150 group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                      {log.action}
                    </span>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-slate-200 truncate">
                        {log.bucket_name ? <span className="text-indigo-400">{log.bucket_name}</span> : 'Sistem'}
                        {log.object_key && <span className="text-slate-400 font-mono font-normal"> / {log.object_key}</span>}
                      </div>
                      {log.details && <p className="text-xs text-slate-400 truncate mt-0.5">{log.details}</p>}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0 ml-3">
                    {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <Activity className="w-8 h-8 mx-auto text-slate-700" />
                <p className="text-sm font-medium">Henüz bir işlem gerçekleştirilmedi.</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center space-x-2.5 pb-4 border-b border-white/[0.08]">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <PieChartIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-lg text-white">Dosya Dağılımı</h2>
          </div>

          <div className="space-y-4">
            {Object.keys(stats.mimeCategories || {}).length > 0 ? (
              Object.entries(stats.mimeCategories).map(([category, bytes]) => {
                const percent = stats.totalBytesUsed > 0 
                  ? Math.round((bytes / stats.totalBytesUsed) * 100) 
                  : 0;

                let icon = File;
                let badgeStyle = "text-slate-300 bg-slate-800/80 border-slate-700";
                if (category === 'image') { icon = FileImage; badgeStyle = "text-pink-300 bg-pink-500/10 border-pink-500/20"; }
                else if (category === 'video') { icon = FileVideo; badgeStyle = "text-purple-300 bg-purple-500/10 border-purple-500/20"; }
                else if (category === 'audio') { icon = FileAudio; badgeStyle = "text-amber-300 bg-amber-500/10 border-amber-500/20"; }
                else if (category === 'application' || category === 'text') { icon = FileText; badgeStyle = "text-indigo-300 bg-indigo-500/10 border-indigo-500/20"; }

                const IconComponent = icon;

                return (
                  <div key={category} className="space-y-2 p-3.5 rounded-xl bg-[#070910]/60 border border-white/[0.04]">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-1.5 rounded-lg border ${badgeStyle}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="font-bold capitalize text-slate-200">{category}</span>
                      </div>
                      <span className="font-mono text-slate-300 font-semibold">{formatBytes(bytes)} (%{percent})</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#05070d] rounded-full overflow-hidden border border-white/5">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <PieChartIcon className="w-8 h-8 mx-auto text-slate-700" />
                <p className="text-sm font-medium">Kayıtlı dosya türü yok.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
