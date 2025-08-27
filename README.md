# Fingo Web - Organizasyon Bazlı Stok Yönetim Sistemi

Fingo Web, her kullanıcının kendi organizasyonunda çalışabileceği, çok kullanıcılı bir stok yönetim sistemidir.

## 🚀 Özellikler

### Organizasyon Sistemi
- **Her yeni kullanıcı kendi organizasyonunda admin olur**
- **Organizasyonlar birbirinden tamamen izole edilmiştir**
- **Her admin kendi organizasyonunda çalışanlar ekleyebilir**
- **Çalışanlar farklı rollerle (admin, manager, cashier, staff) görev yapabilir**

### Kullanıcı Rolleri
- **Admin**: Organizasyon sahibi, tüm yetkilere sahip
- **Manager**: Yönetici, çoğu yetkiye sahip
- **Cashier**: Kasiyer, satış ve temel işlemler
- **Staff**: Çalışan, sınırlı yetkiler

### Ana Modüller
- **Stok Yönetimi**: Ürün ekleme, düzenleme, silme
- **Satış Yönetimi**: Müşteri işlemleri, satış kayıtları
- **Tedarik Yönetimi**: Tedarikçi işlemleri, sipariş yönetimi
- **Raporlama**: Detaylı raporlar ve analizler
- **Kullanıcı Yönetimi**: Organizasyon içi kullanıcı yönetimi

## 🛠️ Kurulum

### Gereksinimler
- Node.js (v14 veya üzeri)
- MongoDB
- npm veya yarn

### Adımlar
1. **Projeyi klonlayın**
   ```bash
   git clone <repository-url>
   cd fingo-web
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Çevre değişkenlerini ayarlayın**
   ```bash
   cp .env.example .env
   # .env dosyasını düzenleyin
   ```

4. **Veritabanını başlatın**
   ```bash
   npm run db:start
   ```

5. **Uygulamayı çalıştırın**
   ```bash
   npm start
   ```

## 🔧 Organizasyon Sistemi Kurulumu

### Yeni Kullanıcı Kaydı
1. `/auth.html` sayfasından kayıt olun
2. Organizasyon adınızı girin
3. E-posta ve şifrenizi belirleyin
4. Otomatik olarak kendi organizasyonunuzda admin olursunuz

### Mevcut Kullanıcıları Geçirme
Eğer mevcut kullanıcılarınız varsa, organizasyon sistemine geçirmek için:

```bash
node scripts/migrateToOrganizationSystem.js
```

## 📁 Proje Yapısı

```
fingo-web/
├── app.js                 # Ana uygulama dosyası
├── db.js                  # Veritabanı bağlantısı
├── routes/                # API rotaları
│   ├── auth.js           # Kimlik doğrulama
│   ├── userManagement.js # Kullanıcı yönetimi
│   ├── products.js       # Ürün yönetimi
│   └── ...
├── middleware/            # Middleware'ler
│   ├── authMiddleware.js # Kimlik doğrulama
│   └── roleMiddleware.js # Rol kontrolü
├── scripts/               # Yardımcı scriptler
└── ...
```

## 🔐 Güvenlik

- **JWT tabanlı kimlik doğrulama**
- **Organizasyon bazlı veri izolasyonu**
- **Rol bazlı yetkilendirme**
- **2FA desteği**
- **Şifre hash'leme**

## 🌐 API Endpoints

### Kimlik Doğrulama
- `POST /api/register` - Yeni kullanıcı kaydı
- `POST /api/login` - Kullanıcı girişi
- `GET /api/verify-email` - E-posta doğrulama

### Kullanıcı Yönetimi
- `GET /api/users` - Organizasyon kullanıcılarını listele
- `POST /api/users` - Yeni kullanıcı ekle
- `PUT /api/users/:id` - Kullanıcı güncelle
- `DELETE /api/users/:id` - Kullanıcı sil

### Organizasyon
- `GET /api/organization` - Organizasyon bilgilerini getir

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/AmazingFeature`)
3. Commit yapın (`git commit -m 'Add some AmazingFeature'`)
4. Push yapın (`git push origin feature/AmazingFeature`)
5. Pull Request oluşturun

## 📞 İletişim

Proje hakkında sorularınız için issue açabilir veya geliştirici ile iletişime geçebilirsiniz.


