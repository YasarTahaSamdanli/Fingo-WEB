// scripts/addRoleToUser.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function addRoleToUser(email) {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('MongoDB\'ye bağlandı');

        const db = client.db();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ email: email });

        if (!user) {
            console.log(`❌ Kullanıcı bulunamadı: ${email}`);
            return;
        }

        console.log(`👤 Kullanıcı bulundu: ${user.email}`);
        console.log(`📋 Mevcut bilgiler:`, {
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            isVerified: user.isVerified
        });

        // Role yoksa ekle
        if (!user.role) {
            const result = await usersCollection.updateOne(
                { email: email },
                {
                    $set: {
                        role: 'staff', // Varsayılan rol
                        updatedAt: new Date()
                    }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`✅ ${email} kullanıcısına 'staff' rolü eklendi!`);
            } else {
                console.log(`⚠️  ${email} kullanıcısı güncellenemedi.`);
            }
        } else {
            console.log(`ℹ️  ${email} kullanıcısının zaten rolü var: ${user.role}`);
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await client.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

const email = process.argv[2];

if (!email) {
    console.log('❌ Kullanım: node scripts/addRoleToUser.js <email>');
    console.log('Örnek: node scripts/addRoleToUser.js yasarsamdanli1@gmail.com');
    process.exit(1);
}

addRoleToUser(email);
