import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Power, 
  Sliders, 
  Layers, 
  FolderArchive,
  Database,
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function LifecycleTab({ buckets = [] }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runReport, setRunReport] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [bucketName, setBucketName] = useState('*');
  const [prefix, setPrefix] = useState('');
  const [action, setAction] = useState('EXPIRE_SOFT_DELETE');
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/lifecycle`);
      const data = await res.json();
      if (data.success) {
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRule(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bucket_name: bucketName,
          prefix: prefix.trim(),
          action,
          days_after_creation: parseInt(days, 10) || 7,
          is_active: 1
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        setName('');
        setPrefix('');
        setDays(7);
        fetchRules();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggleActive(rule) {
    try {
      await fetch(`${API_BASE}/api/lifecycle/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: rule.is_active ? 0 : 1 })
      });
      fetchRules();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu Yaşam Döngüsü Kuralını silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${API_BASE}/api/lifecycle/${id}`, { method: 'DELETE' });
      fetchRules();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRunNow(ruleId = null) {
    setRunning(true);
    setRunReport(null);
    try {
      const res = await fetch(`${API_BASE}/api/lifecycle/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_id: ruleId })
      });
      const data = await res.json();
      setRunReport(data);
      fetchRules();
    } catch (err) {
      setRunReport({ success: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Clock className="w-6 h-6 text-indigo-400" />
            <span>S3 Yaşam Döngüsü & Otomatik Temizleme (Lifecycle Rules)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Geçici dosyaların, logların ve eski yedeklerin diski şişirmesini önleyen otomatik temizleme kuralları.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => handleRunNow()} 
            disabled={running}
            className="btn-subtle text-xs flex items-center gap-2 px-4 py-2.5 bg-[#0e1220] border-indigo-500/30 text-indigo-300"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : 'text-indigo-400'}`} />
            <span>{running ? 'Kurallar İşleniyor...' : 'Tüm Kuralları Şimdi Çalıştır'}</span>
          </button>

          <button onClick={() => setModalOpen(true)} className="btn-accent">
            <Plus className="w-4 h-4" />
            <span>Yeni Kural Ekle</span>
          </button>
        </div>
      </div>

      {/* Execution Report Toast */}
      {runReport && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between animate-fadeIn shadow-lg ${
          runReport.success 
            ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center space-x-3">
            {runReport.success ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
            <div>
              <strong className="block font-bold text-white">
                {runReport.success ? 'Yaşam Döngüsü Temizliği Başarıyla Tamamlandı' : 'Temizlik Sırasında Hata Oluştu'}
              </strong>
              <span className="text-[11px] opacity-90">
                {runReport.success 
                  ? `${runReport.processedRules} kural çalıştırıldı, ${runReport.affectedObjects} nesne işlendi.` 
                  : runReport.error}
              </span>
            </div>
          </div>
          <button onClick={() => setRunReport(null)} className="text-slate-400 hover:text-white text-xs">Kapat</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-indigo-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Kayıtlı Kurallar</span>
            <span className="text-2xl font-extrabold text-white font-mono">{rules.length} Kural</span>
            <span className="text-[11px] text-indigo-300 block">{rules.filter(r => r.is_active).length} Aktif Otomatik Kural</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-emerald-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Zamanlayıcı Sıklığı</span>
            <span className="text-lg font-extrabold text-emerald-300 block font-mono">Her 1 Saatte Bir</span>
            <span className="text-[11px] text-slate-400 block">Arka planda sessiz otomatik kontrol</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-purple-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Toplam Temizlenen Nesne</span>
            <span className="text-2xl font-extrabold text-purple-300 font-mono">
              {rules.reduce((acc, curr) => acc + (curr.affected_objects_count || 0), 0)} Dosya
            </span>
            <span className="text-[11px] text-slate-400 block">Disk alanı sürekli optimize ediliyor</span>
          </div>
        </div>

      </div>

      {/* Rules List */}
      <div className="glass-panel overflow-hidden border border-white/[0.06] bg-[#070910]/70">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="font-extrabold text-white text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Aktif Yaşam Döngüsü Kuralları Tablosu</span>
          </h2>
          <button onClick={fetchRules} className="btn-subtle text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Kural Tanımı</th>
                <th className="px-5 py-3.5">Hedef Bucket & Prefix</th>
                <th className="px-5 py-3.5">Temizleme Süresi</th>
                <th className="px-5 py-3.5">Eylem (Action)</th>
                <th className="px-5 py-3.5">Durum</th>
                <th className="px-5 py-3.5">Son Çalışma & Temizlenen</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rules.length > 0 ? (
                rules.map((r) => {
                  const isSoft = r.action === 'EXPIRE_SOFT_DELETE';
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-5 py-4 font-bold text-white">
                        <div className="flex items-center space-x-2.5">
                          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Clock className="w-4 h-4" />
                          </div>
                          <span>{r.name}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 font-mono">
                        <span className="text-indigo-300 font-bold block">{r.bucket_name === '*' ? '🌐 Tüm Bucket\'lar' : `🪣 ${r.bucket_name}`}</span>
                        {r.prefix && (
                          <span className="text-[11px] text-slate-400 block">📁 {r.prefix}</span>
                        )}
                      </td>

                      <td className="px-5 py-4 font-mono whitespace-nowrap">
                        <span className="bg-[#090d18] border border-white/10 px-2.5 py-1 rounded-lg text-indigo-300 font-bold">
                          {r.days_after_creation} Gün Sonra
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          isSoft 
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}>
                          {isSoft ? '🗑️ Çöp Kutusuna Taşı' : '🔥 Diskten Kalıcı Sil'}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          r.is_active 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {r.is_active ? 'AKTİF' : 'PASİF'}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">
                        <span className="block text-slate-300">{r.last_run_at ? new Date(r.last_run_at).toLocaleString('tr-TR') : 'Henüz çalışmadı'}</span>
                        <span className="block text-indigo-400">{r.affected_objects_count || 0} dosya temizlendi</span>
                      </td>

                      <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleRunNow(r.id)}
                          className="btn-subtle p-2 text-xs"
                          title="Bu Kuralı Şimdi Çalıştır"
                        >
                          <Play className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(r)}
                          className={`p-2 rounded-lg border transition ${
                            r.is_active 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title={r.is_active ? 'Pasife Al' : 'Aktif Et'}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                          title="Kuralı Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-500">
                    Henüz tanımlı yaşam döngüsü kuralı bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Lifecycle Rule */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-lg bg-[#080b13] border border-slate-700/80 shadow-2xl relative space-y-5 animate-fadeIn">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-indigo-400" />
              <span>Yeni Yaşam Döngüsü Kuralı Oluştur</span>
            </h2>

            <form onSubmit={handleCreateRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Kural Adı</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn: 30 Günden Eski Logları Kalıcı Sil" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Hedef Bucket</label>
                  <select
                    value={bucketName}
                    onChange={(e) => setBucketName(e.target.value)}
                    className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="*">🌐 Tüm Bucket'lar (*)</option>
                    {buckets.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Klasör / Prefix (Opsiyonel)</label>
                  <input 
                    type="text" 
                    placeholder="Örn: temp/ veya logs/" 
                    value={prefix} 
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Süre (Oluşturulduktan Kaç Gün Sonra)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={days} 
                    onChange={(e) => setDays(e.target.value)}
                    className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Eylem (Action)</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EXPIRE_SOFT_DELETE">🗑️ Çöp Kutusuna Taşı (Soft Delete)</option>
                    <option value="EXPIRE_PERMANENT_DELETE">🔥 Diskten Kalıcı Sil (Permanent Delete)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-subtle">İptal</button>
                <button type="submit" className="btn-accent">Kuralı Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
