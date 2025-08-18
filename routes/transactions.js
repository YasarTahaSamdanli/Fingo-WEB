// routes/transactions.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni işlem ekleme rotası (genel işlemler için)
router.post('/transactions', authenticateToken, async (req, res) => {
    const { type, amount, description, category, date } = req.body;
    const userId = req.user.userId;

    if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: 'Lütfen tüm gerekli alanları doldurun.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Miktar geçerli bir sayı olmalıdır.' });
    }

    try {
        const db = getDb();
        const transactionDate = new Date(date);
        const utcTransactionDate = new Date(Date.UTC(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate()));

        const newTransaction = {
            userId: userId, // CORRECTED: userId is a string
            type,
            amount: parseFloat(amount),
            description,
            category: category || null,
            date: utcTransactionDate,
            createdAt: new Date()
        };

        const result = await db.collection('transactions').insertOne(newTransaction);
        res.status(201).json({ message: 'İşlem başarıyla eklendi.', transactionId: result.insertedId });
    } catch (error) {
        console.error('İşlem eklerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm işlemleri getirme rotası (filtreleme ile)
router.get('/transactions', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { type, category, date, startDate, endDate } = req.query;

    try {
        const db = getDb();
        const query = { userId: userId }; // CORRECTED: userId is a string

        if (type) { query.type = type; }
        if (category) { query.category = category; }

        if (date) {
            const filterDate = new Date(date);
            const startOfDay = new Date(Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()));
            const endOfDay = new Date(Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1));
            query.date = { $gte: startOfDay, $lt: endOfDay };
        } else if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                query.date.$gte = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
            }
            if (endDate) {
                const end = new Date(endDate);
                query.date.$lt = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() + 1));
            }
        }

        const transactions = await db.collection('transactions').find(query).sort({ date: -1, createdAt: -1 }).toArray();
        res.status(200).json(transactions);
    } catch (error) {
        console.error('İşlemleri çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// İşlem güncelleme rotası
router.put('/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { type, amount, description, category, date } = req.body;

    if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: 'Lütfen tüm gerekli alanları doldurun.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Miktar geçerli bir sayı olmalıdır.' });
    }

    try {
        const db = getDb();
        const transactionDate = new Date(date);
        const utcTransactionDate = new Date(Date.UTC(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate()));

        const updatedTransaction = {
            type,
            amount: parseFloat(amount),
            description,
            category: category || null,
            date: utcTransactionDate,
            updatedAt: new Date()
        };

        const result = await db.collection('transactions').updateOne(
            { _id: new ObjectId(id), userId: userId }, // CORRECTED: userId is a string
            { $set: updatedTransaction }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'İşlem bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'İşlem başarıyla güncellendi.' });
    } catch (error) {
        console.error('İşlem güncellerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// İşlem silme rotası
router.delete('/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const result = await db.collection('transactions').deleteOne({ _id: new ObjectId(id), userId: userId }); // CORRECTED: userId is a string

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'İşlem bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'İşlem başarıyla silindi.' });
    } catch (error) {
        console.error('İşlem silerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşterinin veresiye borcuna yeni bir işlem (ödeme veya borç ekleme) ekleme
router.post('/transactions/credit', authenticateToken, async (req, res) => {
    const { customerId, amount, type, description } = req.body;
    const userId = req.user.userId;

    if (!customerId || amount === undefined || !type) {
        return res.status(400).json({ message: 'Müşteri ID, miktar ve işlem tipi gereklidir.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: 'Geçerli ve pozitif bir miktar girilmelidir.' });
    }

    if (type !== 'payment' && type !== 'debt') {
        return res.status(400).json({ message: 'Geçersiz işlem tipi. "payment" veya "debt" olmalıdır.' });
    }

    try {
        const db = getDb();
        let customerObjectId;

        try {
            customerObjectId = new ObjectId(customerId);
        } catch (e) {
            return res.status(400).json({ message: 'Geçersiz ID formatı.' });
        }

        const customer = await db.collection('customers').findOne({ _id: customerObjectId, userId: userId }); // CORRECTED: userId is a string

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı.' });
        }

        let newDebtAmount = customer.currentDebt || 0;

        if (type === 'payment') {
            newDebtAmount -= parsedAmount;
        } else if (type === 'debt') {
            newDebtAmount += parsedAmount;
        }

        if (newDebtAmount < 0) {
            newDebtAmount = 0;
        }

        const updateResult = await db.collection('customers').updateOne(
            { _id: customerObjectId, userId: userId }, // CORRECTED: userId is a string
            { $set: { currentDebt: newDebtAmount, updatedAt: new Date() } }
        );

        if (updateResult.matchedCount === 0) {
             return res.status(500).json({ message: 'Müşteri güncellenemedi. Lütfen tekrar deneyin.' });
        }

        const newTransaction = {
            userId: userId, // CORRECTED: userId is a string
            customerId: customerObjectId,
            customerName: customer.name,
            type: type,
            amount: parsedAmount,
            description: description || (type === 'payment' ? 'Veresiye Ödemesi' : 'Manuel Borç Ekleme'),
            date: new Date(),
            createdAt: new Date()
        };
        const transactionInsertResult = await db.collection('transactions').insertOne(newTransaction);

        res.status(200).json({
            message: 'Veresiye işlemi başarıyla kaydedildi ve borç güncellendi.',
            newDebt: newDebtAmount
        });

    } catch (error) {
        console.error('Veresiye işlemi kaydedilirken genel hata:', error);
        res.status(500).json({ message: 'Veresiye işlemi kaydedilirken sunucu hatası oluştu. Lütfen tekrar deneyin.', error: error.message });
    }
});

// Müşteriye ait veresiye işlemlerini getirme
router.get('/transactions/credit/:customerId', authenticateToken, async (req, res) => {
    const { customerId } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();

        let customerObjectId;
        try {
            customerObjectId = new ObjectId(customerId);
        } catch (e) {
            return res.status(400).json({ message: 'Geçersiz müşteri ID formatı.' });
        }

        const creditTransactions = await db.collection('transactions').find({
            userId: userId, // CORRECTED: userId is a string
            customerId: customerObjectId,
            type: { $in: ['payment', 'debt'] }
        }).sort({ date: -1, createdAt: -1 }).toArray();

        res.status(200).json(creditTransactions);
    } catch (error) {
        console.error('Müşteriye ait veresiye işlemleri çekilirken hata:', error);
        res.status(500).json({ message: 'Müşteriye ait veresiye işlemleri çekilirken sunucu hatası oluştu.' });
    }
});