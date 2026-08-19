import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Crown, 
  Code, 
  Eye, 
  Check, 
  X, 
  RefreshCw, 
  UserCheck, 
  Lock, 
  Key,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function UsersTab({ currentUser, onSwitchUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('DEVELOPER');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          full_name: fullName.trim() || username.trim(),
          role,
          status: 'ACTIVE'
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        setUsername('');
        setFullName('');
        setRole('DEVELOPER');
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  const rolePermissions = [
    { permission: 'Bucket Oluşturma / Silme', admin: true, dev: true, viewer: false },
    { permission: 'Tekil & Multipart Dosya Yükleme', admin: true, dev: true, viewer: false },
    { permission: 'Dosya İndirme & Önizleme & ZIP Çıkarma', admin: true, dev: true, viewer: true },
    { permission: 'Dosya Taşıma / Yeniden Adlandırma', admin: true, dev: true, viewer: false },
    { permission: 'Çöp Kutusuna Taşıma & Geri Yükleme', admin: true, dev: true, viewer: false },
    { permission: 'Kalıcı Dosya Silme (Purge)', admin: true, dev: false, viewer: false },
    { permission: 'İmzalı URL (Presigned) Üretme', admin: true, dev: true, viewer: false },
    { permission: 'API Key & SDK Yönetimi', admin: true, dev: false, viewer: false },
    { permission: 'Webhook & Olay Bildirimleri', admin: true, dev: true, viewer: false },
    { permission: 'Yaşam Döngüsü (Lifecycle) Kuralları', admin: true, dev: false, viewer: false },
    { permission: 'Kullanıcı & Rol Yönetimi (RBAC)', admin: true, dev: false, viewer: false }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Kullanıcılar & Rol Tabanlı Erişim Yönetimi (RBAC)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Farklı kullanıcı hesapları oluşturun ve Admin, Developer, Viewer rolleriyle depolama izinlerini kontrol edin.
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span>Yeni Kullanıcı Ekle</span>
        </button>
      </div>

      {/* Role Summary Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-amber-500/25 flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-amber-300 block">👑 ADMIN (Yönetici)</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tüm sistem yetkilerine sahiptir. Kullanıcılar, Lifecycle kuralları, API anahtarları ve kalıcı silme işlemlerini yönetir.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-indigo-500/25 flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-indigo-300 block">💻 DEVELOPER (Geliştirici)</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dosya yükleme, indirme, taşıma, arşiv inceleme ve webhook yapılandırması yapabilir. Sistem ayarlarını değiştiremez.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-emerald-500/25 flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <span className="text-sm font-extrabold text-emerald-300 block">👁️ VIEWER (Sadece Okuma)</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Dosyaları listeleme, indirme ve önizleme yetkisine sahiptir. Hiçbir dosyayı yükleyemez, silemez veya değiştiremez.
            </p>
          </div>
        </div>

      </div>

      {/* Users Table */}
      <div className="glass-panel overflow-hidden border border-white/[0.06] bg-[#070910]/70">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="font-extrabold text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>Kayıtlı Kullanıcı Hesapları</span>
          </h2>
          <button onClick={fetchUsers} className="btn-subtle text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Kullanıcı (Username)</th>
                <th className="px-5 py-3.5">Ad Soyad</th>
                <th className="px-5 py-3.5">Rol (Role)</th>
                <th className="px-5 py-3.5">Durum</th>
                <th className="px-5 py-3.5">Oluşturulma Tarihi</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map((u) => {
                const isAdmin = u.role === 'ADMIN';
                const isDev = u.role === 'DEVELOPER';
                const isCurrent = currentUser?.username === u.username;

                return (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-5 py-4 font-mono font-bold text-white flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isAdmin 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : isDev
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isAdmin ? <Crown className="w-4 h-4" /> : isDev ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="block">{u.username}</span>
                        {isCurrent && (
                          <span className="text-[10px] text-indigo-400 font-sans block">(Şu Anki Oturum)</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-bold text-slate-200">
                      {u.full_name}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        isAdmin 
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                          : isDev
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {u.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">
                      {new Date(u.created_at).toLocaleString('tr-TR')}
                    </td>

                    <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                      {onSwitchUser && (
                        <button
                          onClick={() => onSwitchUser(u)}
                          className="btn-subtle py-1 px-2.5 text-xs text-indigo-300"
                          title="Bu Kullanıcı Olarak Oturum Aç"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1 inline" />
                          <span>Bu Kullanıcı Ol</span>
                        </button>
                      )}

                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                          title="Kullanıcıyı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="glass-panel p-6 space-y-4 border border-indigo-500/20 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#141226]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">Rol & İzin Matrisi (Permission Matrix)</h3>
            <p className="text-xs text-slate-400">Kullanıcı rollerinin sistem genelindeki yetki sınırları</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
              <tr>
                <th className="px-4 py-3">İşlem & Yetki Alanı</th>
                <th className="px-4 py-3 text-center text-amber-300">👑 Admin</th>
                <th className="px-4 py-3 text-center text-indigo-300">💻 Developer</th>
                <th className="px-4 py-3 text-center text-emerald-300">👁️ Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rolePermissions.map((rp, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-white">{rp.permission}</td>
                  <td className="px-4 py-3 text-center">
                    {rp.admin ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rp.dev ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rp.viewer ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <X className="w-4 h-4 text-slate-600 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-md bg-[#080b13] border border-slate-700/80 shadow-2xl relative space-y-5 animate-fadeIn">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Yeni Kullanıcı Tanımla</span>
            </h2>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Kullanıcı Adı (Username)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn: dev_caner" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Ad Soyad</label>
                <input 
                  type="text" 
                  placeholder="Örn: Caner Geliştirici" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Rol (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ADMIN">👑 ADMIN (Tam Yönetici Yetkisi)</option>
                  <option value="DEVELOPER">💻 DEVELOPER (Dosya Yükleme & Okuma)</option>
                  <option value="VIEWER">👁️ VIEWER (Sadece Okuma / Denetçi)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-subtle">İptal</button>
                <button type="submit" className="btn-accent">Kullanıcıyı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
