import React, { useState } from 'react';
import { 
  Terminal, 
  Play, 
  Send, 
  Copy, 
  Check, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  Code, 
  Database,
  ArrowRight,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Server
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function PlaygroundTab({ buckets = [] }) {
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/');
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/xml, application/json, text/plain, */*' },
    { key: 'x-amz-date', value: new Date().toISOString() }
  ]);
  const [requestBody, setRequestBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Quick Presets
  const presets = [
    {
      name: '🌐 ListAllMyBuckets (S3 XML)',
      method: 'GET',
      endpoint: '/',
      headers: [{ key: 'Accept', value: 'application/xml' }],
      body: ''
    },
    {
      name: '🪣 ListObjectsV2 (S3 XML)',
      method: 'GET',
      endpoint: `/${buckets[0]?.name || 'general-storage'}`,
      headers: [{ key: 'Accept', value: 'application/xml' }],
      body: ''
    },
    {
      name: '🚀 Raw PutObject Stream (S3 REST)',
      method: 'PUT',
      endpoint: `/${buckets[0]?.name || 'general-storage'}/api-test-${Date.now().toString().slice(-4)}.txt`,
      headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }],
      body: 'AETHER S3 REST API Playground üzerinden gönderilen test verisi.'
    },
    {
      name: '📥 GetObject Stream (S3 REST)',
      method: 'GET',
      endpoint: `/${buckets[0]?.name || 'general-storage'}/api-test.txt`,
      headers: [{ key: 'Range', value: 'bytes=0-1024' }],
      body: ''
    },
    {
      name: '🔍 HeadObject Metadata',
      method: 'HEAD',
      endpoint: `/${buckets[0]?.name || 'general-storage'}/api-test.txt`,
      headers: [],
      body: ''
    },
    {
      name: '📊 Dashboard Engine Stats',
      method: 'GET',
      endpoint: '/api/stats',
      headers: [{ key: 'Accept', value: 'application/json' }],
      body: ''
    },
    {
      name: '🔔 Webhook Event Dispatch Test',
      method: 'POST',
      endpoint: '/api/webhooks/test',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify({ targetUrl: 'https://httpbin.org/post', format: 'standard_s3_json' }, null, 2)
    }
  ];

  function applyPreset(preset) {
    setMethod(preset.method);
    setEndpoint(preset.endpoint);
    setHeaders(preset.headers.length > 0 ? [...preset.headers] : [{ key: 'Accept', value: '*/*' }]);
    setRequestBody(preset.body);
    setResponse(null);
  }

  function addHeader() {
    setHeaders([...headers, { key: '', value: '' }]);
  }

  function updateHeader(index, field, value) {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  }

  function removeHeader(index) {
    setHeaders(headers.filter((_, i) => i !== index));
  }

  async function handleExecuteRequest() {
    setLoading(true);
    setResponse(null);
    const startTime = performance.now();

    try {
      const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
      const headerObj = {};
      headers.forEach(h => {
        if (h.key && h.key.trim()) {
          headerObj[h.key.trim()] = h.value;
        }
      });

      const options = {
        method,
        headers: headerObj
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(url, options);
      const endTime = performance.now();
      const durationMs = Math.round(endTime - startTime);

      const contentType = res.headers.get('content-type') || '';
      let bodyText = '';
      if (method !== 'HEAD') {
        bodyText = await res.text();
      }

      const respHeaders = {};
      res.headers.forEach((val, key) => {
        respHeaders[key] = val;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText || (res.status === 200 ? 'OK' : res.status === 206 ? 'Partial Content' : 'Response'),
        durationMs,
        headers: respHeaders,
        body: bodyText,
        contentType
      });
    } catch (err) {
      const endTime = performance.now();
      setResponse({
        status: 0,
        statusText: 'Network Error',
        durationMs: Math.round(endTime - startTime),
        headers: {},
        body: err.message,
        contentType: 'text/plain'
      });
    } finally {
      setLoading(false);
    }
  }

  // Generate cURL command
  function generateCurlCommand() {
    const fullUrl = `http://localhost:5000${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    let cmd = `curl -X ${method} "${fullUrl}"`;
    headers.forEach(h => {
      if (h.key && h.key.trim()) {
        cmd += ` \\\n  -H "${h.key.trim()}: ${h.value}"`;
      }
    });
    if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody) {
      const escapedBody = requestBody.replace(/"/g, '\\"');
      cmd += ` \\\n  --data "${escapedBody}"`;
    }
    return cmd;
  }

  // Generate Node.js Fetch Code
  function generateNodeJsCode() {
    const headerObj = {};
    headers.forEach(h => {
      if (h.key && h.key.trim()) headerObj[h.key.trim()] = h.value;
    });

    let code = `const res = await fetch('http://localhost:5000${endpoint}', {\n  method: '${method}',\n  headers: ${JSON.stringify(headerObj, null, 4)}`;
    if (['POST', 'PUT', 'PATCH'].includes(method) && requestBody) {
      code += `,\n  body: ${JSON.stringify(requestBody)}`;
    }
    code += `\n});\nconst data = await res.text();\nconsole.log(data);`;
    return code;
  }

  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-400" />
            <span>S3 REST API & cURL Test Laboratuvarı (Playground)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Postman veya terminal açmadan doğrudan tarayıcı içinden standart S3 REST ve XML API isteklerini test edin.
          </p>
        </div>

        <button 
          onClick={handleExecuteRequest}
          disabled={loading}
          className="btn-accent px-6 py-3 text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 shadow-xl shadow-indigo-500/20"
        >
          <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'İstek Gönderiliyor...' : 'İsteği Çalıştır (Send)'}</span>
        </button>
      </div>

      {/* Quick Presets Carousel */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Hazır S3 Şablonları & Örnek İstekler</label>
        <div className="flex flex-wrap gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-xl bg-[#090d18] border border-white/10 hover:border-indigo-500/50 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Request & Response Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Request Builder (7 cols) */}
        <div className="lg:col-span-6 space-y-5">
          
          <div className="glass-panel p-6 space-y-5 border border-white/[0.08] bg-[#070910]/80">
            <h2 className="font-extrabold text-white text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              <span>HTTP İstek Yapılandırması</span>
            </h2>

            {/* Method & URL Input */}
            <div className="flex rounded-xl overflow-hidden border border-slate-700 bg-[#05070d]">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={`px-4 py-3 font-bold text-xs focus:outline-none bg-transparent cursor-pointer border-r border-slate-700 ${
                  method === 'GET' ? 'text-emerald-400' :
                  method === 'POST' ? 'text-indigo-400' :
                  method === 'PUT' ? 'text-amber-400' :
                  method === 'DELETE' ? 'text-rose-400' : 'text-purple-400'
                }`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
              </select>

              <div className="flex-1 flex items-center px-3 text-slate-500 font-mono text-xs">
                <span>http://localhost:5000</span>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="flex-1 bg-transparent text-white px-1.5 py-2 font-mono text-xs focus:outline-none"
                  placeholder="/general-storage"
                />
              </div>
            </div>

            {/* Headers Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">HTTP Başlıkları (Headers)</label>
                <button onClick={addHeader} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">+ Başlık Ekle</button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {headers.map((h, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Header Adı (Örn: Range)"
                      value={h.key}
                      onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                      className="w-1/2 bg-[#05070d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="Değer"
                      value={h.value}
                      onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                      className="flex-1 bg-[#05070d] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => removeHeader(idx)}
                      className="px-2 text-slate-500 hover:text-rose-400 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Body (for POST/PUT) */}
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">İstek Gövdesi (Body Payload)</label>
                <textarea
                  rows="6"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder="Raw text, JSON veya XML payload girin..."
                  className="w-full bg-[#05070d] border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                ></textarea>
              </div>
            )}

          </div>

          {/* Generated Code Snippets */}
          <div className="glass-panel p-6 space-y-4 border border-white/[0.08] bg-[#070910]/80">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-400" />
                <span>Canlı cURL & Fetch Komutu</span>
              </h3>
              <div className="space-x-2">
                <button 
                  onClick={() => handleCopy(generateCurlCommand(), 'curl')}
                  className="btn-subtle text-xs py-1 px-2.5 text-indigo-300"
                >
                  {copiedCode === 'curl' ? <Check className="w-3 h-3 text-emerald-400 inline mr-1" /> : <Copy className="w-3 h-3 inline mr-1" />}
                  <span>cURL Kopyala</span>
                </button>
              </div>
            </div>

            <pre className="p-3 bg-[#05070d] border border-slate-800 rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto select-all">
              {generateCurlCommand()}
            </pre>
          </div>

        </div>

        {/* Right Column: Live Response Viewer (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          
          <div className="glass-panel p-6 space-y-4 border border-white/[0.08] bg-[#070910]/80 min-h-[500px] flex flex-col">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <h2 className="font-extrabold text-white text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Sunucu Yanıtı (Live Response)</span>
              </h2>

              {response && (
                <div className="flex items-center space-x-2.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                    response.status >= 200 && response.status < 300 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}>
                    {response.status} {response.statusText}
                  </span>

                  <span className="text-slate-400 text-xs font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>{response.durationMs} ms</span>
                  </span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3 py-20">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">İstek işleniyor ve yanıt bekleniyor...</span>
              </div>
            ) : response ? (
              <div className="space-y-4 flex-1 flex flex-col">
                
                {/* Response Headers Pill Accordion */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Yanıt Başlıkları (Response Headers)</label>
                  <div className="p-3 bg-[#05070d] border border-slate-800/80 rounded-xl max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1">
                    {Object.entries(response.headers).map(([k, v]) => (
                      <div key={k} className="flex">
                        <span className="text-indigo-400 w-44 shrink-0 truncate">{k}:</span>
                        <span className="text-slate-300 truncate">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Response Body */}
                <div className="flex-1 flex flex-col space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Yanıt Gövdesi (Response Body)</label>
                    <button 
                      onClick={() => handleCopy(response.body, 'body')}
                      className="text-xs text-indigo-400 hover:text-white"
                    >
                      {copiedCode === 'body' ? 'Kopyalandı!' : 'Gövdeyi Kopyala'}
                    </button>
                  </div>

                  <pre className="flex-1 p-4 bg-[#05070c] border border-slate-800 rounded-xl font-mono text-xs text-slate-200 overflow-auto max-h-[380px] leading-relaxed whitespace-pre-wrap">
                    {response.body || '(Boş Yanıt / Gövde Bulunmuyor)'}
                  </pre>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20 space-y-3">
                <Terminal className="w-12 h-12 text-slate-700" />
                <span className="text-xs text-center max-w-xs">
                  Yukarıdaki şablonlardan birini seçip <strong>"İsteği Çalıştır"</strong> butonuna basarak S3 API yanıtını canlı test edebilirsiniz.
                </span>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
