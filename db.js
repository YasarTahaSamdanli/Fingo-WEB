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
        return db;
    } catch (error) {
        console.error("MongoDB bağlantı hatası:", error);
        throw error; // Hatayı çağırana ilet
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
