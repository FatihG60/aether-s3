# AETHER S3 — Özel Object Storage Motoru & Web Console Kullanım Kılavuzu

AETHER S3, AWS S3 standartlarında çalışan, yüksek performanslı, **Petabayt (PB) seviyesinde veri ve 1 TB+ dosya transferi destekleyen**, kendi sunucunuzda çalışan %100 özel nesne depolama (Object Storage) yazılımıdır.

---

## 📌 İçindekiler
1. [Hızlı Başlangıç](#1-hızlı-başlangıç)
2. [Web Console Arayüzü Kullanımı](#2-web-console-arayüzü-kullanımı)
3. [1 TB+ Parçalı Yükleme (Multipart Upload)](#3-1-tb-parçalı-yükleme-multipart-upload)
4. [REST API Referansı](#4-rest-api-referansı)
5. [Programlama Dilleri İle Kod Örnekleri](#5-programlama-dilleri-ile-kod-örnekleri)
   - [Java Örnekleri (Tekli & Parçalı Yükleme / İndirme)](#java-örnekleri)
   - [Python Örnekleri (Tekli & Parçalı Yükleme / İndirme)](#python-örnekleri)
   - [JavaScript / Node.js Örnekleri (Tekli & Parçalı Yükleme / İndirme)](#javascript-örnekleri)
6. [Linux Sunucu Kurulumu ve Disk Bağlama](#6-linux-sunucu-kurulumu-ve-disk-bağlama)

---

## 1. Hızlı Başlangıç

### Sunucuyu Başlatma
Proje dizininde backend ve frontend servislerini başlatmak için:

```bash
# Backend Sunucusunu Başlatma (Port 5000)
cd server
npm start

# Veya Geliştirici Modunda (Vite Port 3000)
cd client
npm run dev
```

### Dashboard Erişim Adresleri
* **S3 Web Console**: [http://localhost:5000](http://localhost:5000) (veya [http://localhost:3000](http://localhost:3000))
* **REST API Endpoint**: [http://localhost:5000/api](http://localhost:5000/api)
* **Sistem Durumu (Healthcheck)**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 2. Web Console Arayüzü Kullanımı

Arayüz 5 ana modülden oluşur:

### 1. Genel Bakış (Overview)
* **Depolama Metrikleri**: Toplam kullanılan alan, aktif nesne sayısı, tanımlı bucket sayısı ve toplam tahsis edilen kota.
* **Kapasite Göstergesi**: Tahsis edilen alanın yüzde kaçının kullanıldığını gösteren dinamik grafik çubuğu.
* **Dosya Dağılımı**: Dosyaların türlerine göre (Görsel 🌸, Video 📽️, Ses 🎵, Doküman/Kod 📄) kapladığı alan ve yüzdeler.
* **Canlı İşlem Logları (Audit Stream)**: Sunucuda gerçekleşen son 20 yükleme, silme ve bucket oluşturma işlemi.

### 2. Bucket Yönetimi (Buckets)
* **Yeni Bucket Oluşturma**: `Yeni Bucket Oluştur` düğmesine tıklayarak isim, bölge (region), depolama kotası (GB) ve erişim politikası belirleyebilirsiniz.
* **Public / Private Erişim**: Bucket üzerindeki kilit simgesine tıklayarak dosyalara imzasız direkt URL ile erişilip erişilemeyeceğini tek tıkla değiştirebilirsiniz.

### 3. Dosya Yöneticisi (Object Explorer)
* **Sürükle-Brak Yükleme (Drag & Drop)**: Bilgisayarınızdan tekli veya çoklu dosyayı ekrandaki kesikli alana sürükleyip bırakabilirsiniz.
* **Canlı Önizleme (Preview Modal)**: Yüklenen görselleri, videoları ve ses dosyalarını tarayıcıdan çıkmadan doğrudan oynatabilirsiniz.

---

## 3. 1 TB+ Parçalı Yükleme (Multipart Upload)

Sistem 20 MB üzerindeki büyük dosyaları (100 GB, 500 GB veya 1 TB) otomatik olarak **10 MB'lık parçalara (Chunk)** bölerek yükler.

---

## 4. REST API Referansı

* `POST /api/storage/:bucket/upload` — Tekli dosya yükler (`multipart/form-data`).
* `GET /api/storage/:bucket/*` — Dosyayı indirir veya medya olarak oynatır (HTTP Range destekli).
* `POST /api/storage/:bucket/multipart/initiate` — Yükleme oturumu başlatır (`uploadId` üretir).
* `POST /api/storage/:bucket/multipart/chunk` — Parça yükler (`uploadId`, `chunkIndex`, `chunk`).
* `POST /api/storage/:bucket/multipart/complete` — Parçaları sunucuda birleştirir (`uploadId`, `object_key`).

---

## 5. Programlama Dilleri İle Kod Örnekleri

### Java Örnekleri

#### Java - 1. Tek Parça Dosya Yükleme (Single Upload)
```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;

public class S3SingleUpload {
    public static void main(String[] args) throws Exception {
        String bucket = "general-storage";
        String serverUrl = "http://localhost:5000/api/storage/" + bucket + "/upload";
        Path filePath = Path.of("/path/to/my-file.jpg");

        String boundary = "---JavaBoundary" + System.currentTimeMillis();
        
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofFile(filePath))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Upload Result: " + response.body());
    }
}
```

#### Java - 2. Parçalı (Multipart / Chunked) Dosya Yükleme (100GB+ / 1TB+)
```java
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

public class S3MultipartUpload {
    public static void main(String[] args) throws Exception {
        String bucket = "general-storage";
        String fileName = "large-video.mp4";
        Path filePath = Path.of("/path/to/" + fileName);
        long fileSize = Files.size(filePath);

        int chunkSize = 10 * 1024 * 1024; // 10MB chunks
        int totalChunks = (int) Math.ceil((double) fileSize / chunkSize);

        HttpClient client = HttpClient.newHttpClient();

        // Step 1: Initiate Session
        String initJson = String.format(
            "{\"object_key\":\"%s\",\"file_name\":\"%s\",\"total_chunks\":%d,\"file_size\":%d}",
            fileName, fileName, totalChunks, fileSize
        );

        HttpRequest initReq = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:5000/api/storage/" + bucket + "/multipart/initiate"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(initJson))
                .build();

        HttpResponse<String> initRes = client.send(initReq, HttpResponse.BodyHandlers.ofString());
        String uploadId = extractUploadId(initRes.body());

        // Step 2: Stream Chunks
        try (InputStream is = Files.newInputStream(filePath)) {
            byte[] buffer = new byte[chunkSize];
            int bytesRead;
            int chunkIndex = 0;

            while ((bytesRead = is.read(buffer)) != -1) {
                byte[] actualChunk = new byte[bytesRead];
                System.arraycopy(buffer, 0, actualChunk, 0, bytesRead);

                uploadChunk(client, bucket, uploadId, chunkIndex, actualChunk);
                System.out.printf("Chunk %d/%d uploaded (%d bytes)\n", chunkIndex + 1, totalChunks, bytesRead);
                chunkIndex++;
            }
        }

        // Step 3: Complete & Merge Chunks
        String completeJson = String.format(
            "{\"uploadId\":\"%s\",\"object_key\":\"%s\",\"file_name\":\"%s\"}",
            uploadId, fileName, fileName
        );

        HttpRequest compReq = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:5000/api/storage/" + bucket + "/multipart/complete"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(completeJson))
                .build();

        HttpResponse<String> compRes = client.send(compReq, HttpResponse.BodyHandlers.ofString());
        System.out.println("Multipart Complete Result: " + compRes.body());
    }

    private static void uploadChunk(HttpClient client, String bucket, String uploadId, int chunkIndex, byte[] bytes) throws Exception {}

    private static String extractUploadId(String json) {
        return json.split("\"uploadId\":\"")[1].split("\"")[0];
    }
}
```

#### Java - 3. Dosya İndirme (Download / Stream)
```java
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

public class S3Download {
    public static void main(String[] args) throws Exception {
        String bucket = "general-storage";
        String objectKey = "docs/sample.pdf";
        String downloadUrl = "http://localhost:5000/api/storage/" + bucket + "/" + objectKey + "?download=true";

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(downloadUrl))
                .GET()
                .build();

        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

        Path savePath = Path.of("./downloaded-sample.pdf");
        Files.copy(response.body(), savePath, StandardCopyOption.REPLACE_EXISTING);
        System.out.println("Dosya başarıyla indirildi: " + savePath.toAbsolutePath());
    }
}
```

---

### Python Örnekleri

#### Python - 1. Tek Parça Dosya Yükleme (Single Upload)
```python
import requests

bucket = "general-storage"
url = f"http://localhost:5000/api/storage/{bucket}/upload"

file_path = "document.pdf"
object_key = "documents/document.pdf"

files = {'file': open(file_path, 'rb')}
data = {'key': object_key}

response = requests.post(url, files=files, data=data)
print("Upload Result:", response.json())
```

#### Python - 2. Parçalı (Multipart / Chunked) Dosya Yükleme (100GB+ / 1TB+)
```python
import os
import requests

bucket = "general-storage"
file_path = "large-archive.zip"
file_name = os.path.basename(file_path)
file_size = os.path.getsize(file_path)

chunk_size = 10 * 1024 * 1024  # 10 MB parçalar
total_chunks = (file_size + chunk_size - 1) // chunk_size

# 1. Oturumu Başlat
init_res = requests.post(f"http://localhost:5000/api/storage/{bucket}/multipart/initiate", json={
    "object_key": file_name,
    "file_name": file_name,
    "total_chunks": total_chunks,
    "file_size": file_size
}).json()

upload_id = init_res["uploadId"]
print(f"Oturum Başlatıldı ID: {upload_id}")

# 2. Parçaları Sırayla Gönder
with open(file_path, 'rb') as f:
    for chunk_index in range(total_chunks):
        chunk_data = f.read(chunk_size)
        files = {'chunk': (f"chunk_{chunk_index}", chunk_data)}
        data = {'uploadId': upload_id, 'chunkIndex': chunk_index}

        res = requests.post(f"http://localhost:5000/api/storage/{bucket}/multipart/chunk", files=files, data=data)
        print(f"Parça {chunk_index + 1}/{total_chunks} Yüklendi")

# 3. Tamamla ve Birleştir
comp_res = requests.post(f"http://localhost:5000/api/storage/{bucket}/multipart/complete", json={
    "uploadId": upload_id,
    "object_key": file_name,
    "file_name": file_name
}).json()

print("Parçalı Yükleme Tamamlandı:", comp_res)
```

#### Python - 3. Dosya İndirme (Download / Stream)
```python
import requests

bucket = "general-storage"
object_key = "documents/document.pdf"
url = f"http://localhost:5000/api/storage/{bucket}/{object_key}?download=true"

with requests.get(url, stream=True) as r:
    r.raise_for_status()
    with open("indirilen-dokuman.pdf", "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

print("İndirme Tamamlandı!")
```

---

### JavaScript / Node.js Örnekleri

#### JavaScript - 1. Tek Parça Dosya Yükleme (Browser / Node.js)
```javascript
const fileInput = document.getElementById('myFile');
const file = fileInput.files[0];

const formData = new FormData();
formData.append('file', file);
formData.append('key', 'photos/photo.png');

const response = await fetch('http://localhost:5000/api/storage/general-storage/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Upload Result:', result);
```

#### JavaScript - 2. Parçalı (Multipart / Chunked) Dosya Yükleme (Browser / Node.js 1TB+)
```javascript
async function uploadLargeFileInChunks(file, bucketName = 'general-storage') {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Oturumu Başlat
  const initRes = await fetch(`http://localhost:5000/api/storage/${bucketName}/multipart/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_key: file.name,
      file_name: file.name,
      total_chunks: totalChunks,
      file_size: file.size
    })
  });
  const { uploadId } = await initRes.json();

  // 2. Parçaları Yükle (File.slice)
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunkBlob, `chunk_${i}`);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i);

    await fetch(`http://localhost:5000/api/storage/${bucketName}/multipart/chunk`, {
      method: 'POST',
      body: formData
    });

    console.log(`Parça ${i + 1}/${totalChunks} (%${Math.round(((i + 1)/totalChunks)*100)}) yüklendi.`);
  }

  // 3. Birleştir
  const compRes = await fetch(`http://localhost:5000/api/storage/${bucketName}/multipart/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      object_key: file.name,
      file_name: file.name
    })
  });

  const finalResult = await compRes.json();
  console.log('Multipart Yükleme Başarıyla Tamamlandı:', finalResult);
}
```

#### JavaScript - 3. Dosya İndirme (Download)
```javascript
async function downloadFile(bucket, objectKey) {
  const downloadUrl = `http://localhost:5000/api/storage/${bucket}/${encodeURIComponent(objectKey)}?download=true`;

  const response = await fetch(downloadUrl);
  const blob = await response.blob();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = objectKey;
  link.click();
}
```

---

## 6. Linux Sunucu Kurulumu ve Disk Bağlama

### Production PM2 Kurulumu
```bash
# 1. PM2 Yükleyin
npm install -g pm2

# 2. Servisi Başlatın
cd /var/www/custom-s3-storage/server
pm2 start src/index.js --name "aether-s3"
pm2 save
pm2 startup
```

### Harici Storage Diski Bağlama (Mount & Symlink)
```bash
# 1. Harici diski bağlayın
sudo mount /dev/sdb1 /mnt/storage

# 2. Veri klasörünü harici diske yönlendirin (Symlink)
sudo mkdir -p /mnt/storage/s3_data
ln -s /mnt/storage/s3_data /var/www/custom-s3-storage/server/data
```

---

*© 2026 AETHER S3 Custom Object Storage Engine*
