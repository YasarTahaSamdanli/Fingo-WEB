// routes/products.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Ürün Ekleme Rotası
router.post('/products', authenticateToken, async (req, res) => {
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, weightOrVolumeUnit } = req.body;
    const userId = req.user.userId;

    if (!name || !category || price === undefined || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Ürün adı, kategori, fiyat, miktar ve birim gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const newProduct = {
            userId: userId,
            name,
            category,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            unit,
            barcode: barcode || null,
            weightOrVolumePerUnit: weightOrVolumePerUnit ? parseFloat(weightOrVolumePerUnit) : null,
            weightOrVolumeUnit: weightOrVolumeUnit || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('products').insertOne(newProduct);
        res.status(201).json({ message: 'Ürün başarıyla eklendi!', product: newProduct });
    } catch (error) {
        console.error('Ürün ekleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Ürünleri Getirme Rotası
router.get('/products', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const products = await db.collection('products').find({ userId: userId }).toArray();
        res.status(200).json(products);
    } catch (error) {
        console.error('Ürünleri çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Ürün Güncelleme Rotası
router.put('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, weightOrVolumeUnit } = req.body;
    const userId = req.user.userId;

    if (!name || !category || price === undefined || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Ürün adı, kategori, fiyat, miktar ve birim gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: {
                name,
                category,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                unit,
                barcode: barcode || null,
                weightOrVolumePerUnit: weightOrVolumePerUnit ? parseFloat(weightOrVolumePerUnit) : null,
                weightOrVolumeUnit: weightOrVolumeUnit || null,
                updatedAt: new Date()
            }}
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Ürün başarıyla güncellendi!' });
    } catch (error) {
        console.error('Ürün güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Ürün Stok Güncelleme Rotası (Sadece miktar güncelleme için)
router.put('/products/stock/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { newQuantity } = req.body;
    const userId = req.user.userId;

    if (newQuantity === undefined || isNaN(newQuantity)) {
        return res.status(400).json({ message: 'Geçerli bir miktar değeri gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: { quantity: parseInt(newQuantity), updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Stok başarıyla güncellendi!', newQuantity: newQuantity });
    } catch (error) {
        console.error('Stok güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


// Ürün Silme Rotası
router.delete('/products/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('products').deleteOne({ _id: new ObjectId(id), userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Ürün başarıyla silindi!' });
    } catch (error) {
        console.error('Ürün silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
