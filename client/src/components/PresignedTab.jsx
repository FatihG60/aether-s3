import React, { useState, useEffect } from 'react';
import { Link2, Clock, Copy, Check, ShieldCheck, Key, ArrowRight, Sparkles } from 'lucide-react';

export default function PresignedTab({ buckets, defaultBucket, defaultKey }) {
  const [bucket, setBucket] = useState(defaultBucket || (buckets[0] ? buckets[0].name : ''));
  const [objectKey, setObjectKey] = useState(defaultKey || '');
  const [action, setAction] = useState('read');
  const [expiresInMinutes, setExpiresInMinutes] = useState(60);
  const [resultUrl, setResultUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultBucket) setBucket(defaultBucket);
    if (defaultKey) setObjectKey(defaultKey);
  }, [defaultBucket, defaultKey]);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!bucket || !objectKey) return;
    setLoading(true);

    try {
      const res = await fetch('/api/presigned/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket,
          key: objectKey,
          action,
          expiresInMinutes: parseInt(expiresInMinutes, 10)
        })
      });

      const data = await res.json();
      if (data.success) {
        setResultUrl(data);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
      
      {/* Title */}
      <div className="glass-panel p-8 relative overflow-hidden border border-cyan-500/20 bg-gradient-to-r from-slate-950 to-cyan-950/30">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Link2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">İmzalı Geçici Bağlantı Üretici (Presigned URLs)</h1>
            <p className="text-xs text-slate-400 mt-1">
              AWS S3 standartlarında HMAC-SHA256 imzalı, süreli ve güvenli dosya erişim adresi oluşturun.
            </p>
          </div>
        </div>
      </div>

      {/* Generator Form */}
      <div className="glass-panel p-8 space-y-6">
        <form onSubmit={handleGenerate} className="space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Bucket Seç</label>
              <select
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              >
                {buckets.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Dosya Key (Yolu)</label>
              <input 
                type="text" 
                required
                placeholder="ornek-dosya.png" 
                value={objectKey}
                onChange={(e) => setObjectKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">İşlem Türü</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              >
                <option value="read">İndirme / Okuma (Read)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Geçerlilik Süresi</label>
              <select
                value={expiresInMinutes}
                onChange={(e) => setExpiresInMinutes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
              >
                <option value="15">15 Dakika</option>
                <option value="60">1 Saat</option>
                <option value="1440">24 Saat (1 Gün)</option>
                <option value="10080">7 Gün</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-accent w-full justify-center py-3 text-sm mt-2"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>{loading ? 'İmzalı URL Üretiliyor...' : 'İmzalı Güvenli Bağlantı Üret'}</span>
          </button>
        </form>

        {/* Result Box */}
        {resultUrl && (
          <div className="mt-8 pt-6 border-t border-white/10 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>HMAC İmzalı Güvenli Bağlantı Üretildi</span>
              </span>
              <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                Geçerlilik: {new Date(resultUrl.expiresAt).toLocaleString('tr-TR')}
              </span>
            </div>

            <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 shadow-inner">
              <span className="font-mono text-xs text-cyan-300 truncate select-all">{resultUrl.url}</span>
              <button 
                onClick={() => copyToClipboard(resultUrl.url)}
                className="btn-subtle py-2 px-3 text-xs shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
