import React, { useState, useEffect } from 'react';
import { KeyRound, Plus, Trash2, Copy, Check, Code, Terminal, FileCode } from 'lucide-react';

export default function ApiKeysTab() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const [snippetLang, setSnippetLang] = useState('curl');
  const [selectedBucket, setSelectedBucket] = useState('general-storage');
  const [selectedFile, setSelectedFile] = useState('test-image.jpg');

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      if (data.success) {
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName })
      });
      const data = await res.json();
      if (data.success) {
        setCreatedKey(data.key);
        fetchKeys();
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeleteKey(id) {
    if (!window.confirm('Bu API Key kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch (err) {
      alert(err.message);
    }
  }

  function copyText(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const accessKey = keys[0] ? keys[0].access_key : 'AKIAEXAMPLE123S3';
  const baseUrl = `${window.location.origin}`;

  const snippets = {
    curl: `# 1. Dosya Yükleme (Upload)
curl -X POST "${baseUrl}/api/storage/${selectedBucket}/upload" \\
  -F "file=@/yerel/dosya/yolu/${selectedFile}" \\
  -F "key=${selectedFile}"

# 2. Dosya İndirme (Download)
curl -O "${baseUrl}/api/storage/${selectedBucket}/${selectedFile}"`,

    javascript: `// Node.js veya Browser (Fetch API) ile dosya yükleme
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('key', '${selectedFile}');

const response = await fetch('${baseUrl}/api/storage/${selectedBucket}/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log('S3 Upload Result:', data);`,

    python: `# Python requests ile S3 motoruna dosya yükleme
import requests

url = "${baseUrl}/api/storage/${selectedBucket}/upload"

files = {
    'file': open('/yerel/dosya/yolu/${selectedFile}', 'rb')
}
data = {
    'key': '${selectedFile}'
}

response = requests.post(url, files=files, data=data)
print(response.json())`
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-400" />
            <span>API & SDK Erişim Anahtarları</span>
          </h1>
          <p className="text-sm text-slate-400">Harici istemcilerden S3 servisine programlamayla erişim anahtarları.</p>
        </div>

        <button onClick={() => setNewKeyModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Yeni Access Key Oluştur</span>
        </button>
      </div>

      {/* Keys Table */}
      <div className="glass-card p-6">
        <h2 className="font-bold text-white text-sm mb-4">Kayıtlı Anahtarlar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Anahtar İsmi</th>
                <th className="px-4 py-3 font-mono">Access Key ID</th>
                <th className="px-4 py-3">Oluşturulma</th>
                <th className="px-4 py-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-white">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-blue-400">{k.access_key}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(k.created_at).toLocaleDateString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right">
                    <button 
                      onClick={() => handleDeleteKey(k.id)}
                      className="btn-danger py-1 px-2 text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Snippet Generator */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-cyan-400" />
            <h2 className="font-bold text-white text-base">Programlama ve Kod Entegrasyon Kodları</h2>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setSnippetLang('curl')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                snippetLang === 'curl' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>cURL CLI</span>
            </button>
            <button
              onClick={() => setSnippetLang('javascript')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                snippetLang === 'javascript' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>JavaScript</span>
            </button>
            <button
              onClick={() => setSnippetLang('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                snippetLang === 'python' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Python</span>
            </button>
          </div>
        </div>

        <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-blue-200 overflow-x-auto">
          <button 
            onClick={() => copyText(snippets[snippetLang], 'snippet')}
            className="absolute top-3 right-3 btn-secondary py-1 px-2 text-[11px]"
          >
            {copiedKey === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'snippet' ? 'Kopyalandı' : 'Kopyala'}</span>
          </button>
          <pre>{snippets[snippetLang]}</pre>
        </div>
      </div>

      {/* Modal: Create Key */}
      {newKeyModal && (
        <div className="modal-backdrop">
          <div className="glass-card p-6 w-full max-w-md bg-slate-900 border border-slate-700">
            <h2 className="text-lg font-bold text-white mb-4">Yeni API Erişim Anahtarı Oluştur</h2>
            
            {createdKey ? (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div>
                    <span className="text-slate-400 block">Access Key ID:</span>
                    <span className="font-mono text-blue-400 font-bold">{createdKey.accessKey}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Secret Access Key (Lütfen Saklayın):</span>
                    <span className="font-mono text-amber-400 font-bold break-all">{createdKey.secretKey}</span>
                  </div>
                </div>
                <button onClick={() => { setNewKeyModal(false); setCreatedKey(null); }} className="btn-primary w-full">Tamam</button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Anahtar Adı</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Örn: Production App Key" 
                    value={keyName} 
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button type="button" onClick={() => setNewKeyModal(false)} className="btn-secondary">İptal</button>
                  <button type="submit" className="btn-primary">Oluştur</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
