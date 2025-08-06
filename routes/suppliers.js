// routes/suppliers.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Tedarikçi Ekleme Rotası
router.post('/suppliers', authenticateToken, async (req, res) => {
    const { name, contactPerson, email, phone, address, notes } = req.body;
    const userId = req.user.userId;

    if (!name || !contactPerson) {
        return res.status(400).json({ message: 'Tedarikçi adı ve ilgili kişi adı gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const newSupplier = {
            userId: userId,
            name,
            contactPerson,
            email: email || null,
            phone: phone || null,
            address: address || null,
            notes: notes || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('suppliers').insertOne(newSupplier);
        res.status(201).json({ message: 'Tedarikçi başarıyla eklendi!', supplier: newSupplier });
    } catch (error) {
        console.error('Tedarikçi ekleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Tedarikçileri Getirme Rotası
router.get('/suppliers', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const suppliers = await db.collection('suppliers').find({ userId: userId }).toArray();
        res.status(200).json(suppliers);
    } catch (error) {
        console.error('Tedarikçileri çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçi Güncelleme Rotası
router.put('/suppliers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, contactPerson, email, phone, address, notes } = req.body;
    const userId = req.user.userId;

    if (!name || !contactPerson) {
        return res.status(400).json({ message: 'Tedarikçi adı ve ilgili kişi adı gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('suppliers').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: {
                name,
                contactPerson,
                email: email || null,
                phone: phone || null,
                address: address || null,
                notes: notes || null,
                updatedAt: new Date()
            }}
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Tedarikçi başarıyla güncellendi!' });
    } catch (error) {
        console.error('Tedarikçi güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçi Silme Rotası
router.delete('/suppliers/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('suppliers').deleteOne({ _id: new ObjectId(id), userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Tedarikçi başarıyla silindi!' });
    } catch (error) {
        console.error('Tedarikçi silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
