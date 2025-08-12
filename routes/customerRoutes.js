// routes/customerRoutes.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni Müşteri Ekleme Rotası
router.post('/customers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const customer = req.body;

    // Gerekli alanların kontrolü
    if (!customer.name || !customer.shopName || !customer.phoneNumber) {
        return res.status(400).json({ message: 'Müşteri adı, dükkan adı ve telefon numarası zorunludur.' });
    }

    try {
        const db = getDb();
        const customerWithUserId = { ...customer, userId: new ObjectId(userId), createdAt: new Date() };
        const result = await db.collection('customers').insertOne(customerWithUserId);
        res.status(201).json({
            message: 'Müşteri başarıyla eklendi.',
            customerId: result.insertedId
        });
    } catch (error) {
        console.error('Müşteri eklenirken hata:', error);
        res.status(500).json({ message: 'Müşteri eklenirken sunucu hatası.' });
    }
});

// Tüm Müşterileri Getirme Rotası
router.get('/customers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        const customers = await db.collection('customers').find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
        res.status(200).json(customers);
    } catch (error) {
        console.error('Müşteriler çekilirken hata:', error);
        res.status(500).json({ message: 'Müşteriler yüklenirken sunucu hatası.' });
    }
});

// Müşteri Güncelleme Rotası
router.put('/customers/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const customerId = req.params.id;
    const updatedData = req.body;

    try {
        const db = getDb();
        const result = await db.collection('customers').updateOne(
            { _id: new ObjectId(customerId), userId: new ObjectId(userId) },
            { $set: updatedData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya yetkiniz yok.' });
        }

        res.status(200).json({ message: 'Müşteri başarıyla güncellendi.' });
    } catch (error) {
        console.error('Müşteri güncellenirken hata:', error);
        res.status(500).json({ message: 'Müşteri güncellenirken sunucu hatası.' });
    }
});

// Müşteri Silme Rotası
router.delete('/customers/:id', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const customerId = req.params.id;

    try {
        const db = getDb();
        const result = await db.collection('customers').deleteOne({ _id: new ObjectId(customerId), userId: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Müşteri bulunamadı veya yetkiniz yok.' });
        }

        res.status(200).json({ message: 'Müşteri başarıyla silindi.' });
    } catch (error) {
        console.error('Müşteri silinirken hata:', error);
        res.status(500).json({ message: 'Müşteri silinirken sunucu hatası.' });
    }
});

module.exports = router;
