// scripts/makeUserAdmin.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function makeUserAdmin(email) {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('MongoDB\'ye bağlandı');

        const db = client.db();
        const usersCollection = db.collection('users');

        // Kullanıcıyı bul
        const user = await usersCollection.findOne({ email: email });
        
        if (!user) {
            console.log(`❌ Kullanıcı bulunamadı: ${email}`);
            return;
        }

        console.log(`👤 Kullanıcı bulundu: ${user.email} (Mevcut rol: ${user.role})`);

        // Kullanıcıyı admin yap
        const result = await usersCollection.updateOne(
            { email: email },
            { 
                $set: { 
                    role: 'admin',
                    updatedAt: new Date()
                } 
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`✅ ${email} başarıyla admin yapıldı!`);
        } else {
            console.log(`⚠️  ${email} zaten admin veya güncelleme yapılamadı.`);
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await client.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

// Komut satırından email al
const email = process.argv[2];

if (!email) {
    console.log('❌ Kullanım: node scripts/makeUserAdmin.js <email>');
    console.log('Örnek: node scripts/makeUserAdmin.js admin@fingo.com');
    process.exit(1);
}

makeUserAdmin(email);
