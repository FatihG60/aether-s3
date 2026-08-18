import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Database, 
  Files, 
  Activity, 
  PieChart, 
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
  X
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function OverviewTab({ stats, onNavigate }) {
  const [transferSearch, setTransferSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  // Auto-poll daily transfers and live stats every 1 second
  useEffect(() => {
    fetchDailyTransfers();
    const interval = setInterval(fetchDailyTransfers, 1000);
    return () => clearInterval(interval);
  }, [transferSearch, statusFilter]);

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

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-sm text-slate-400 font-medium">S3 Depolama İstatistikleri Yükleniyor...</p>
      </div>
    );
  }

  const { metrics, sessions } = dailyData;
  const quotaPercent = stats.totalQuotaBytes > 0 
    ? Math.min(100, Math.round((stats.totalBytesUsed / stats.totalQuotaBytes) * 100))
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Hero Welcome Banner */}
      <div className="glass-panel p-8 relative overflow-hidden border border-blue-500/20 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950/40">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-xs text-blue-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Yüksek Hızlı Yerel Blob Engine</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Özel S3 Storage Kontrol Paneli
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              AWS S3 standartlarında nesne depolama, Günlük Kullanıcı Transfer Takibi ve Canlı Arama Konsolu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => onNavigate('objects')} className="btn-accent">
              <Upload className="w-4 h-4" />
              <span>Dosya Yükle</span>
            </button>
            <button onClick={() => onNavigate('buckets')} className="btn-subtle">
              <PlusCircle className="w-4 h-4 text-blue-400" />
              <span>Yeni Bucket</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 DAILY TRANSFERS ANALYTICS & SEARCH CONSOLE */}
      <div className="glass-panel p-8 space-y-6 border border-cyan-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/20">
        
        {/* Header & Date Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-xl text-white tracking-tight">
                Günlük Transfer İstatistikleri & Canlı Arama Konsolu
              </h2>
              <p className="text-xs text-slate-400">Tarih: <strong className="text-cyan-300 font-mono">{metrics.targetDate}</strong></p>
            </div>
          </div>

          {/* Daily Total Transferred Metric Pill */}
          <div className="bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border border-cyan-400/40 rounded-2xl px-5 py-2.5 text-xs text-white flex items-center space-x-3 shadow-xl">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Bugün Toplam Transfer Edilen Veri</span>
              <span className="text-lg font-extrabold font-mono text-cyan-300">{formatBytes(metrics.todayTotalTransferredBytes)}</span>
            </div>
          </div>
        </div>

        {/* 4 Daily Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Completed Today */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Bugün Tamamlanan</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">{metrics.todayCompletedCount} Dosya</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{formatBytes(metrics.todayCompletedBytes)}</span>
            </div>
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
          </div>

          {/* Card 2: Ongoing Transfers */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-blue-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Devam Edenler</span>
              <span className="text-2xl font-extrabold text-blue-400 font-mono">{metrics.todayOngoingCount} Transfer</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">{formatBytes(metrics.todayOngoingBytes)}</span>
            </div>
            <Clock className="w-8 h-8 text-blue-400/60 animate-pulse" />
          </div>

          {/* Card 3: Failed Transfers */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-rose-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Hata Alanlar</span>
              <span className="text-2xl font-extrabold text-rose-400 font-mono">{metrics.todayFailedCount} Hata</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Kesintiye uğrayanlar</span>
            </div>
            <AlertCircle className="w-8 h-8 text-rose-400/60" />
          </div>

          {/* Card 4: Total Active Users Today */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-purple-500/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block">Tekil Kullanıcılar</span>
              <span className="text-2xl font-extrabold text-purple-400 font-mono">
                {[...new Set(sessions.map(s => s.userId))].length} Kullanıcı
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Aktif gönderim yapanlar</span>
            </div>
            <User className="w-8 h-8 text-purple-400/60" />
          </div>

        </div>

        {/* Filter & Live Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
          
          {/* Live Search Input */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input 
              type="text"
              placeholder="Kullanıcı Adı (user_101) veya Dosya Adı ara..."
              value={transferSearch}
              onChange={(e) => setTransferSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono transition"
            />
            {transferSearch && (
              <button onClick={() => setTransferSearch('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
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
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Transfer Sessions Data Table */}
        <div className="glass-panel overflow-hidden border border-white/5 bg-slate-950/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold border-b border-white/10 text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Kullanıcı (User ID)</th>
                  <th className="px-5 py-3.5">Dosya Adı & Object Key</th>
                  <th className="px-5 py-3.5">İlerleme / Parçalar</th>
                  <th className="px-5 py-3.5">Transfer Edilen / Toplam</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5 text-right">Tarih / Saat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.length > 0 ? (
                  sessions.map((s) => {
                    const isDone = s.status === 'COMPLETED';
                    const isFailed = s.status === 'FAILED';

                    const currentCompletedChunks = isDone ? (s.totalChunks || 1) : s.completedChunks;
                    const currentUploadedBytes = isDone ? s.fileSize : s.uploadedBytes;

                    const percent = isDone 
                      ? 100 
                      : s.totalChunks > 0 
                      ? Math.min(100, Math.round((currentCompletedChunks / s.totalChunks) * 100))
                      : 0;

                    return (
                      <tr key={s.uploadId} className="hover:bg-slate-900/60 transition duration-150">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{s.userId || 'user_default'}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-xs truncate">
                          <span className="font-bold text-white block truncate text-sm">{s.fileName}</span>
                          <span className="text-[11px] text-slate-400 font-mono block truncate">{s.objectKey}</span>
                        </td>
                        <td className="px-5 py-4 font-mono">
                          <div className="space-y-1 min-w-[120px]">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Parça {currentCompletedChunks}/{s.totalChunks || 1}</span>
                              <span className="font-bold text-cyan-400">%{percent}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${isDone ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-cyan-400'}`} style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono whitespace-nowrap font-semibold">
                          <span className="text-slate-200">{formatBytes(currentUploadedBytes)}</span>
                          <span className="text-slate-400"> / {formatBytes(s.fileSize)}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isDone 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : isFailed
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse'
                          }`}>
                            {isDone ? 'TAMAMLANDI' : isFailed ? 'HATALI' : 'DEVAM EDİYOR'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(s.updatedAt || s.createdAt).toLocaleTimeString('tr-TR')}
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
        </div>

      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kullanılan Depolama</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition duration-200">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{formatBytes(stats.totalBytesUsed)}</span>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>Kapasite Oranı</span>
                <span className="font-mono text-cyan-400 font-bold">%{quotaPercent}</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div className="h-full progress-glow rounded-full transition-all duration-500" style={{ width: `${quotaPercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Nesneler</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition duration-200">
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
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition duration-200">
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
              <PieChart className="w-5 h-5" />
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
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Activity className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-lg text-white">Canlı İşlem Logları (Audit Stream)</h2>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-white/10 px-2.5 py-1 rounded-full">
              Son 20 Kayıt
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
            {stats.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((log) => (
                <div 
                  key={log.id} 
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-white/5 hover:border-blue-500/30 transition duration-150 group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-mono text-[10px] font-bold">
                      {log.action}
                    </span>
                    <div className="truncate">
                      <div className="text-sm font-semibold text-slate-200 truncate">
                        {log.bucket_name ? <span className="text-blue-400">{log.bucket_name}</span> : 'Sistem'}
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
          <div className="flex items-center space-x-2.5 pb-4 border-b border-white/10">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <PieChart className="w-4 h-4" />
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
                else if (category === 'application' || category === 'text') { icon = FileText; badgeStyle = "text-blue-300 bg-blue-500/10 border-blue-500/20"; }

                const IconComponent = icon;

                return (
                  <div key={category} className="space-y-2 p-3 rounded-xl bg-slate-950/40 border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-1.5 rounded-lg border ${badgeStyle}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="font-bold capitalize text-slate-200">{category}</span>
                      </div>
                      <span className="font-mono text-slate-300 font-semibold">{formatBytes(bytes)} (%{percent})</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-slate-500 space-y-2">
                <PieChart className="w-8 h-8 mx-auto text-slate-700" />
                <p className="text-sm font-medium">Kayıtlı dosya türü yok.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
