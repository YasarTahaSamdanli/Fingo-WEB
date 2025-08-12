// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware'); // authenticateToken'ı dahil et
const { sendVerificationEmail } = require('../utils/emailSender'); // E-posta gönderme yardımcı fonksiyonu

const router = express.Router();

// Kullanıcı Kayıt Rotası
router.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email ve şifre gereklidir.' });
    }

    try {
        const db = getDb();
        const existingUser = await db.collection('users').findOne({ email });

        if (existingUser) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            email,
            password: hashedPassword,
            twoFactorAuthEnabled: false,
            twoFactorAuthSecret: null,
            twoFactorAuthBackupCodes: [],
            is2FAVerified: false, // İlk girişte 2FA doğrulanmadı
            createdAt: new Date(),
        };

        const result = await db.collection('users').insertOne(newUser);
        res.status(201).json({ message: 'Kayıt başarılı! Lütfen giriş yapın.', userId: result.insertedId });
    } catch (error) {
        console.error('Kayıt hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kullanıcı Giriş Rotası
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Geçersiz kimlik bilgileri.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Geçersiz kimlik bilgileri.' });
        }

        // 2FA kontrolü
        if (user.twoFactorAuthEnabled) {
            // 2FA etkinse, kodu e-postaya gönder ve kullanıcıya 2FA'ya yönlendir
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 haneli kod
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { twoFactorAuthCode: verificationCode, twoFactorAuthCodeExpires: new Date(Date.now() + 10 * 60 * 1000) } } // 10 dakika geçerli
            );
            await sendVerificationEmail(user.email, verificationCode); // Kodu e-postaya gönder
            return res.status(200).json({ message: '2 Adımlı Doğrulama kodu e-postanıza gönderildi.', requires2FA: true, userId: user._id });
        } else {
            // 2FA etkin değilse doğrudan token ver
            const token = jwt.sign({ userId: user._id, email: user.email, is2FAVerified: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
            // is2FAVerified true yapıyoruz çünkü 2FA etkin değilse otomatik olarak doğrulanmış sayılırız.
            res.status(200).json({ message: 'Giriş başarılı!', token, userId: user._id, email: user.email, requires2FA: false });
        }

    } catch (error) {
        console.error('Giriş hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


// 2FA Kodu Doğrulama Rotası
router.post('/2fa/verify', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const userId = req.user.userId; // authenticateToken'dan gelen userId

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.twoFactorAuthEnabled || !user.twoFactorAuthCode || !user.twoFactorAuthCodeExpires) {
            return res.status(400).json({ message: '2FA doğrulama başlatılmamış veya geçersiz istek.' });
        }

        if (user.twoFactorAuthCode !== code || user.twoFactorAuthCodeExpires < new Date()) {
            return res.status(400).json({ message: 'Geçersiz veya süresi dolmuş 2FA kodu.' });
        }

        // Kodu ve süre bitimini temizle, is2FAVerified'ı true yap
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { twoFactorAuthCode: null, twoFactorAuthCodeExpires: null, is2FAVerified: true } }
        );

        // Yeni bir JWT oluştur (2FA doğrulanmış olarak)
        const token = jwt.sign({ userId: user._id, email: user.email, is2FAVerified: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: '2FA başarıyla doğrulandı!', token, userId: user._id });

    } catch (error) {
        console.error('2FA doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Kodunu Tekrar Gönderme Rotası
router.post('/2fa/resend', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // authenticateToken'dan gelen userId

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.twoFactorAuthEnabled) {
            return res.status(400).json({ message: '2FA etkin değil veya kullanıcı bulunamadı.' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Yeni 6 haneli kod
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { twoFactorAuthCode: verificationCode, twoFactorAuthCodeExpires: new Date(Date.now() + 10 * 60 * 1000) } } // 10 dakika geçerli
        );
        await sendVerificationEmail(user.email, verificationCode); // Kodu e-postaya tekrar gönder

        res.status(200).json({ message: 'Yeni 2FA kodu e-postanıza gönderildi.' });

    } catch (error) {
        console.error('2FA kodu tekrar gönderme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Kurtarma Kodu Doğrulama Rotası
router.post('/2fa/verify-recovery', authenticateToken, async (req, res) => {
    const { recoveryCode } = req.body;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.twoFactorAuthEnabled || !user.twoFactorAuthBackupCodes || user.twoFactorAuthBackupCodes.length === 0) {
            return res.status(400).json({ message: 'Kurtarma kodları mevcut değil veya 2FA etkin değil.' });
        }

        const codeIndex = user.twoFactorAuthBackupCodes.indexOf(recoveryCode);

        if (codeIndex === -1) {
            return res.status(400).json({ message: 'Geçersiz kurtarma kodu.' });
        }

        // Kullanılan kurtarma kodunu listeden kaldır
        user.twoFactorAuthBackupCodes.splice(codeIndex, 1);
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { twoFactorAuthBackupCodes: user.twoFactorAuthBackupCodes, is2FAVerified: true } }
        );

        // Yeni bir JWT oluştur (2FA doğrulanmış olarak)
        const token = jwt.sign({ userId: user._id, email: user.email, is2FAVerified: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Kurtarma kodu başarıyla doğrulandı!', token, userId: user._id });

    } catch (error) {
        console.error('Kurtarma kodu doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


module.exports = router;
