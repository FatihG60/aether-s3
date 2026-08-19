import React, { useState, useEffect } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Send, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Radio, 
  Layers, 
  ExternalLink,
  CheckCircle2,
  Power,
  Sliders,
  Code
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function WebhooksTab() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [format, setFormat] = useState('discord');
  const [selectedEvents, setSelectedEvents] = useState([
    's3:ObjectCreated:*',
    's3:ObjectRemoved:*',
    's3:ObjectRestored',
    's3:ObjectMoved'
  ]);

  // Quick Direct URL Tester
  const [directTestUrl, setDirectTestUrl] = useState('');
  const [directTestFormat, setDirectTestFormat] = useState('discord');
  const [directTesting, setDirectTesting] = useState(false);
  const [directTestResult, setDirectTestResult] = useState(null);

  const availableEvents = [
    { id: 's3:ObjectCreated:*', label: '📤 Yeni Dosya Yüklendi (s3:ObjectCreated:*)', desc: 'Tekil veya parçalı yükleme tamamlandığında' },
    { id: 's3:ObjectRemoved:*', label: '🗑️ Dosya Silindi (s3:ObjectRemoved:*)', desc: 'Çöp kutusuna taşındığında veya kalıcı silindiğinde' },
    { id: 's3:ObjectRestored', label: '♻️ Dosya Geri Yüklendi (s3:ObjectRestored)', desc: 'Çöp kutusundan geri çıkarıldığında' },
    { id: 's3:ObjectMoved', label: '🚚 Dosya Taşındı / Yeniden Adlandırıldı (s3:ObjectMoved)', desc: 'Klasör veya bucket değiştirildiğinde' }
  ];

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/webhooks`);
      const data = await res.json();
      if (data.success) {
        setWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleEvent(eventId) {
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter(e => e !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
  }

  async function handleCreateWebhook(e) {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Webhook Endpoint',
          target_url: targetUrl.trim(),
          events: selectedEvents.join(','),
          format,
          is_active: 1
        })
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        setName('');
        setTargetUrl('');
        fetchWebhooks();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleToggleActive(webhook) {
    try {
      await fetch(`${API_BASE}/api/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: webhook.is_active ? 0 : 1 })
      });
      fetchWebhooks();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu Webhook kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${API_BASE}/api/webhooks/${id}`, { method: 'DELETE' });
      fetchWebhooks();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleTestWebhook(id) {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ id, success: data.success, message: data.message || data.error });
    } catch (err) {
      setTestResult({ id, success: false, message: err.message });
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(null), 6000);
    }
  }

  async function handleDirectTest(e) {
    e.preventDefault();
    if (!directTestUrl.trim()) return;
    setDirectTesting(true);
    setDirectTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/webhooks/test-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: directTestUrl.trim(),
          format: directTestFormat
        })
      });
      const data = await res.json();
      setDirectTestResult({ success: data.success, message: data.message || data.error });
    } catch (err) {
      setDirectTestResult({ success: false, message: err.message });
    } finally {
      setDirectTesting(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Webhook className="w-6 h-6 text-indigo-400" />
            <span>S3 Olay Bildirimleri & Webhook Entegrasyonu</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Dosya yüklendiğinde veya silindiğinde Discord, Slack veya harici API servislerinize anında bildirim gönderin.
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span>Yeni Webhook Ekle</span>
        </button>
      </div>

      {/* Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-indigo-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Kayıtlı Webhook'lar</span>
            <span className="text-2xl font-extrabold text-white font-mono">{webhooks.length} Adet</span>
            <span className="text-[11px] text-indigo-300 block">{webhooks.filter(w => w.is_active).length} Aktif Dinleyici</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-emerald-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Desteklenen Formatlar</span>
            <span className="text-sm font-extrabold text-emerald-300 block font-mono">Discord Embed & AWS S3 JSON</span>
            <span className="text-[11px] text-slate-400 block">Otomatik Format Algılama</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#090c14]/80 border border-purple-500/20 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Çalışma Prensibi</span>
            <span className="text-sm font-extrabold text-purple-300 block font-mono">Non-blocking Asenkron</span>
            <span className="text-[11px] text-slate-400 block">Ana transferi asla yavaşlatmaz</span>
          </div>
        </div>

      </div>

      {/* Webhook List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-white text-lg flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <span>Yapılandırılmış Webhook Uç Noktaları</span>
          </h2>
          <button onClick={fetchWebhooks} className="btn-subtle text-xs flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>

        {webhooks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {webhooks.map((w) => {
              const eventsArray = (w.events || '').split(',').map(e => e.trim()).filter(Boolean);
              const isDiscord = w.format === 'discord' || (w.target_url && w.target_url.includes('discord.com'));

              return (
                <div 
                  key={w.id} 
                  className={`p-6 rounded-2xl border transition relative space-y-4 ${
                    w.is_active 
                      ? 'bg-[#080b13]/80 border-indigo-500/30 shadow-lg' 
                      : 'bg-[#06080e]/60 border-white/[0.06] opacity-60'
                  }`}
                >
                  {/* Webhook Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isDiscord 
                          ? 'bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2]' 
                          : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
                      }`}>
                        <Webhook className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{w.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            isDiscord 
                              ? 'bg-[#5865F2]/10 border-[#5865F2]/30 text-[#7983f5]' 
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}>
                            {isDiscord ? 'Discord Embed' : 'AWS S3 JSON'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            w.is_active 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                            {w.is_active ? 'AKTİF' : 'PASİF'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleToggleActive(w)}
                        className={`p-2 rounded-xl border transition ${
                          w.is_active 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title={w.is_active ? 'Pasife Al' : 'Aktif Et'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                        title="Webhook'u Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Target URL */}
                  <div className="bg-[#05070d] p-2.5 rounded-xl border border-white/5 font-mono text-xs text-indigo-300 truncate">
                    <span className="text-slate-500 select-none mr-1.5">URL:</span>
                    <span className="select-all">{w.target_url}</span>
                  </div>

                  {/* Subscribed Events Pills */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Abone Olunan Olaylar</span>
                    <div className="flex flex-wrap gap-1.5">
                      {eventsArray.map(evt => (
                        <span key={evt} className="bg-[#0e1220] border border-indigo-500/25 text-indigo-200 text-[11px] px-2.5 py-1 rounded-lg font-mono">
                          {evt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Test Dispatch Button */}
                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                    <span className="text-[11px] text-slate-500 font-mono">
                      Eklenme: {new Date(w.created_at).toLocaleDateString('tr-TR')}
                    </span>
                    <button
                      onClick={() => handleTestWebhook(w.id)}
                      disabled={testingId === w.id}
                      className="btn-subtle text-xs flex items-center gap-1.5"
                    >
                      <Send className={`w-3.5 h-3.5 ${testingId === w.id ? 'animate-spin' : ''}`} />
                      <span>{testingId === w.id ? 'Test Gönderiliyor...' : 'Test Olayı Gönder'}</span>
                    </button>
                  </div>

                  {/* Test Result Toast */}
                  {testResult && testResult.id === w.id && (
                    <div className={`p-3 rounded-xl text-xs border flex items-center space-x-2 animate-fadeIn ${
                      testResult.success 
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}>
                      {testResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel p-12 text-center space-y-4 border border-white/[0.06] bg-[#070910]/70">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 mx-auto flex items-center justify-center">
              <Webhook className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-lg">Henüz Tanımlı Webhook Yok</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Discord kanalınıza veya kendi backend servisinize dosya yükleme/silme olaylarını anlık aktarmak için ilk webhook'unuzu ekleyin.
              </p>
            </div>
            <button onClick={() => setModalOpen(true)} className="btn-accent">
              <Plus className="w-4 h-4" />
              <span>İlk Webhook'u Ekle</span>
            </button>
          </div>
        )}
      </div>

      {/* Direct URL Instant Tester */}
      <div className="glass-panel p-6 space-y-4 border border-purple-500/20 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#141226]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-base">Hızlı Webhook URL Test Edici</h3>
            <p className="text-xs text-slate-400">Kaydetmeden önce herhangi bir Discord veya API URL'ini anında test edin</p>
          </div>
        </div>

        <form onSubmit={handleDirectTest} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="url" 
              required
              placeholder="https://discord.com/api/webhooks/... veya https://api.mysite.com/webhook" 
              value={directTestUrl}
              onChange={(e) => setDirectTestUrl(e.target.value)}
              className="flex-1 bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition"
            />
            <select
              value={directTestFormat}
              onChange={(e) => setDirectTestFormat(e.target.value)}
              className="bg-[#05070d] border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="discord">Discord Embed Formatı</option>
              <option value="standard_s3_json">Standart S3 JSON Formatı</option>
            </select>
            <button 
              type="submit" 
              disabled={directTesting}
              className="btn-accent text-xs whitespace-nowrap flex items-center justify-center gap-2 px-5"
            >
              <Send className={`w-3.5 h-3.5 ${directTesting ? 'animate-spin' : ''}`} />
              <span>{directTesting ? 'Gönderiliyor...' : 'Test Gönder'}</span>
            </button>
          </div>

          {directTestResult && (
            <div className={`p-3 rounded-xl text-xs border flex items-center space-x-2 animate-fadeIn ${
              directTestResult.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {directTestResult.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{directTestResult.message}</span>
            </div>
          )}
        </form>
      </div>

      {/* Modal: Create Webhook */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-lg bg-[#080b13] border border-slate-700/80 shadow-2xl relative space-y-5 animate-fadeIn">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Webhook className="w-5 h-5 text-indigo-400" />
              <span>Yeni S3 Olay Webhook'u Ekle</span>
            </h2>

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Webhook Adı</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn: Discord #depolama-bildirimleri" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Hedef Webhook URL</label>
                <input 
                  type="url" 
                  required 
                  placeholder="https://discord.com/api/webhooks/... veya https://api.site.com/hook" 
                  value={targetUrl} 
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Mesaj Formatı</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="discord">Discord Embed (Renkli Bilgi Kartı)</option>
                  <option value="standard_s3_json">Standart AWS S3 Event JSON Records</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Tetiklenecek Olaylar (Events)</label>
                <div className="space-y-2 bg-[#05070d] p-3 rounded-xl border border-white/5">
                  {availableEvents.map(evt => (
                    <label key={evt.id} className="flex items-start space-x-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={selectedEvents.includes(evt.id)}
                        onChange={() => toggleEvent(evt.id)}
                        className="mt-1 rounded accent-indigo-600"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">{evt.label}</span>
                        <span className="text-[11px] text-slate-400 block">{evt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-subtle">İptal</button>
                <button type="submit" className="btn-accent">Webhook'u Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
