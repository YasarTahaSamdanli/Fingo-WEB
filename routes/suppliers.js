// routes/suppliers.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Tedarikçi Ekleme Rotası
router.post('/suppliers', authenticateToken, async (req, res) => {
    const { 
        name, 
        contactPerson, 
        email, 
        phone, 
        address, 
        website,
        category,
        city,
        country,
        taxNumber,
        paymentTerms,
        deliveryTime,
        rating,
        contractRenewal,
        paymentDue,
        notes 
    } = req.body;
    const userId = req.user.userId;

    if (!name || !contactPerson) {
        return res.status(400).json({ message: 'Tedarikçi adı ve ilgili kişi adı gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const newSupplier = {
            userId: userId,
            name,
            contactPerson,
            email: email || null,
            phone: phone || null,
            address: address || null,
            website: website || null,
            category: category || null,
            city: city || null,
            country: country || 'Türkiye',
            taxNumber: taxNumber || null,
            paymentTerms: paymentTerms || null,
            deliveryTime: deliveryTime ? parseInt(deliveryTime) : null,
            rating: rating ? parseInt(rating) : 5,
            status: 'active', // Varsayılan durum
            contractRenewal: contractRenewal || null,
            paymentDue: paymentDue || null,
            notes: notes || null,
            orderCount: 0, // Varsayılan sipariş sayısı
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('suppliers').insertOne(newSupplier);
        res.status(201).json({ message: 'Tedarikçi başarıyla eklendi!', supplier: newSupplier });
    } catch (error) {
        console.error('Tedarikçi ekleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Tedarikçileri Getirme Rotası
router.get('/suppliers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const suppliers = await db.collection('suppliers').find({ userId: userId }).toArray();
        res.status(200).json(suppliers);
    } catch (error) {
        console.error('Tedarikçileri çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tek Tedarikçi Getirme Rotası (ID ile)
router.get('/suppliers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const supplier = await db.collection('suppliers').findOne({ 
            _id: new ObjectId(id), 
            userId: userId 
        });

        if (!supplier) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı veya bu kullanıcıya ait değil.' });
        }

        res.status(200).json(supplier);
    } catch (error) {
        console.error('Tedarikçi getirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçi Güncelleme Rotası
router.put('/suppliers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { 
        name, 
        contactPerson, 
        email, 
        phone, 
        address, 
        website,
        category,
        city,
        country,
        taxNumber,
        paymentTerms,
        deliveryTime,
        rating,
        status,
        contractRenewal,
        paymentDue,
        notes 
    } = req.body;
    const userId = req.user.userId;

    if (!name || !contactPerson) {
        return res.status(400).json({ message: 'Tedarikçi adı ve ilgili kişi adı gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const updateData = {
            name,
            contactPerson,
            email: email || null,
            phone: phone || null,
            address: address || null,
            website: website || null,
            category: category || null,
            city: city || null,
            country: country || 'Türkiye',
            taxNumber: taxNumber || null,
            paymentTerms: paymentTerms || null,
            deliveryTime: deliveryTime ? parseInt(deliveryTime) : null,
            rating: rating ? parseInt(rating) : 5,
            status: status || 'active',
            contractRenewal: contractRenewal || null,
            paymentDue: paymentDue || null,
            notes: notes || null,
            updatedAt: new Date()
        };

        const result = await db.collection('suppliers').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Tedarikçi başarıyla güncellendi!' });
    } catch (error) {
        console.error('Tedarikçi güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Toplu Tedarikçi Güncelleme Rotası
router.put('/suppliers/bulk/update', authenticateToken, async (req, res) => {
    const { supplierIds, updateData } = req.body;
    const userId = req.user.userId;

    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ message: 'Geçerli tedarikçi ID\'leri gerekli.' });
    }

    try {
        const db = getDb();
        const objectIds = supplierIds.map(id => new ObjectId(id));
        
        const result = await db.collection('suppliers').updateMany(
            { _id: { $in: objectIds }, userId: userId },
            { 
                $set: {
                    ...updateData,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Güncellenecek tedarikçi bulunamadı.' });
        }

        res.status(200).json({ 
            message: `${result.modifiedCount} tedarikçi başarıyla güncellendi!` 
        });
    } catch (error) {
        console.error('Toplu güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçi Silme Rotası
router.delete('/suppliers/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('suppliers').deleteOne({ _id: new ObjectId(id), userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Tedarikçi başarıyla silindi!' });
    } catch (error) {
        console.error('Tedarikçi silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Toplu Tedarikçi Silme Rotası
router.delete('/suppliers/bulk/delete', authenticateToken, verify2FA, async (req, res) => {
    const { supplierIds } = req.body;
    const userId = req.user.userId;

    if (!supplierIds || !Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ message: 'Geçerli tedarikçi ID\'leri gerekli.' });
    }

    try {
        const db = getDb();
        const objectIds = supplierIds.map(id => new ObjectId(id));
        
        const result = await db.collection('suppliers').deleteMany({
            _id: { $in: objectIds }, 
            userId: userId 
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Silinecek tedarikçi bulunamadı.' });
        }

        res.status(200).json({ 
            message: `${result.deletedCount} tedarikçi başarıyla silindi!` 
        });
    } catch (error) {
        console.error('Toplu silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçi İstatistikleri Getirme Rotası
router.get('/suppliers/stats/summary', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        
        // Toplam tedarikçi sayısı
        const totalSuppliers = await db.collection('suppliers').countDocuments({ userId: userId });
        
        // Aktif tedarikçi sayısı
        const activeSuppliers = await db.collection('suppliers').countDocuments({ 
            userId: userId, 
            status: 'active' 
        });
        
        // Ortalama değerlendirme
        const avgRatingResult = await db.collection('suppliers').aggregate([
            { $match: { userId: userId, rating: { $exists: true, $ne: null } } },
            { $group: { _id: null, avgRating: { $avg: '$rating' } } }
        ]).toArray();
        
        const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating : 0;
        
        // Kategori dağılımı
        const categoryDistribution = await db.collection('suppliers').aggregate([
            { $match: { userId: userId, category: { $exists: true, $ne: null } } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        res.status(200).json({
            totalSuppliers,
            activeSuppliers,
            avgRating: Math.round(avgRating * 10) / 10,
            categoryDistribution,
            totalOrders: 0 // Şimdilik 0, ileride sipariş sistemi eklendiğinde güncellenecek
        });
    } catch (error) {
        console.error('İstatistik getirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
