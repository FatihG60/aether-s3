import React from 'react';
import { 
  Database, 
  HardDrive, 
  KeyRound, 
  Link2, 
  BarChart3, 
  Server, 
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stats }) {
  const tabs = [
    { id: 'overview', label: 'Genel Bakış', icon: BarChart3, badge: 'Dashboard' },
    { id: 'buckets', label: 'Bucket Yönetimi', icon: Database, count: stats?.totalBuckets },
    { id: 'objects', label: 'Dosya Yöneticisi', icon: HardDrive, count: stats?.totalObjects },
    { id: 'presigned', label: 'İmzalı URL Üretici', icon: Link2, badge: 'HMAC' },
    { id: 'apikeys', label: 'API & SDK Erişim', icon: KeyRound, badge: 'Keys' },
  ];

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  return (
    <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-4">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-600 rounded-2xl blur opacity-60 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-11 h-11 bg-slate-950 rounded-xl flex items-center justify-center border border-white/10">
                <Database className="w-6 h-6 text-blue-400 group-hover:scale-110 transition duration-200" />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-extrabold text-xl tracking-tight text-white font-sans">AETHER<span className="text-blue-400">S3</span></span>
                <span className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wide">
                  ENTERPRISE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Yerel Nesne Depolama & S3 API Sunucusu</p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="hidden lg:flex items-center space-x-4">
            
            {/* Live Engine Status */}
            <div className="flex items-center space-x-2.5 bg-slate-900/90 border border-white/10 rounded-full px-4 py-1.5 text-xs shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-200 font-semibold">Motor Çevrimiçi</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 font-mono">localhost:5000</span>
            </div>

            {/* Storage Metric Pill */}
            {stats && (
              <div className="bg-gradient-to-r from-blue-950/60 to-slate-900/60 border border-blue-500/30 rounded-full px-4 py-1.5 text-xs text-slate-200 flex items-center space-x-2">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Toplam Kullanım: <strong className="text-blue-400 font-mono font-bold">{formatBytes(stats.totalBytesUsed)}</strong></span>
              </div>
            )}
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 overflow-x-auto pb-3 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2.5 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? 'bg-blue-500/30 text-blue-200' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && tab.count === undefined && (
                  <span className="text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 px-1.5 py-0.2 rounded font-mono uppercase">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
