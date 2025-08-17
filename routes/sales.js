// routes/sales.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni Satış Ekleme Rotası
router.post('/sales', authenticateToken, async (req, res) => {
    const { saleItems, customerId, customerName, saleDate, paymentMethod, cashPaid, cardPaid } = req.body;
    const userId = req.user.userId;

    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) {
        return res.status(400).json({ message: 'Satış öğeleri boş olamaz.' });
    }

    try {
        const db = getDb();
        let totalAmount = 0;
        let processedSaleItems = [];

        // Her bir satış öğesi için stok düşme işlemi
        for (const item of saleItems) {
            const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId), userId: userId });

            if (!product) {
                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
            }
            if (product.quantity < item.quantity) {
                throw new Error(`Yetersiz stok: ${product.name}. Mevcut: ${product.quantity}, İstenen: ${item.quantity}`);
            }

            // Stoktan düşme işlemi
            await db.collection('products').updateOne(
                { _id: new ObjectId(item.productId), userId: userId },
                { $inc: { quantity: -item.quantity }, $set: { updatedAt: new Date() } }
            );

            // İşlenmiş satış öğelerini hazırla
            processedSaleItems.push({
                productId: new ObjectId(item.productId),
                productName: product.name,
                category: product.category,
                unitPrice: product.price,
                quantity: item.quantity,
                unit: product.unit,
                totalPrice: item.quantity * product.price
            });
            totalAmount += item.quantity * product.price;
        }

        // Satış kaydını oluştur
        const newSale = {
            userId: userId,
            saleItems: processedSaleItems,
            customerName: customerName,
            customerId: customerId ? new ObjectId(customerId) : null,
            totalAmount: totalAmount,
            saleDate: new Date(saleDate),
            paymentMethod: paymentMethod,
            cashPaid: parseFloat(cashPaid || 0),
            cardPaid: parseFloat(cardPaid || 0),
            creditDebt: totalAmount - (parseFloat(cashPaid || 0) + parseFloat(cardPaid || 0)),
            createdAt: new Date()
        };

        const saleResult = await db.collection('sales').insertOne(newSale);

        // BURADAN BAŞLA: Müşterinin toplam veresiye borcunu güncelle
        // Sadece newSale.creditDebt > 0 ise müşterinin borcunu güncelle
        if (newSale.creditDebt > 0 && newSale.customerId) {
            const customerUpdateResult = await db.collection('customers').updateOne(
                { _id: new ObjectId(newSale.customerId), userId: userId },
                { $inc: { currentDebt: newSale.creditDebt }, $set: { updatedAt: new Date() } }
            );
            console.log(`[DEBUG-BACKEND-SALES] Müşteri ${newSale.customerName} (${newSale.customerId}) için veresiye borcu güncellendi. Eşleşen: ${customerUpdateResult.matchedCount}, Değiştirilen: ${customerUpdateResult.modifiedCount}`);
        }
        // BURADA BİTİR

        res.status(201).json({ message: 'Satış başarıyla kaydedildi!', sale: newSale });

    } catch (error) {
        console.error('Satış işlemi hatası:', error);
        res.status(500).json({ message: error.message || 'Satış işlemi sırasında bir hata oluştu.' });
    }
});

// Tüm Satışları Getirme Rotası (Filtreleme ile)
router.get('/sales', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { customerName, startDate, endDate, customerId } = req.query;

    if (!req.user.is2FAVerified) {
        return res.status(403).json({ message: 'Satış geçmişini görüntülemek için 2FA doğrulaması gerekli.' });
    }

    let query = { userId: userId };

    if (customerName) {
        query.customerName = { $regex: customerName, $options: 'i' };
    }
    if (customerId) {
        query.customerId = new ObjectId(customerId);
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
        const db = getDb();
        const sales = await db.collection('sales').find(query).sort({ saleDate: -1, createdAt: -1 }).toArray();
        res.status(200).json(sales);
    } catch (error) {
        console.error('Satışları çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;