// db.js
const { MongoClient } = require('mongodb');

let db; // Veritabanı bağlantı nesnesi

async function connectDB(uri) {
    if (db) {
        console.log("Veritabanı zaten bağlı.");
        return db;
    }
    try {
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('fingo_db'); // Bağlantıyı global 'db' değişkenine ata
        console.log("MongoDB'ye başarıyla bağlandı!");
        
        // Organizasyon sistemi için gerekli koleksiyonları oluştur
        await initializeCollections();
        
        return db;
    } catch (error) {
        console.error("MongoDB bağlantı hatası:", error);
        throw error; // Hatayı çağırana ilet
    }
}

// Organizasyon sistemi için gerekli koleksiyonları ve indeksleri oluştur
async function initializeCollections() {
    try {
        // Organizations koleksiyonu için indeks
        await db.collection('organizations').createIndex({ "organizationId": 1 }, { unique: true });
        await db.collection('organizations').createIndex({ "adminEmail": 1 }, { unique: true });
        
        // Users koleksiyonu için organizasyon indeksi
        await db.collection('users').createIndex({ "organizationId": 1 });
        await db.collection('users').createIndex({ "email": 1, "organizationId": 1 }, { unique: true });
        
        console.log("Organizasyon sistemi koleksiyonları başlatıldı.");
    } catch (error) {
        console.error("Koleksiyon başlatma hatası:", error);
    }
}

// db nesnesini ve connectDB fonksiyonunu dışa aktar
module.exports = {
    connectDB,
    getDb: () => {
        if (!db) {
            throw new Error('Veritabanı henüz başlatılmadı. connectDB() çağrılmalı.');
        }
        return db;
    }
};
