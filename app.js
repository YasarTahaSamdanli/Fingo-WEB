// app.js
require('dotenv').config(); // .env dosyasını yükler
const express = require('express');
const cors = require('cors');

// Yeni oluşturduğumuz modülleri içe aktarıyoruz
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

const app = express();

console.log('Uygulama başlatılıyor...');

// ÖNEMLİ: CORS middleware'i, diğer tüm middleware'lerden ve rota tanımlamalarından ÖNCE gelmeli.
// CORS seçeneklerini daha açık belirtelim
const corsOptions = {
    origin: '*', // Tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen HTTP başlıkları
    credentials: true, // Eğer kimlik bilgileri (çerezler, yetkilendirme başlıkları) gönderilecekse bu gerekli
    optionsSuccessStatus: 200 // Bazı eski tarayıcılar 204 yerine 200 bekler
};

app.use(cors(corsOptions));
console.log('CORS middleware uygulandı.');

// Preflight (OPTIONS) isteklerini manuel olarak ele al
// Bu, özellikle karmaşık CORS senaryolarında (custom headers, non-simple methods) yardımcı olabilir.
app.options('*', cors(corsOptions));
console.log('OPTIONS preflight handler uygulandı.');

// JSON istek gövdelerini ayrıştırmak için middleware
app.use(express.json({ limit: '50mb' }));
console.log('express.json middleware uygulandı.');


// Veritabanı bağlantısını başlat
connectDB(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB bağlantısı başarılı.');

        // Rotaları tanımla
        // Her rota modülünü kendi prefix'i altında kullan
        app.use('/api', authRoutes);
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
