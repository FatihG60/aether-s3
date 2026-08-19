import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Code, 
  Terminal, 
  FileCode,
  Layers,
  Sparkles,
  Server,
  Cloud,
  CheckCircle2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

const API_BASE = typeof window !== 'undefined' && window.location.port === '3000' 
  ? 'http://localhost:5000' 
  : '';

export default function ApiKeysTab() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const [snippetLang, setSnippetLang] = useState('awscli');
  const [selectedBucket, setSelectedBucket] = useState('general-storage');
  const [selectedFile, setSelectedFile] = useState('example-document.pdf');

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/keys`);
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
      const res = await fetch(`${API_BASE}/api/keys`, {
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
      await fetch(`${API_BASE}/api/keys/${id}`, { method: 'DELETE' });
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

  const activeAccessKey = keys[0] ? keys[0].access_key : 'AKIA98A6F0024BS3';
  const endpointUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5000` : 'http://localhost:5000';

  const snippets = {
    awscli: `# 1. AWS CLI Konfigürasyonu (Tek Seferlik)
aws configure set aws_access_key_id ${activeAccessKey}
aws configure set aws_secret_access_key aether_secret_key_here
aws configure set default.region eu-central-1

# 2. Bucket'taki Dosyaları Listeleme
aws s3 ls s3://${selectedBucket} --endpoint-url ${endpointUrl}

# 3. Dosya Yükleme (Upload)
aws s3 cp ${selectedFile} s3://${selectedBucket}/${selectedFile} --endpoint-url ${endpointUrl}

# 4. Dosya İndirme (Download)
aws s3 cp s3://${selectedBucket}/${selectedFile} ./${selectedFile} --endpoint-url ${endpointUrl}

# 5. Tüm Klasörü Senkronize Etme (Sync)
aws s3 sync ./my-data s3://${selectedBucket}/backup/ --endpoint-url ${endpointUrl}`,

    boto3: `# Python Boto3 ile AWS S3 Entegrasyonu
import boto3

s3 = boto3.client(
    's3',
    endpoint_url='${endpointUrl}',
    aws_access_key_id='${activeAccessKey}',
    aws_secret_access_key='YOUR_SECRET_KEY',
    region_name='eu-central-1'
)

# 1. Dosya Yükleme
s3.upload_file('${selectedFile}', '${selectedBucket}', 'user_101/${selectedFile}')
print("Dosya başarıyla yüklendi!")

# 2. Dosyaları Listeleme
response = s3.list_objects_v2(Bucket='${selectedBucket}')
for item in response.get('Contents', []):
    print(f"Key: {item['Key']} | Boyut: {item['Size']} bytes")

# 3. Dosya İndirme
s3.download_file('${selectedBucket}', 'user_101/${selectedFile}', 'downloaded_${selectedFile}')`,

    nodesdk: `// Node.js AWS SDK v3 (@aws-sdk/client-s3)
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const s3 = new S3Client({
  endpoint: '${endpointUrl}',
  region: 'eu-central-1',
  credentials: {
    accessKeyId: '${activeAccessKey}',
    secretAccessKey: 'YOUR_SECRET_KEY'
  },
  forcePathStyle: true // Standart path-style S3 bağlantısı
});

// 1. Dosya Yükleme
const fileBuffer = fs.readFileSync('./${selectedFile}');
await s3.send(new PutObjectCommand({
  Bucket: '${selectedBucket}',
  Key: 'uploads/${selectedFile}',
  Body: fileBuffer
}));

// 2. Dosya Listeleme
const listRes = await s3.send(new ListObjectsV2Command({
  Bucket: '${selectedBucket}'
}));
console.log('Dosyalar:', listRes.Contents);`,

    rclone: `# Rclone Konfigürasyonu (~/.config/rclone/rclone.conf)
[aether-s3]
type = s3
provider = Other
env_auth = false
access_key_id = ${activeAccessKey}
secret_access_key = YOUR_SECRET_KEY
endpoint = ${endpointUrl}
acl = public-read

# Rclone ile dosya kopyalama
rclone copy ./my-large-archive.zip aether-s3:${selectedBucket}/archives/
rclone ls aether-s3:${selectedBucket}`,

    curl: `# Standart REST API / cURL ile Dosya Yükleme
curl -X POST "${endpointUrl}/api/storage/${selectedBucket}/upload" \\
  -F "file=@/yerel/dosya/yolu/${selectedFile}" \\
  -F "user_id=user_101" \\
  -F "structured_path=true"

# Standart S3 Binary Stream ile Doğrudan Yükleme (PUT)
curl -X PUT "${endpointUrl}/${selectedBucket}/${selectedFile}" \\
  -T "/yerel/dosya/yolu/${selectedFile}" \\
  -H "Content-Type: application/octet-stream"`
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            <span>API & AWS S3 Standart SDK Erişimi</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            AWS CLI, Python Boto3, Node.js AWS SDK, Cyberduck ve Rclone ile doğrudan S3 protokolüyle bağlanın.
          </p>
        </div>

        <button onClick={() => setNewKeyModal(true)} className="btn-accent">
          <Plus className="w-4 h-4" />
          <span>Yeni Access Key Oluştur</span>
        </button>
      </div>

      {/* S3 Standard Protocol Compatibility Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-[#0e121e] border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-white text-base">AWS S3 REST & XML Protokol Uyumluluğu Aktif</h3>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                %100 Uyumlu
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              S3 Endpoint URL: <strong className="font-mono text-indigo-300">{endpointUrl}</strong> • Path-Style: <strong className="font-mono text-emerald-400">Enabled</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={() => copyText(endpointUrl, 'endpoint')} 
            className="btn-subtle text-xs flex items-center gap-1.5"
          >
            {copiedKey === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Endpoint Kopyala</span>
          </button>
        </div>
      </div>

      {/* Keys Table */}
      <div className="glass-panel overflow-hidden border border-white/[0.06] bg-[#070910]/70">
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="font-extrabold text-white text-base">Kayıtlı S3 Erişim Anahtarları</h2>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-[#090b14] border border-white/10 px-2.5 py-1 rounded-full">
            {keys.length} Aktif Anahtar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#05070c] text-slate-400 uppercase tracking-wider font-bold border-b border-white/[0.08] text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Anahtar Tanımı</th>
                <th className="px-5 py-3.5 font-mono">Access Key ID</th>
                <th className="px-5 py-3.5">Oluşturulma Tarihi</th>
                <th className="px-5 py-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4 font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    <span>{k.name}</span>
                  </td>
                  <td className="px-5 py-4 font-mono text-indigo-300 font-bold">
                    <span className="bg-[#090d18] px-2.5 py-1 rounded-lg border border-indigo-500/20">{k.access_key}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                    {new Date(k.created_at).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button 
                      onClick={() => copyText(k.access_key, k.id)}
                      className="btn-subtle p-2 text-xs"
                      title="Access Key Kopyala"
                    >
                      {copiedKey === k.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button 
                      onClick={() => handleDeleteKey(k.id)}
                      className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/25 transition"
                      title="Anahtarı Sil"
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

      {/* Official S3 Code Snippet Generator */}
      <div className="glass-panel p-6 space-y-4 border border-indigo-500/20 bg-gradient-to-br from-[#0c0f18] via-[#101422] to-[#141226]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-base">Hazır SDK & CLI Bağlantı Kodları</h2>
              <p className="text-xs text-slate-400">AWS resmi araçları ile sisteminize anında bağlanın</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'awscli', label: 'AWS CLI (Terminal)', icon: Terminal },
              { id: 'boto3', label: 'Python (boto3)', icon: Code },
              { id: 'nodesdk', label: 'Node.js (AWS SDK)', icon: FileCode },
              { id: 'rclone', label: 'Rclone / Cyberduck', icon: Cloud },
              { id: 'curl', label: 'cURL / REST', icon: Terminal }
            ].map(tab => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSnippetLang(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                    snippetLang === tab.id 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'bg-[#080b13] text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative bg-[#05070d] border border-slate-800/80 rounded-2xl p-5 font-mono text-xs text-indigo-200 overflow-x-auto shadow-inner">
          <button 
            onClick={() => copyText(snippets[snippetLang], 'snippet')}
            className="absolute top-4 right-4 btn-subtle py-1.5 px-3 text-xs bg-[#0c101d] border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5"
          >
            {copiedKey === 'snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'snippet' ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
          </button>
          <pre className="leading-relaxed pr-24">{snippets[snippetLang]}</pre>
        </div>
      </div>

      {/* Modal: Create Key */}
      {newKeyModal && (
        <div className="modal-backdrop">
          <div className="glass-panel p-8 w-full max-w-md bg-[#080b13] border border-slate-700/80 shadow-2xl relative space-y-4">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <span>Yeni Access Key Oluştur</span>
            </h2>
            
            {createdKey ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-[#05070d] border border-emerald-500/30 rounded-xl text-xs space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider">Access Key ID:</span>
                    <span className="font-mono text-indigo-300 font-bold text-sm select-all">{createdKey.accessKey}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-bold uppercase tracking-wider">Secret Access Key (Lütfen Saklayın):</span>
                    <span className="font-mono text-amber-300 font-bold break-all text-sm select-all">{createdKey.secretKey}</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setNewKeyModal(false); setCreatedKey(null); }} 
                  className="btn-accent w-full justify-center"
                >
                  Tamam, Sakladım
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Anahtar Tanımı</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Örn: Production Boto3 Server" 
                    value={keyName} 
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full bg-[#05070d] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono transition"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button type="button" onClick={() => setNewKeyModal(false)} className="btn-subtle">İptal</button>
                  <button type="submit" className="btn-accent">Oluştur</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
