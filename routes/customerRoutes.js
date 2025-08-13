// routes/customerRoutes.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni Müşteri Ekleme Rotası
router.post('/customers', authenticateToken, async (req, res) => {
    const { name, shopName, phoneNumber, email, address } = req.body;
    const userId = req.user.userId;

    if (!name || !phoneNumber) {
        return res.status(400).json({ message: 'Müşteri adı ve telefon numarası gerekli.' });
    }

    try {
        const db = getDb();
        const existingCustomer = await db.collection('customers').findOne({ userId: userId, phoneNumber: phoneNumber });
        if (existingCustomer) {
            return res.status(409).json({ message: 'Bu telefon numarası ile kayıtlı bir müşteri zaten var.' });
        }

        const newCustomer = {
            userId: userId,
            name,
            shopName: shopName || null,
            phoneNumber,
            email: email || null,
            address: address || null,
            totalCreditDebt: 0, // Yeni eklendi: Toplam veresiye borcu
            creditTransactions: [], // Yeni eklendi: Veresiye hareket geçmişi
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('customers').insertOne(newCustomer);
        res.status(201).json({ message: 'Müşteri başarıyla eklendi!', customerId: result.insertedId });

    } catch (error) {
        console.error('Müşteri ekleme hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Müşterileri Getirme Rotası (Filtreleme ile)
router.get('/customers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { name, phoneNumber } = req.query;

    let query = { userId: userId };

    if (name) {
        query.name = { $regex: name, $options: 'i' }; // Case-insensitive arama
    }
    if (phoneNumber) {
        query.phoneNumber = { $regex: phoneNumber, $options: 'i' };
    }

    try {
        const db = getDb();
        const customers = await db.collection('customers').find(query).sort({ createdAt: -1 }).toArray();
        res.status(200).json(customers);
    } catch (error) {
        console.error('Müşterileri çekerken hata:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Belirli Bir Müşteriyi Getirme Rotası
router.get('/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id), userId: userId });

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json(customer);
    } catch (error) {
        console.error('Müşteri çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşteri Güncelleme Rotası (EKSİK OLAN BUYDU)
router.put('/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, shopName, phoneNumber, email, address } = req.body;

    if (!name || !phoneNumber) {
        return res.status(400).json({ message: 'Müşteri adı ve telefon numarası gerekli.' });
    }

    try {
        const db = getDb();
        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(id), userId: userId },
            {
                $set: {
                    name,
                    shopName: shopName || null,
                    phoneNumber,
                    email: email || null,
                    address: address || null,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Müşteri başarıyla güncellendi!' });
    } catch (error) {
        console.error('Müşteri güncelleme hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşteri Silme Rotası
router.delete('/customers/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const result = await db.collection('customers').deleteOne({ _id: new ObjectId(id), userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Müşteri başarıyla silindi!' });
    } catch (error) {
        console.error('Müşteri silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Veresiye İşlemi Ekleme Rotası (Borçlandırma veya Tahsilat)
router.post('/customers/:id/credit-transaction', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { type, amount, description } = req.body; // type: "Sale" (Borç) veya "Payment" (Tahsilat)

    if (!type || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'İşlem tipi ve geçerli bir miktar gerekli.' });
    }

    const transactionAmount = parseFloat(amount);
    const transactionType = type; // "Sale" veya "Payment"

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id), userId: userId });

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }

        let newCreditDebt = customer.totalCreditDebt;
        if (transactionType === 'Sale') {
            newCreditDebt += transactionAmount;
        } else if (transactionType === 'Payment') {
            newCreditDebt -= transactionAmount;
            if (newCreditDebt < 0) newCreditDebt = 0; // Borç sıfırın altına düşmesin
        } else {
            return res.status(400).json({ message: 'Geçersiz işlem tipi. "Sale" veya "Payment" olmalı.' });
        }

        const newTransaction = {
            type: transactionType,
            amount: transactionAmount,
            description: description || '',
            date: new Date(),
            transactionId: new ObjectId() // Her işlem için benzersiz ID
        };

        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(id), userId: userId },
            {
                $set: { totalCreditDebt: newCreditDebt, updatedAt: new Date() },
                $push: { creditTransactions: newTransaction }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya güncellenemedi.' });
        }

        res.status(200).json({
            message: 'Veresiye işlemi başarıyla kaydedildi!',
            newTotalCreditDebt: newCreditDebt,
            newTransaction: newTransaction
        });

    } catch (error) {
        console.error('Veresiye işlemi hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Belirli Bir Müşterinin Veresiye Geçmişini Getirme Rotası
router.get('/customers/:id/credit-history', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne(
            { _id: new ObjectId(id), userId: userId },
            { projection: { creditTransactions: 1, _id: 0 } } // Sadece creditTransactions alanını getir
        );

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json(customer.creditTransactions || []);
    } catch (error) {
        console.error('Veresiye geçmişi çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


module.exports = router;
