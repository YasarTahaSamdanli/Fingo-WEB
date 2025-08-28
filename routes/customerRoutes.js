// routes/customerRoutes.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni Müşteri Ekleme Rotası
router.post('/customers', authenticateToken, async (req, res) => {
    const { name, shopName, phoneNumber, email, address } = req.body;
    const userId = req.user.userId; // JWT'den gelen kullanıcı ID'si

    console.log(`[DEBUG-BACKEND-CUSTOMER] Yeni müşteri ekleme isteği: Ad: ${name}, Telefon: ${phoneNumber}, userId: ${userId}`);

    if (!name || !phoneNumber) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri adı veya telefon numarası eksik.');
        return res.status(400).json({ message: 'Müşteri adı ve telefon numarası gerekli.' });
    }

    try {
        const db = getDb();
        const existingCustomer = await db.collection('customers').findOne({ userId: new ObjectId(userId), phoneNumber: phoneNumber });
        if (existingCustomer) {
            console.warn(`[DEBUG-BACKEND-CUSTOMER] Mevcut müşteri bulundu (telefon numarası çakışması): ${phoneNumber}`);
            return res.status(409).json({ message: 'Bu telefon numarası ile kayıtlı bir müşteri zaten var.' });
        }

        const newCustomer = {
            userId: new ObjectId(userId), // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            name,
            shopName: shopName || null,
            phoneNumber,
            email: email || null,
            address: address || null,
            totalCreditDebt: 0,
            creditTransactions: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('customers').insertOne(newCustomer);
        console.log(`[DEBUG-BACKEND-CUSTOMER] Yeni müşteri başarıyla eklendi: ID: ${result.insertedId}, Kaydedilen userId: ${newCustomer.userId}`);
        res.status(201).json({ message: 'Müşteri başarıyla eklendi!', customerId: result.insertedId });

    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri ekleme hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Müşterileri Getirme Rotası (Filtreleme ile)
router.get('/customers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { name, phoneNumber } = req.query;

    console.log(`[DEBUG-BACKEND-CUSTOMER] Tüm müşterileri çekme isteği: userId: ${userId}, Arama: ${name || 'Yok'}, Telefon: ${phoneNumber || 'Yok'}`);

    let query = { userId: new ObjectId(userId) }; // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

    if (name) {
        query.name = { $regex: name, $options: 'i' };
    }
    if (phoneNumber) {
        query.phoneNumber = { $regex: phoneNumber, $options: 'i' };
    }

    try {
        const db = getDb();
        const customers = await db.collection('customers').find(query).sort({ createdAt: -1 }).toArray();
        console.log(`[DEBUG-BACKEND-CUSTOMER] ${customers.length} müşteri bulundu.`);
        res.status(200).json(customers);
    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşterileri çekerken hata:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Belirli Bir Müşteriyi Getirme Rotası
router.get('/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    console.log(`[DEBUG-BACKEND-CUSTOMER] Belirli müşteri çekme isteği: ID: ${id}, userId: ${userId}`);

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (!customer) {
            console.warn(`[DEBUG-BACKEND-CUSTOMER] Müşteri bulunamadı veya bu kullanıcıya ait değil: ID: ${id}, userId: ${userId}`);
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        console.log(`[DEBUG-BACKEND-CUSTOMER] Müşteri bulundu: ID: ${customer._id}, Ad: ${customer.name}`);
        res.status(200).json(customer);
    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri çekerken hata:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// MÜŞTERİ SAYISI GETİRME ROTASI (Dashboard Widget için)
router.get('/customers/count', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        const count = await db.collection('customers').countDocuments({ userId: new ObjectId(userId) });
        
        res.status(200).json({ count: count });
    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri sayısı çekme hatası:', error);
        res.status(500).json({ message: 'Müşteri sayısı yüklenirken sunucu hatası.' });
    }
});

// Müşteri Güncelleme Rotası
router.put('/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const { name, shopName, phoneNumber, email, address } = req.body;

    console.log(`[DEBUG-BACKEND-CUSTOMER] Müşteri güncelleme isteği: ID: ${id}, userId: ${userId}, Güncelleyen: ${name}`);

    if (!name || !phoneNumber) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Güncelleme için müşteri adı veya telefon numarası eksik.');
        return res.status(400).json({ message: 'Müşteri adı ve telefon numarası gerekli.' });
    }

    try {
        const db = getDb();
        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
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
            console.warn(`[DEBUG-BACKEND-CUSTOMER] Müşteri güncellenemedi (eşleşme yok): ID: ${id}, userId: ${userId}`);
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        console.log(`[DEBUG-BACKEND-CUSTOMER] Müşteri başarıyla güncellendi: ID: ${id}`);
        res.status(200).json({ message: 'Müşteri başarıyla güncellendi!' });
    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri güncelleme hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşteri Silme Rotası
router.delete('/customers/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    console.log(`[DEBUG-BACKEND-CUSTOMER] Müşteri silme isteği: ID: ${id}, userId: ${userId}`);

    try {
        const db = getDb();
        const result = await db.collection('customers').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (result.deletedCount === 0) {
            console.warn(`[DEBUG-BACKEND-CUSTOMER] Müşteri silinemedi (eşleşme yok): ID: ${id}, userId: ${userId}`);
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        console.log(`[DEBUG-BACKEND-CUSTOMER] Müşteri başarıyla silindi: ID: ${id}`);
        res.status(200).json({ message: 'Müşteri başarıyla silindi!' });
    } catch (error) {
        console.error('[DEBUG-BACKEND-CUSTOMER] Müşteri silme hatası:', error);
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Veresiye İşlemi Ekleme Rotası (Borçlandırma veya Tahsilat)
router.post('/customers/:id/credit-transaction', authenticateToken, async (req, res) => {
    console.warn('[DEBUG-BACKEND-CUSTOMER] /customers/:id/credit-transaction rotası çağrıldı. Bu rota artık kullanılmamalı, /transactions/credit kullanılmalı.');
    const { id } = req.params;
    const userId = req.user.userId;
    const { type, amount, description } = req.body;

    if (!type || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'İşlem tipi ve geçerli bir miktar gerekli.' });
    }

    const transactionAmount = parseFloat(amount);
    const transactionType = type;

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }

        let newCreditDebt = customer.totalCreditDebt;
        if (transactionType === 'Sale') {
            newCreditDebt += transactionAmount;
        } else if (transactionType === 'Payment') {
            newCreditDebt -= transactionAmount;
            if (newCreditDebt < 0) newCreditDebt = 0;
        } else {
            return res.status(400).json({ message: 'Geçersiz işlem tipi. "Sale" veya "Payment" olmalı.' });
        }

        const newTransaction = {
            type: transactionType,
            amount: transactionAmount,
            description: description || '',
            date: new Date(),
            transactionId: new ObjectId()
        };

        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
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
    console.warn('[DEBUG-BACKEND-CUSTOMER] /customers/:id/credit-history rotası çağrıldı. Bu rota artık kullanılmamalı, /transactions/credit/:customerId kullanılmalı.');
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            { projection: { creditTransactions: 1, _id: 0 } }
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
