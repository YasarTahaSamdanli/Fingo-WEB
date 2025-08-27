// scripts/createAdminUser.js
// Bu script ilk admin kullanıcısını oluşturmak için kullanılır
// Sadece bir kez çalıştırılmalıdır

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdminUser() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('MongoDB\'ye bağlandı');
        
        const db = client.db();
        const usersCollection = db.collection('users');
        
        // Admin kullanıcısı var mı kontrol et
        const existingAdmin = await usersCollection.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin kullanıcısı zaten mevcut:', existingAdmin.email);
            return;
        }
        
        // Admin kullanıcısı oluştur
        const adminUser = {
            email: 'admin@fingo.com',
            password: await bcrypt.hash('admin123', 10),
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            phone: '',
            department: 'Yönetim',
            isActive: true,
            is2FAEnabled: false,
            twoFactorSecret: null,
            is2FAVerified: false,
            isVerified: true,
            createdAt: new Date(),
            createdBy: 'system'
        };
        
        const result = await usersCollection.insertOne(adminUser);
        console.log('Admin kullanıcısı oluşturuldu:', {
            id: result.insertedId,
            email: adminUser.email,
            role: adminUser.role
        });
        
        console.log('\nAdmin giriş bilgileri:');
        console.log('E-posta: admin@fingo.com');
        console.log('Şifre: admin123');
        console.log('\n⚠️  Bu bilgileri güvenli bir yerde saklayın ve giriş yaptıktan sonra şifreyi değiştirin!');
        
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await client.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

// Scripti çalıştır
if (require.main === module) {
    createAdminUser().then(() => {
        console.log('Script tamamlandı');
        process.exit(0);
    }).catch(error => {
        console.error('Script hatası:', error);
        process.exit(1);
    });
}

module.exports = { createAdminUser };
