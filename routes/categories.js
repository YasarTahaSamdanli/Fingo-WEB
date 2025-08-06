// routes/categories.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni kategori ekleme rotası
router.post('/categories', authenticateToken, async (req, res) => {
    const { name, type } = req.body;
    const userId = req.user.userId;

    if (!name || !type) {
        return res.status(400).json({ message: 'Kategori adı ve tipi gerekli.' });
    }

    try {
        const db = getDb();
        // Aynı kullanıcı için aynı isimde kategori olup olmadığını kontrol et
        const existingCategory = await db.collection('categories').findOne({ name: name, userId: new ObjectId(userId) });
        if (existingCategory) {
            return res.status(409).json({ message: 'Bu isimde bir kategori zaten mevcut.' });
        }

        const newCategory = {
            userId: new ObjectId(userId),
            name,
            type, // 'Gelir', 'Gider' veya 'Genel'
            createdAt: new Date()
        };
        const result = await db.collection('categories').insertOne(newCategory);
        res.status(201).json({ message: 'Kategori başarıyla eklendi.', categoryId: result.insertedId });
    } catch (error) {
        console.error('Kategori eklerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm kategorileri getirme rotası
router.get('/categories', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        const categories = await db.collection('categories').find({ userId: new ObjectId(userId) }).sort({ name: 1 }).toArray();
        res.status(200).json(categories);
    } catch (error) {
        console.error('Kategorileri çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kategori güncelleme rotası
router.put('/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, type } = req.body;
    const userId = req.user.userId;

    if (!name || !type) {
        return res.status(400).json({ message: 'Kategori adı ve tipi gerekli.' });
    }

    try {
        const db = getDb();
        // Güncellenecek kategori hariç aynı isimde başka bir kategori olup olmadığını kontrol et
        const existingCategory = await db.collection('categories').findOne({
            name: name,
            userId: new ObjectId(userId),
            _id: { $ne: new ObjectId(id) } // Kendi ID'si hariç
        });
        if (existingCategory) {
            return res.status(409).json({ message: 'Bu isimde bir kategori zaten mevcut.' });
        }

        const result = await db.collection('categories').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) },
            { $set: { name, type, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Kategori bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'Kategori başarıyla güncellendi.' });
    } catch (error) {
        console.error('Kategori güncellerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kategori silme rotası
router.delete('/categories/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        // Bu kategoriye bağlı işlemler olup olmadığını kontrol et
        const categoryDoc = await db.collection('categories').findOne({_id: new ObjectId(id), userId: new ObjectId(userId)});
        if (!categoryDoc) {
            return res.status(404).json({ message: 'Kategori bulunamadı veya yetkiniz yok.' });
        }
        const transactionsUsingCategory = await db.collection('transactions').countDocuments({ category: categoryDoc.name, userId: new ObjectId(userId) });

        if (transactionsUsingCategory > 0) {
            return res.status(400).json({ message: 'Bu kategoriye bağlı işlemler olduğu için silinemez.' });
        }

        const result = await db.collection('categories').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            // Bu durum yukarıdaki categoryDoc kontrolü nedeniyle pek olası değil, ama yine de bırakalım.
            return res.status(404).json({ message: 'Kategori bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'Kategori başarıyla silindi.' });
    } catch (error) {
        console.error('Kategori silerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
