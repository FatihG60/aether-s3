import React, { useState } from 'react';
import { 
  Database, 
  Plus, 
  Globe, 
  Lock, 
  Trash2, 
  HardDrive, 
  Folder, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Layers
} from 'lucide-react';

export default function BucketsTab({ buckets, fetchBuckets, onSelectBucket }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    region: 'eu-central-1',
    is_public: false,
    quota_gb: 10
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async function handleCreateBucket(e) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!data.success) {
        setErrorMsg(data.error || 'Bucket oluşturulamadı.');
        setLoading(false);
        return;
      }

      setIsModalOpen(false);
      setFormData({ name: '', region: 'eu-central-1', is_public: false, quota_gb: 10 });
      fetchBuckets();
    } catch (err) {
      setErrorMsg('Sunucu hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBucket(bucketName) {
    if (!window.confirm(`"${bucketName}" bucket'ını ve içindeki tüm verileri silmek istediğinize emin misiniz?`)) return;

    try {
      const res = await fetch(`/api/buckets/${bucketName}?force=true`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchBuckets();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Silme hatası: ' + err.message);
    }
  }

  async function handleTogglePublic(bucket) {
    try {
      await fetch(`/api/buckets/${bucket.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !bucket.is_public })
      });
      fetchBuckets();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Database className="w-6 h-6 text-indigo-400" />
            <span>S3 Bucket Konteynerleri</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">İzole depolama alanları, erişim izinleri ve kota sınırları.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span>Yeni Bucket Oluştur</span>
        </button>
      </div>

      {/* Bucket Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {buckets && buckets.length > 0 ? (
          buckets.map((b) => {
            const usedBytes = b.total_bytes || 0;
            const quotaBytes = b.quota_bytes || 10737418240;
            const percent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

            return (
              <div 
                key={b.id} 
                className="glass-panel p-6 flex flex-col justify-between hover:border-indigo-500/50 group transition duration-300 relative overflow-hidden bg-gradient-to-b from-[#0e121d] to-[#090b14]"
              >
                <div>
                  {/* Top: Icon + Name + Access Badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition duration-200 shadow-md">
                        <Folder className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 
                          onClick={() => onSelectBucket(b.name)}
                          className="font-bold text-white text-lg cursor-pointer hover:text-indigo-400 transition"
                        >
                          {b.name}
                        </h3>
                        <span className="text-[11px] text-indigo-300 font-mono bg-[#090c14] px-2 py-0.5 rounded border border-white/10 inline-block mt-1">
                          🌍 {b.region}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePublic(b)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer border transition ${
                        b.is_public 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {b.is_public ? <Globe className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3" />}
                      <span>{b.is_public ? 'Public' : 'Private'}</span>
                    </button>
                  </div>

                  {/* Quota Progress Bar */}
                  <div className="mt-6 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{b.object_count || 0} Nesne</span>
                      <span className="text-slate-400 font-mono">{formatBytes(usedBytes)} / {formatBytes(quotaBytes)}</span>
                    </div>
                    <div className="w-full h-2 bg-[#05070d] rounded-full overflow-hidden p-0.5 border border-white/5">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${
                          percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        }`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                  <button 
                    onClick={() => onSelectBucket(b.name)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 group-hover:translate-x-1 transition duration-200"
                  >
                    <span>Dosyaları Yönet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button 
                    onClick={() => handleDeleteBucket(b.name)}
                    className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition" 
                    title="Bucket'ı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center glass-panel">
            <Database className="w-14 h-14 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Henüz Bir Bucket Yok</h3>
            <p className="text-slate-400 text-sm mt-1 mb-6">İlk S3 depolama alanınızı oluşturarak başlayın.</p>
            <button onClick={() => setIsModalOpen(true)} className="btn-accent">
              <Plus className="w-4 h-4" />
              <span>İlk Bucket'ı Oluştur</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Create Bucket */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-lg border border-slate-700/80 bg-[#080b13] shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Yeni Bucket Oluştur</h2>
                <p className="text-xs text-slate-400">AWS S3 isim kurallarına uygun benzersiz tanımlayıcı seçin.</p>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateBucket} className="mt-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Bucket İsmi</label>
                <input 
                  type="text" 
                  required
                  placeholder="ornek-depo-bucket" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Küçük harf, rakam ve tire (-) içerebilir (3-63 karakter).</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Bölge (Region)</label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                  <option value="us-east-1">us-east-1 (N. Virginia)</option>
                  <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Depolama Kotası (GB)</label>
                <input 
                  type="number" 
                  min="1"
                  max="1000"
                  value={formData.quota_gb}
                  onChange={(e) => setFormData({ ...formData, quota_gb: e.target.value })}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-[#05070d] border border-slate-800/80">
                <div>
                  <span className="block text-xs font-bold text-white">Genel Erişim (Public Access)</span>
                  <span className="text-[11px] text-slate-400">Dosyalar imzasız direkt URL ile erişilebilir.</span>
                </div>
                <input 
                  type="checkbox"
                  checked={formData.is_public}
                  onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-subtle"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-accent"
                >
                  {loading ? 'Oluşturuluyor...' : 'Bucket Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
