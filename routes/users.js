// routes/users.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken } = require('../middleware/authMiddleware'); // Middleware'i al

const router = express.Router();

// Giriş yapmış kullanıcının kendi bilgilerini getirme rotası
router.get('/users/me', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // JWT'den gelen kullanıcı ID'si

    try {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0, twoFactorSecret: 0, current2FACode: 0, twoFACodeExpiresAt: 0, recoveryCodes: 0 } } // Hassas bilgileri gönderme
        );

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({
            userId: user._id.toString(),
            email: user.email,
            is2FAEnabled: user.is2FAEnabled || false, // Varsayılan değer false
            is2FAVerified: req.user.is2FAVerified || false // JWT'den gelen anlık doğrulama durumu
        });

    } catch (error) {
        console.error('Kullanıcı bilgileri çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
