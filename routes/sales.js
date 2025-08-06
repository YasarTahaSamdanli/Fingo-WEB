    // routes/sales.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Satış Ekleme Rotası
router.post('/sales', authenticateToken, async (req, res) => {
    const { saleItems, customerName, saleDate } = req.body;
    const userId = req.user.userId;

    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) {
        return res.status(400).json({ message: 'Satış öğeleri boş olamaz.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        let totalAmount = 0;
        let processedSaleItems = [];

        for (const item of saleItems) {
            const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId), userId: userId });

            if (!product) {
                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
            }
            if (product.quantity < item.quantity) {
                throw new Error(`Yetersiz stok: ${product.name}. Mevcut: ${product.quantity}, İstenen: ${item.quantity}`);
            }

            // Stoktan düş
            await db.collection('products').updateOne(
                { _id: new ObjectId(item.productId), userId: userId },
                { $inc: { quantity: -item.quantity }, $set: { updatedAt: new Date() } }
            );

            const itemTotalPrice = product.price * item.quantity;
            totalAmount += itemTotalPrice;

            processedSaleItems.push({
                productId: product._id.toString(),
                productName: product.name,
                unitPrice: product.price,
                quantity: item.quantity,
                unit: product.unit,
                category: product.category,
                totalPrice: itemTotalPrice
            });
        }

        const newSale = {
            userId: userId,
            saleItems: processedSaleItems,
            customerName: customerName || 'Anonim',
            totalAmount: totalAmount,
            saleDate: new Date(saleDate), // Frontend'den gelen tarihi kullan
            createdAt: new Date()
        };

        await db.collection('sales').insertOne(newSale);
        res.status(201).json({ message: 'Satış başarıyla kaydedildi!', sale: newSale });

    } catch (error) {
        console.error('Satış kaydetme hatası:', error);
        // Hata durumunda stokları geri alma (işlemi geri alma - opsiyonel ama iyi bir uygulama)
        // Bu kısım daha karmaşık bir "işlem yönetimi" gerektirebilir.
        res.status(500).json({ message: error.message || 'Satış işlemi sırasında bir hata oluştu.' });
    }
});

// Tüm Satışları Getirme Rotası (Filtreleme ile)
router.get('/sales', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { customerName, startDate, endDate } = req.query;

    // 2FA doğrulaması yapılmış mı kontrol et (raporlama için gerekli)
    if (!req.user.is2FAVerified) {
        return res.status(403).json({ message: 'Satış geçmişini görüntülemek için 2FA doğrulaması gerekli.' });
    }

    let query = { userId: userId };

    if (customerName) {
        query.customerName = { $regex: customerName, $options: 'i' }; // Case-insensitive arama
    }

    if (startDate || endDate) {
        query.saleDate = {};
        if (startDate) {
            query.saleDate.$gte = new Date(startDate);
        }
        if (endDate) {
            query.saleDate.$lte = new Date(endDate);
        }
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const sales = await db.collection('sales').find(query).sort({ saleDate: -1 }).toArray();
        res.status(200).json(sales);
    } catch (error) {
        console.error('Satışları çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
