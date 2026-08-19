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
  Activity,
  Layers,
  Webhook,
  Clock,
  Users,
  Crown,
  Code,
  Eye
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stats, currentUser, users = [], onSwitchUser }) {
  const tabs = [
    { id: 'overview', label: 'Genel Bakış', icon: BarChart3, badge: 'Dashboard' },
    { id: 'buckets', label: 'Bucket Yönetimi', icon: Database, count: stats?.totalBuckets },
    { id: 'objects', label: 'Dosya Yöneticisi', icon: HardDrive, count: stats?.totalObjects },
    { id: 'presigned', label: 'İmzalı URL Üretici', icon: Link2, badge: 'HMAC' },
    { id: 'apikeys', label: 'API & SDK Erişim', icon: KeyRound, badge: 'Keys' },
    { id: 'webhooks', label: 'Webhook & Bildirimler', icon: Webhook, badge: 'Events' },
    { id: 'lifecycle', label: 'Yaşam Döngüsü', icon: Clock, badge: 'Auto' },
    { id: 'users', label: 'Kullanıcılar & RBAC', icon: Users, badge: 'Security' },
  ];

  function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  const roleColor = currentUser?.role === 'ADMIN' 
    ? 'text-amber-300 bg-amber-500/10 border-amber-500/30' 
    : currentUser?.role === 'DEVELOPER'
    ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30'
    : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';

  return (
    <header className="border-b border-white/[0.08] bg-[#07080d]/85 backdrop-blur-2xl sticky top-0 z-50 transition-all">
      <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-4">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-11 h-11 bg-[#0d101b] rounded-xl flex items-center justify-center border border-white/15 shadow-inner">
                <Database className="w-5.5 h-5.5 text-indigo-400 group-hover:scale-110 transition duration-200" />
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-extrabold text-xl tracking-tight text-white font-sans">AETHER<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">S3</span></span>
                <span className="bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full tracking-wider shadow-sm">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Özel Nesne Depolama & S3 Motoru</p>
            </div>
          </div>

          {/* Right Status Badges & User Selector */}
          <div className="hidden lg:flex items-center space-x-3.5">
            
            {/* Active User / Role Pill */}
            {currentUser && (
              <div className={`flex items-center space-x-2 border rounded-full px-3.5 py-1.5 text-xs font-semibold ${roleColor}`}>
                {currentUser.role === 'ADMIN' ? <Crown className="w-3.5 h-3.5" /> : currentUser.role === 'DEVELOPER' ? <Code className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{currentUser.full_name || currentUser.username}</span>
                <span className="opacity-60 text-[10px] uppercase">({currentUser.role})</span>
              </div>
            )}

            {/* Live Engine Status */}
            <div className="flex items-center space-x-2.5 bg-[#0e121e]/90 border border-white/10 rounded-full px-4 py-1.5 text-xs shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-200 font-semibold">Motor Çevrimiçi</span>
              <span className="text-slate-700">|</span>
              <span className="text-indigo-300 font-mono text-[11px]">localhost:5000</span>
            </div>

            {/* Storage Metric Pill */}
            {stats && (
              <div className="bg-gradient-to-r from-indigo-950/50 via-purple-950/40 to-[#0e121e] border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs text-slate-200 flex items-center space-x-2 shadow-sm">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>Toplam Kullanım: <strong className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 font-mono font-bold">{formatBytes(stats.totalBytesUsed)}</strong></span>
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
                className={`flex items-center space-x-2.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/25 to-purple-600/20 text-white border border-indigo-500/50 shadow-lg shadow-indigo-500/15'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isActive ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/20' : 'bg-slate-800/80 text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && tab.count === undefined && (
                  <span className="text-[9px] bg-purple-500/15 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-mono uppercase">
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
