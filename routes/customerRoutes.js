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
            userId: userId, // CORRECTED: userId is a string
            name,
            shopName: shopName || null,
            phoneNumber,
            email: email || null,
            address: address || null,
            currentDebt: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('customers').insertOne(newCustomer);
        res.status(201).json({ message: 'Müşteri başarıyla eklendi!', customerId: result.insertedId });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Müşterileri Getirme Rotası (Filtreleme ile)
router.get('/customers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { name, phoneNumber } = req.query;

    let query = { userId: userId }; // CORRECTED: userId is a string

    if (name) {
        query.name = { $regex: name, $options: 'i' };
    }
    if (phoneNumber) {
        query.phoneNumber = { $regex: phoneNumber, $options: 'i' };
    }

    try {
        const db = getDb();
        const customers = await db.collection('customers').find(query).sort({ createdAt: -1 }).toArray();
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Belirli Bir Müşteriyi Getirme Rotası
router.get('/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const customer = await db.collection('customers').findOne({ _id: new ObjectId(id), userId: userId }); // CORRECTED: userId is a string

        if (!customer) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json(customer);
    } catch (error) {
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşteri Güncelleme Rotası
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
            { _id: new ObjectId(id), userId: userId }, // CORRECTED: userId is a string
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
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Müşteri Silme Rotası
router.delete('/customers/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const result = await db.collection('customers').deleteOne({ _id: new ObjectId(id), userId: userId }); // CORRECTED: userId is a string

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Müşteri başarıyla silindi!' });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;