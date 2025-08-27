// scripts/migrateToOrganizationSystem.js
// Bu script mevcut kullanıcıları organizasyon sistemine geçirir

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function migrateToOrganizationSystem() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        console.log('MongoDB\'ye bağlandı');
        
        const db = client.db('fingo_db');
        
        // Mevcut kullanıcıları kontrol et
        const existingUsers = await db.collection('users').find({}).toArray();
        console.log(`${existingUsers.length} kullanıcı bulundu`);
        
        if (existingUsers.length === 0) {
            console.log('Hiç kullanıcı bulunamadı. Migration gerekli değil.');
            return;
        }
        
        // Her kullanıcı için organizasyon oluştur
        for (const user of existingUsers) {
            console.log(`Kullanıcı işleniyor: ${user.email}`);
            
            // Eğer kullanıcının zaten organizasyon ID'si varsa atla
            if (user.organizationId) {
                console.log(`Kullanıcı ${user.email} zaten organizasyon sisteminde`);
                continue;
            }
            
            // Organizasyon ID oluştur
            const organizationId = 'org_' + require('crypto').randomBytes(8).toString('hex');
            
            // Organizasyon oluştur
            const organization = {
                organizationId: organizationId,
                name: `${user.email.split('@')[0]} Organizasyonu`,
                adminEmail: user.email,
                createdAt: new Date(),
                isActive: true
            };
            
            await db.collection('organizations').insertOne(organization);
            console.log(`Organizasyon oluşturuldu: ${organization.name}`);
            
            // Kullanıcıyı güncelle
            const updateData = {
                organizationId: organizationId,
                isOrganizationAdmin: user.role === 'admin' // Eğer admin ise organizasyon admini yap
            };
            
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: updateData }
            );
            
            console.log(`Kullanıcı ${user.email} organizasyon ${organizationId} ile güncellendi`);
        }
        
        // Mevcut ürünleri organizasyon sistemine geçir
        const existingProducts = await db.collection('products').find({}).toArray();
        console.log(`${existingProducts.length} ürün bulundu`);
        
        for (const product of existingProducts) {
            if (product.organizationId) {
                console.log(`Ürün ${product.name} zaten organizasyon sisteminde`);
                continue;
            }
            
            // Ürünün sahibi olan kullanıcıyı bul
            const productOwner = await db.collection('users').findOne({ _id: product.userId });
            
            if (productOwner && productOwner.organizationId) {
                // Ürünü organizasyon sistemine ekle
                await db.collection('products').updateOne(
                    { _id: product._id },
                    { $set: { organizationId: productOwner.organizationId } }
                );
                console.log(`Ürün ${product.name} organizasyon ${productOwner.organizationId} ile güncellendi`);
            } else {
                console.log(`Ürün ${product.name} için organizasyon bulunamadı, siliniyor`);
                await db.collection('products').deleteOne({ _id: product._id });
            }
        }
        
        console.log('Migration tamamlandı!');
        
    } catch (error) {
        console.error('Migration hatası:', error);
    } finally {
        await client.close();
    }
}

// Script çalıştırılırsa migration'ı başlat
if (require.main === module) {
    migrateToOrganizationSystem().then(() => {
        console.log('Migration script tamamlandı');
        process.exit(0);
    }).catch((error) => {
        console.error('Migration script hatası:', error);
        process.exit(1);
    });
}

module.exports = { migrateToOrganizationSystem };
