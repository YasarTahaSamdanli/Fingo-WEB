// scripts/updateExistingUsers.js
// Bu script mevcut kullanıcıları yeni rol sistemi ile güncellemek için kullanılır
// Sadece bir kez çalıştırılmalıdır

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function updateExistingUsers() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('MongoDB\'ye bağlandı');
        
        const db = client.db();
        const usersCollection = db.collection('users');
        
        // Mevcut kullanıcıları kontrol et
        const existingUsers = await usersCollection.find({}).toArray();
        console.log(`${existingUsers.length} kullanıcı bulundu`);
        
        // Her kullanıcıyı güncelle
        for (const user of existingUsers) {
            const updateData = {};
            let needsUpdate = false;
            
            // Eksik alanları ekle
            if (!user.hasOwnProperty('firstName')) {
                updateData.firstName = '';
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('lastName')) {
                updateData.lastName = '';
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('role')) {
                // İlk kullanıcıyı admin yap, diğerlerini staff yap
                updateData.role = existingUsers.indexOf(user) === 0 ? 'admin' : 'staff';
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('phone')) {
                updateData.phone = '';
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('department')) {
                updateData.department = '';
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('isActive')) {
                updateData.isActive = true;
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('createdAt')) {
                updateData.createdAt = new Date();
                needsUpdate = true;
            }
            
            if (!user.hasOwnProperty('isVerified')) {
                updateData.isVerified = true; // Mevcut kullanıcıları doğrulanmış kabul et
                needsUpdate = true;
            }
            
            // Güncelleme gerekliyse yap
            if (needsUpdate) {
                updateData.updatedAt = new Date();
                updateData.updatedBy = 'system';
                
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: updateData }
                );
                
                console.log(`Kullanıcı güncellendi: ${user.email}`);
            } else {
                console.log(`Kullanıcı zaten güncel: ${user.email}`);
            }
        }
        
        console.log('Tüm kullanıcılar güncellendi');
        
        // Güncellenmiş kullanıcıları listele
        const updatedUsers = await usersCollection.find({}).toArray();
        console.log('\nGüncellenmiş kullanıcılar:');
        updatedUsers.forEach(user => {
            console.log(`- ${user.email} (${user.role}) - ${user.isActive ? 'Aktif' : 'Pasif'}`);
        });
        
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await client.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

// Scripti çalıştır
if (require.main === module) {
    updateExistingUsers().then(() => {
        console.log('Script tamamlandı');
        process.exit(0);
    }).catch(error => {
        console.error('Script hatası:', error);
        process.exit(1);
    });
}

module.exports = { updateExistingUsers };
