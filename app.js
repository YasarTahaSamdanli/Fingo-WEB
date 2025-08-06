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
const reportsRoutes = require('./routes/reports'); // Yeni eklenen: Raporlar rotasını dahil et

const app = express();

// Middleware'ler
app.use(express.json({ limit: '50mb' })); // Gelen JSON istek gövdelerini ayrıştırmak için
app.use(cors({ // CORS ayarları
    origin: '*', // Geliştirme ortamında tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen HTTP başlıkları
}));

// Statik dosyaları sunma (public klasöründeki HTML, CSS, JS dosyaları)
app.use(express.static('public'));

// Veritabanı bağlantısını başlat
connectDB(process.env.MONGODB_URI)
    .then(() => {
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
        app.use('/api/reports', reportsRoutes); // Yeni eklenen: Raporlar rotalarını /api/reports altında kullan

        // Sunucuyu başlat
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
        });
    })
    .catch(error => {
        console.error("Uygulama başlatılırken hata oluştu:", error);
        process.exit(1); // Hata durumunda uygulamayı sonlandır
    });
