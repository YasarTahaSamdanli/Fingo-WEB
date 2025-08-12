// app.js
require('dotenv').config(); // .env dosyasını yükler
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv'); // .env dosyasını kullanmak için
const { connectDB } = require('./db'); // db.js dosyasından connectDB fonksiyonunu al

// Rota modüllerini içe aktarıyoruz
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


dotenv.config(); // .env dosyasını yükle

const app = express();

console.log('Uygulama başlatılıyor...');

// ÖNEMLİ: CORS middleware'i, diğer tüm middleware'lerden ve rota tanımlamalarından ÖNCE gelmeli.
// Daha agresif CORS seçenekleri
const corsOptions = {
    origin: '*', // Tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen HTTP başlıkları
    credentials: true, // Eğer kimlik bilgileri (çerezler, yetkilendirme başlıkları) gönderilecekse bu gerekli
    optionsSuccessStatus: 200 // Bazı eski tarayıcılar 204 yerine 200 bekler
};

// Tüm isteklere CORS başlıklarını ekleyen custom middleware
// Bu middleware, herhangi bir isteğin (preflight dahil) başında çalışır ve CORS başlıklarını ekler.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); // Tüm kaynaklara izin ver
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true'); // Kimlik bilgileri için
    // Preflight isteği ise, hemen yanıt ver
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
console.log('Manuel CORS başlıkları ve OPTIONS preflight handler uygulandı.');

// express-cors middleware'ini de kullanalım, çakışma olursa bu daha spesifik olabilir
app.use(cors(corsOptions));
console.log('express-cors middleware uygulandı.');

// JSON istek gövdelerini ayrıştırmak için middleware
app.use(express.json({ limit: '50mb' }));
console.log('express.json middleware uygulandı.');


// Veritabanı bağlantısını başlat
connectDB(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB bağlantısı başarılı.');

        // Rotaları tanımla
        // Auth rotasını doğru prefix ile bağladık!
        app.use('/api/auth', authRoutes); // <<<< Login endpoint'i için doğru prefix
        app.use('/api', productRoutes);
        app.use('/api', salesRoutes);
        app.use('/api', financialSummaryRoutes);
        app.use('/api', supplierRoutes);
        app.use('/api', purchaseOrderRoutes);
        app.use('/api', twoFARoutes);
        app.use('/api', userRoutes);
        app.use('/api', transactionRoutes);
        app.use('/api', categoryRoutes);
        app.use('/api/reports', reportsRoutes);
        app.use('/api', customerRoutes);
        console.log('Tüm API rotaları /api altında kaydedildi.');

        // Tanımlanmamış API rotaları için 404 JSON yanıtı döndür
        app.use('/api/*', (req, res) => {
            console.warn(`404 API Rotası Bulunamadı: ${req.method} ${req.originalUrl}`);
            res.status(404).json({ message: 'API Rotası Bulunamadı.' });
        });

        // Diğer tüm tanımlanmamış rotalar için genel 404 yanıtı (HTML)
        app.use((req, res) => {
            console.warn(`404 Sayfa Bulunamadı: ${req.method} ${req.originalUrl}`);
            res.status(404).send('Sayfa Bulunamadı.');
        });

        // Sunucuyu başlat
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
        });
    })
    .catch(error => {
        console.error("Uygulama başlatılırken veya veritabanına bağlanırken kritik hata oluştu:", error);
        process.exit(1); // Hata durumunda uygulamayı sonlandır
    });
