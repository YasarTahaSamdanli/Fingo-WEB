// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al

const router = express.Router(); // Yeni bir router objesi oluştur

// Kullanıcı Kayıt Rotası
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'E-posta ve şifre gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            email,
            password: hashedPassword,
            is2FAEnabled: false, // Varsayılan olarak 2FA kapalı
            twoFactorSecret: null,
            is2FAVerified: false, // Oturum bazında 2FA doğrulaması
            createdAt: new Date()
        };
        await db.collection('users').insertOne(newUser);
        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi.' });
    } catch (error) {
        console.error('Kayıt hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kullanıcı Giriş Rotası
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'E-posta ve şifre gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Geçersiz kimlik bilgileri.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Geçersiz kimlik bilgileri.' });
        }

        // JWT payload'ına 2FA durumunu ekle
        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, is2FAEnabled: user.is2FAEnabled, is2FAVerified: false },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token 1 saat geçerli
        );

        res.status(200).json({ message: 'Giriş başarılı!', token, userId: user._id.toString(), email: user.email, is2FAEnabled: user.is2FAEnabled });
    } catch (error) {
        console.error('Giriş hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
