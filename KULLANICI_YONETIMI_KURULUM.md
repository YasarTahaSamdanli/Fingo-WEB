# 🚀 Fingo Kullanıcı Yönetimi Sistemi Kurulum Rehberi

Bu rehber, Fingo uygulamasına kullanıcı yönetimi sistemini nasıl kuracağınızı adım adım açıklar.

## 📋 Sistem Gereksinimleri

- Node.js (v14 veya üzeri)
- MongoDB veritabanı
- npm veya yarn paket yöneticisi

## 🔧 Kurulum Adımları

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

### 2. Çevre Değişkenlerini Ayarlayın

`.env` dosyasında aşağıdaki değişkenlerin tanımlı olduğundan emin olun:

```env
MONGODB_URI=mongodb://localhost:27017/fingo
JWT_SECRET=your_jwt_secret_here
```

### 3. Mevcut Kullanıcıları Güncelleyin

Eğer sistemde mevcut kullanıcılar varsa, onları yeni rol sistemi ile güncelleyin:

```bash
npm run update-users
```

Bu script:
- Mevcut kullanıcılara varsayılan rol atar
- Eksik alanları ekler
- İlk kullanıcıyı otomatik olarak admin yapar

### 4. Admin Yetkisi Verme

**Otomatik Admin:**
- Sistemde hiç kullanıcı yoksa, ilk kayıt olan otomatik admin olur
- Bu özellik `routes/auth.js` dosyasında tanımlıdır

**Manuel Admin Yapma:**
```bash
# Mevcut kullanıcıyı admin yap
npm run make-admin <email>

# Örnek:
npm run make-admin admin@fingo.com
```

### 5. İlk Admin Kullanıcısını Oluşturun

```bash
npm run create-admin
```

Bu script:
- `admin@fingo.com` e-posta adresi ile admin kullanıcısı oluşturur
- Varsayılan şifre: `admin123`
- Sadece bir kez çalıştırılmalıdır

### 6. Uygulamayı Başlatın

```bash
npm start
```

## 👥 Kullanıcı Rolleri ve Yetkileri

### 🔴 Admin (Patron)
- **Tüm yetkilere sahip**
- Kullanıcı oluşturma, düzenleme, silme
- Şifre sıfırlama
- Sistem ayarları

### 🔵 Manager (Yönetici)
- **Çoğu yetkiye sahip**
- Kullanıcı düzenleme (admin hariç)
- Ürün, satış, tedarikçi yönetimi
- Rapor görüntüleme

### 🟢 Cashier (Kasiyer)
- **Satış ve temel işlemler**
- Ürün görüntüleme
- Satış oluşturma
- Müşteri bilgilerini görüntüleme

### ⚪ Staff (Çalışan)
- **Sınırlı yetkiler**
- Ürün görüntüleme
- Satış geçmişi görüntüleme
- Müşteri bilgilerini görüntüleme

## 🔐 Güvenlik Özellikleri

- **JWT Token**: Güvenli oturum yönetimi
- **Rol Bazlı Erişim**: Her kullanıcı sadece yetkili olduğu işlemleri yapabilir
- **Şifre Hashleme**: bcrypt ile güvenli şifre saklama
- **2FA Desteği**: İki faktörlü kimlik doğrulama

## 📱 Kullanım

### Kullanıcı Yönetimi Sayfasına Erişim

1. Ana sayfada sidebar'dan "Kullanıcı Yönetimi" linkine tıklayın
2. Sadece admin ve manager rolündeki kullanıcılar erişebilir

### Yeni Kullanıcı Oluşturma

1. "Yeni Kullanıcı" butonuna tıklayın
2. Gerekli bilgileri doldurun
3. Rol seçin
4. "Oluştur" butonuna tıklayın

### Kullanıcı Düzenleme

1. Kullanıcı listesinde düzenleme ikonuna tıklayın
2. Bilgileri güncelleyin
3. "Güncelle" butonuna tıklayın

### Şifre Sıfırlama

1. Kullanıcı listesinde anahtar ikonuna tıklayın
2. Yeni şifreyi girin
3. "Şifreyi Sıfırla" butonuna tıklayın

## ⚠️ Önemli Notlar

- **Admin kullanıcısı oluşturduktan sonra varsayılan şifreyi değiştirin**
- **Scriptleri sadece bir kez çalıştırın**
- **Üretim ortamında güçlü JWT_SECRET kullanın**
- **Düzenli olarak kullanıcı yetkilerini gözden geçirin**

## 🆘 Sorun Giderme

### Kullanıcı Giriş Yapamıyor
- E-posta doğrulaması yapılmış mı kontrol edin
- Kullanıcı aktif mi kontrol edin
- Rol atanmış mı kontrol edin

### Yetki Hatası
- Kullanıcının rolünü kontrol edin
- Gerekli yetkilerin atandığından emin olun

### Veritabanı Bağlantı Hatası
- MongoDB URI'yi kontrol edin
- Veritabanı çalışıyor mu kontrol edin

## 📞 Destek

Herhangi bir sorun yaşarsanız:
- GitHub Issues sayfasını kullanın
- Geliştirici ile iletişime geçin

---

**🎉 Tebrikler! Kullanıcı yönetimi sistemi başarıyla kuruldu.**
