// routes/users.js
const express = require('express');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Kullanıcı bilgilerini çekme rotası
router.get('/users/me', authenticateToken, async (req, res) => {
    try {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            { projection: { password: 0, twoFactorSecret: 0, recoveryCodes: 0, verificationToken: 0, verificationTokenExpires: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Kullanıcı bilgilerini çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// 2FA'yı devre dışı bırakma rotası
router.post('/users/disable-2fa', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            {
                $set: { is2FAEnabled: false, twoFactorSecret: null },
                $unset: { recoveryCodes: "" }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({ message: 'İki faktörlü kimlik doğrulama başarıyla devre dışı bırakıldı.' });
    } catch (error) {
        console.error('2FA devre dışı bırakılırken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
