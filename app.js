// app.js
require('dotenv').config(); // .env dosyasını yükler
const express = require('express');
const cors = require('cors');

const { connectDB } = require('./db');

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


const app = express();

console.log('Uygulama başlatılıyor...');

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// API rotalarını kullan
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

connectDB(process.env.MONGODB_URI).then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Sunucu ${PORT} portunda çalışıyor.`);
        console.log(`Veritabanı bağlantısı başarılı.`);
    });
}).catch(err => {
    console.error('Veritabanı bağlantı hatası:', err);
    process.exit(1);
});