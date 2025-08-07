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

// Middleware'ler
app.use(express.json({ limit: '50mb' })); // Gelen JSON istek gövdelerini ayrıştırmak için
app.use(cors({ // CORS ayarları
    origin: '*', // Geliştirme ortamında tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen HTTP başlıkları
}));
console.log('CORS middleware uygulandı.');

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
        // Bu middleware, sadece /api ile başlayan ancak yukarıdaki rotalara uymayan istekleri yakalar.
        app.use('/api/*', (req, res) => {
            console.warn(`404 API Rotası Bulunamadı: ${req.method} ${req.originalUrl}`);
            res.status(404).json({ message: 'API Rotası Bulunamadı.' });
        });

        // Diğer tüm tanımlanmamış rotalar için genel 404 yanıtı (HTML)
        // Bu, frontend'den API dışı bir URL'e yanlışlıkla gidilirse devreye girer.
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

