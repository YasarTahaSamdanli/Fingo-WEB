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
const customerRoutes = require('./routes/customerRoutes');


const app = express();

console.log('Uygulama başlatılıyor...');

// ÖNEMLİ: CORS middleware'i, diğer tüm middleware'lerden ve rota tanımlamalarından ÖNCE gelmeli.
// Daha agresif CORS seçenekleri
const corsOptions = {
    origin: '*', // Tüm kaynaklardan gelen isteklere izin ver
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // İzin verilen HTTP metotları
    allowedHeaders: ['Content-Type', 'Authorization'], // İzin verilen başlıklar
    credentials: true // Kimlik bilgileriyle (örneğin çerezler, HTTP kimlik doğrulaması) gelen isteklere izin ver
};

app.use(cors(corsOptions));
app.use(express.json()); // JSON body parsing için

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

// Debug: Express tarafından kaydedilen tüm rotaları listele
app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
        console.log(`[ROUTE-DEBUG] Yol: ${r.route.path}, Metot: ${Object.keys(r.route.methods)[0].toUpperCase()}`);
    } else if (r.name === 'router' && r.handle.stack) {
        r.handle.stack.forEach(function(hr) {
            if (hr.route && hr.route.path) {
                const fullPath = r.regexp.source.replace(/\\\//g, '/').replace(/\/\(\?\:\/\.\*\)/g, '').slice(0, -1) + hr.route.path;
                console.log(`[ROUTE-DEBUG] Alt Yol: ${fullPath}, Metot: ${Object.keys(hr.route.methods)[0].toUpperCase()}`);
            }
        });
    }
});
console.log('[ROUTE-DEBUG] Rota listeleme tamamlandı.');


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

// Veritabanı bağlantısını başlat ve sonra sunucuyu dinlemeye başla
// BURADAKİ DÜZELTME: connectDB'ye MONGODB_URI'yi parametre olarak geçiyoruz
connectDB(process.env.MONGODB_URI).then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Sunucu ${PORT} portunda çalışıyor.`);
        console.log(`Veritabanı bağlantısı başarılı.`);
    });
}).catch(err => {
    console.error('Veritabanı bağlantı hatası:', err);
    process.exit(1); // Uygulamayı sonlandır
});
