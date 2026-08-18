import React from 'react';
import { 
  HardDrive, 
  Database, 
  Files, 
  Activity, 
  PieChart, 
  PlusCircle, 
  Upload, 
  Link2,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  File,
  ShieldCheck,
  Zap,
  ArrowUpRight
} from 'lucide-react';

export default function OverviewTab({ stats, onNavigate }) {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-sm text-slate-400 font-medium">S3 Depolama İstatistikleri Yükleniyor...</p>
      </div>
    );
  }

  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

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
              AWS S3 standartlarında nesne depolama, ETag doğrulaması, HTTP Range medya akışı ve HMAC imzalı bağlantı servisi.
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

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Used Storage */}
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

        {/* Card 2: Total Objects */}
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

        {/* Card 3: Total Buckets */}
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

        {/* Card 4: Total Storage Quota */}
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
        
        {/* Activity Stream (2 cols) */}
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

        {/* Content Type Breakdown (1 col) */}
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
