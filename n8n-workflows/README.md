# n8n Stok Uyarı Sistemi

Bu klasör, Fingo Web uygulaması için n8n kullanarak otomatik stok uyarı sistemi içerir.

## 📋 Özellikler

- **Otomatik Stok Kontrolü**: Her saat başı stok seviyelerini kontrol eder
- **Tedarikçi Bildirimi**: Düşük stok ürünleri için tedarikçilere otomatik e-posta gönderir
- **Akıllı Gruplandırma**: Aynı tedarikçiye ait ürünleri tek mesajda birleştirir
- **Log Kaydı**: Tüm bildirimler için detaylı log tutar

## 🚀 Kurulum

### 1. n8n Kurulumu

```bash
# n8n'i global olarak kur
npm install -g n8n

# n8n'i başlat
n8n start
```

### 2. İş Akışını İçe Aktar

1. n8n web arayüzüne git (genellikle http://localhost:5678)
2. **Import from File** seçeneğini kullan
3. `low-stock-alert.json` dosyasını seç ve içe aktar

### 3. API Endpoint'lerini Etkinleştir

Fingo Web uygulamasında stok uyarı route'ları zaten eklenmiş durumda:

- `GET /api/check-low-stock` - Düşük stok ürünlerini kontrol eder
- `POST /api/send-supplier-notification` - Tedarikçiye bildirim gönderir

## ⚙️ Yapılandırma

### Cron Trigger
- **Varsayılan**: Her saat başı kontrol
- **Özelleştirme**: n8n arayüzünden cron expression'ı değiştir

### API URL'leri
- **Geliştirme**: `http://localhost:3000`
- **Üretim**: Kendi sunucu URL'inizi girin

## 🔧 İş Akışı Detayları

### 1. Cron Trigger
- Her saat başı tetiklenir
- Zamanlamayı ihtiyacınıza göre ayarlayın

### 2. HTTP Request - Stok Kontrolü
- `GET /api/check-low-stock` endpoint'ini çağırır
- Düşük stok ürünlerini getirir

### 3. If Condition
- Düşük stok ürünü var mı kontrol eder
- Varsa işleme devam eder, yoksa log tutar

### 4. Code Node - Mesaj Hazırlama
- Ürünleri tedarikçi ID'sine göre gruplar
- Her tedarikçi için ayrı mesaj oluşturur

### 5. HTTP Request - Bildirim Gönderme
- `POST /api/send-supplier-notification` endpoint'ini çağırır
- Tedarikçiye e-posta gönderir

### 6. Log Nodes
- Başarılı işlemler ve hatalar için log tutar

## 📧 E-posta Şablonu

Tedarikçilere gönderilen e-posta şablonu:

```
Konu: Düşük Stok Uyarısı: [Ürün Adı]

Merhaba,

Aşağıdaki ürünlerin stok seviyeleri minimum değerin altına düşmüştür:

- [Ürün 1]: [Mevcut Stok] [Birim] (Min: [Min Stok] [Birim])
- [Ürün 2]: [Mevcut Stok] [Birim] (Min: [Min Stok] [Birim])

Lütfen stok yenileme işlemini başlatın.

Saygılarımızla,
[Organizasyon Adı]
```

## 🔍 Test Etme

### Manuel Test
```bash
# Düşük stok kontrolü
curl http://localhost:3000/api/check-low-stock

# Test bildirimi gönder
curl -X POST http://localhost:3000/api/send-supplier-notification \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "test-supplier-id",
    "products": [{"productName": "Test Ürün", "currentStock": 5, "minStock": 10, "unit": "adet"}],
    "message": "Test mesajı"
  }'
```

## 📊 Monitoring

### Log Dosyaları
- n8n log'ları: `~/.n8n/logs/`
- Fingo Web log'ları: Console çıktısı

### Stok Uyarı Geçmişi
```bash
curl http://localhost:3000/api/stock-alerts-history
```

## 🚨 Sorun Giderme

### Yaygın Hatalar

1. **API Bağlantı Hatası**
   - Fingo Web uygulamasının çalıştığından emin olun
   - Port 3000'in açık olduğunu kontrol edin

2. **E-posta Gönderim Hatası**
   - `.env` dosyasında e-posta ayarlarını kontrol edin
   - Gmail için uygulama şifresi kullandığınızdan emin olun

3. **Veritabanı Hatası**
   - MongoDB bağlantısını kontrol edin
   - Ürün ve tedarikçi verilerinin mevcut olduğunu doğrulayın

### Debug Modu
```bash
# n8n'i debug modunda başlat
DEBUG=n8n:* n8n start

# Fingo Web'i debug modunda başlat
NODE_ENV=development npm start
```

## 🔄 Güncelleme

### İş Akışı Güncelleme
1. n8n arayüzünden mevcut iş akışını düzenle
2. Export ederek JSON dosyasını güncelle
3. Değişiklikleri commit et

### API Güncelleme
1. `routes/stockAlerts.js` dosyasını düzenle
2. Sunucuyu yeniden başlat
3. Test et

## 📞 Destek

Sorun yaşadığınızda:
1. n8n log'larını kontrol edin
2. Fingo Web console çıktısını inceleyin
3. API endpoint'lerini test edin
4. Gerekirse debug modunda çalıştırın

## 🎯 Gelecek Özellikler

- [ ] WhatsApp entegrasyonu
- [ ] SMS bildirimi (Twilio)
- [ ] Slack/Discord entegrasyonu
- [ ] Gelişmiş raporlama
- [ ] Mobil push notification
- [ ] Tedarikçi portal entegrasyonu
