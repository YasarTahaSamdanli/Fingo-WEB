// app.js
// .env dosyasındaki ortam değişkenlerini yükler
require('dotenv').config();
const express = require('express');
const cors = require('cors'); // CORS (Cross-Origin Resource Sharing) middleware'i
const { connectDB } = require('./db'); // Veritabanı bağlantı fonksiyonu

// Rota modüllerini içeri aktarıyoruz
// Bu yolların, projenizin 'routes' klasöründeki dosya isimleriyle eşleştiğinden emin olun.
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const financialSummaryRoutes = require('./routes/financialSummary');
const supplierRoutes = require('./routes/suppliers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const twoFARoutes = require('./routes/2fa');
const userRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const reportsRoutes = require('./routes/reports');
const customerRoutes = require('./routes/customerRoutes');


const app = express();

console.log('Uygulama başlatılıyor...');

// CORS Ayarları
// ÖNEMLİ: CORS middleware'leri diğer tüm middleware'lerden ve rota tanımlamalarından ÖNCE gelmeli.
// Bu ayarlar, farklı domainlerden (örn. frontend uygulamanızdan) gelen isteklere izin verir.
const corsOptions = {
    origin: '*', // Tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen HTTP başlıkları
    credentials: true, // Eğer kimlik bilgileri (çerezler, yetkilendirme başlıkları) gönderilecekse bu gerekli
    optionsSuccessStatus: 200 // Bazı eski tarayıcılar (IE11 gibi) 204 yerine 200 bekler
};

// Tüm isteklere CORS başlıklarını ekleyen custom middleware.
// Bu, preflight (OPTIONS) isteklerini de doğru şekilde yanıtlamamızı sağlar.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Tüm kaynaklara izin ver
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true'); // Kimlik bilgileri için

    // Eğer gelen istek bir OPTIONS (preflight) isteği ise, hemen yanıt ver
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next(); // Diğer middleware'lere ve rota işleyicilere geç
});
console.log('Manuel CORS başlıkları ve OPTIONS preflight handler uygulandı.');

// Express'in kendi CORS middleware'ini de kullanıyoruz, bu daha kapsamlı ayarlar için.
app.use(cors(corsOptions));
console.log('express-cors middleware uygulandı.');

// JSON formatındaki istek gövdelerini ayrıştırmak için middleware
// 'limit' ayarı, büyük JSON payload'larını (örn. toplu ürün ekleme) kabul etmek için artırılabilir.
app.use(express.json({ limit: '50mb' }));
console.log('express.json middleware uygulandı.');


// Veritabanı bağlantısını başlat
// process.env.MONGODB_URI, .env dosyanızda tanımlı olan MongoDB bağlantı URI'niz olmalı.
connectDB(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB bağlantısı başarılı.');

        // API Rotalarını tanımla ve uygulamaya bağla
        // Her bir rota modülü, kendi içinde belirli endpoint'leri (örn. /login, /products) tanımlar.
        // Burada, bu endpoint'lere bir ön ek (prefix) ekleyerek tam URL'lerini oluşturuyoruz.

        // Kimlik doğrulama rotaları (örn: /api/auth/login, /api/auth/register)
        app.use('/api/auth', authRoutes);
        // Diğer genel API rotaları (örn: /api/products, /api/sales)
        app.use('/api', productRoutes);
        app.use('/api', salesRoutes);
        app.use('/api', financialSummaryRoutes);
        app.use('/api', supplierRoutes);
        app.use('/api', purchaseOrderRoutes);
        app.use('/api', twoFARoutes);
        app.use('/api', userRoutes);
        app.use('/api', transactionRoutes);
        app.use('/api', categoryRoutes);
        // Rapor rotaları için farklı bir prefix (örn: /api/reports/sales-summary)
        app.use('/api/reports', reportsRoutes);
        app.use('/api', customerRoutes);
        console.log('Tüm API rotaları /api altında kaydedildi.');

        // Tanımlanmamış API rotaları için 404 JSON yanıtı döndüren middleware
        // Bu, /api/ ile başlayan ancak eşleşmeyen tüm istekleri yakalar.
        app.use('/api/*', (req, res) => {
            console.warn(`404 API Rotası Bulunamadı: ${req.method} ${req.originalUrl}`);
            res.status(404).json({ message: 'API Rotası Bulunamadı.' });
        });

        // Diğer tüm tanımlanmamış rotalar için genel 404 yanıtı (HTML veya basit metin)
        // Bu, /api/ ile başlamayan ve eşleşmeyen tüm diğer istekleri yakalar.
        app.use((req, res) => {
            console.warn(`404 Sayfa Bulunamadı: ${req.method} ${req.originalUrl}`);
            res.status(404).send('Sayfa Bulunamadı.');
        });

        // Sunucuyu başlat
        // PORT ortam değişkeninden okunur veya varsayılan olarak 3000 kullanılır.
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
            console.log(`Fingo Web API yayında!`);
        });
    })
    .catch(error => {
        // Veritabanı bağlantısında veya uygulama başlatmada kritik bir hata olursa
        console.error("Uygulama başlatılırken veya veritabanına bağlanırken kritik hata oluştu:", error);
        process.exit(1); // Uygulamayı sonlandır
    });
