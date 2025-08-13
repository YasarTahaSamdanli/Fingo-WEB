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

        const creditDebtAmount = totalAmount - (parseFloat(cashPaid || 0) + parseFloat(cardPaid || 0));

        const newSale = {
            userId: userId,
            saleItems: processedSaleItems,
            customerId: customerId || null,
            customerName: customerName || 'Anonim',
            totalAmount: totalAmount,
            saleDate: new Date(saleDate),
            paymentMethod: paymentMethod,
            cashPaid: parseFloat(cashPaid || 0),
            cardPaid: parseFloat(cardPaid || 0),
            creditDebt: creditDebtAmount > 0 ? creditDebtAmount : 0,
            createdAt: new Date()
        };

        await db.collection('sales').insertOne(newSale);

        // Eğer veresiye borcu varsa, müşterinin toplam veresiye borcunu ve işlem geçmişini güncelle
        if (creditDebtAmount > 0 && customerId) {
            const customerObjectId = new ObjectId(customerId);
            const customer = await db.collection('customers').findOne({ _id: customerObjectId, userId: userId });

            if (customer) {
                const newTotalCreditDebt = customer.totalCreditDebt + creditDebtAmount;
                const newTransaction = {
                    type: 'Sale', // Borçlandırma işlemi
                    amount: creditDebtAmount,
                    description: `Satıştan veresiye (${totalAmount.toFixed(2)} TL). Nakit:${parseFloat(cashPaid || 0).toFixed(2)}, Kart:${parseFloat(cardPaid || 0).toFixed(2)}`,
                    date: new Date(),
                    transactionId: new ObjectId()
                };

                await db.collection('customers').updateOne(
                    { _id: customerObjectId, userId: userId },
                    {
                        $set: { totalCreditDebt: newTotalCreditDebt, updatedAt: new Date() },
                        $push: { creditTransactions: newTransaction }
                    }
                );
            } else {
                console.warn(`Veresiye borcu eklenemedi: Müşteri ID ${customerId} bulunamadı.`);
            }
        }

        res.status(201).json({ message: 'Satış başarıyla kaydedildi!', sale: newSale });

    } catch (error) {
        console.error('Satış kaydetme hatası:', error);
        res.status(500).json({ message: error.message || 'Satış işlemi sırasında bir hata oluştu.' });
    }
});

// Tüm Satışları Getirme Rotası (Filtreleme ile)
router.get('/sales', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { customerName, startDate, endDate } = req.query;

    if (!req.user.is2FAVerified) {
        return res.status(403).json({ message: 'Satış geçmişini görüntülemek için 2FA doğrulaması gerekli.' });
    }

    let query = { userId: userId };

    if (customerName) {
        query.customerName = { $regex: customerName, $options: 'i' };
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
        const sales = await db.collection('sales').find(query).sort({ saleDate: -1 }).toArray();
        res.status(200).json(sales);
    } catch (error) {
        console.error('Satışları çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
