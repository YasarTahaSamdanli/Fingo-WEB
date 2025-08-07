// routes/2fa.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer'); // E-posta gönderimi için

const router = express.Router();

// Nodemailer transporter (e-posta gönderimi için)
// Kendi SMTP ayarlarınızı buraya girin veya .env'den çekin
const transporter = nodemailer.createTransport({
    service: 'gmail', // veya 'outlook', 'hotmail' vb.
    auth: {
        user: process.env.EMAIL_USER, // .env dosyanızda tanımlayın
        pass: process.env.EMAIL_PASS  // .env dosyanızda tanımlayın (uygulama şifresi olabilir)
    }
});

// 2FA Gizli Anahtarı Oluşturma Rotası
router.post('/2fa/generate-secret', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // Yeni bir gizli anahtar oluştur
        const secret = speakeasy.generateSecret({
            name: `FingoApp (${user.email})`, // Authenticator uygulamasında görünecek isim
            length: 20
        });

        // Gizli anahtarı veritabanına kaydet
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { twoFactorSecret: secret.base32, is2FAVerified: false } } // Doğrulama bekliyor
        );

        // QR kodu oluşturmak için otpauth URL'si
        const otpauthUrl = secret.otpauth_url;

        res.status(200).json({
            message: '2FA gizli anahtarı başarıyla oluşturuldu.',
            secret: secret.base32,
            otpauthUrl: otpauthUrl // Frontend'de QR kod oluşturmak için
        });

    } catch (error) {
        console.error('2FA gizli anahtarı oluşturulurken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Etkinleştirme Doğrulaması Rotası
router.post('/2fa/verify-enable', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { token } = req.body; // Kullanıcının girdiği 2FA kodu

    if (!token) {
        return res.status(400).json({ message: 'Doğrulama kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA etkinleştirme işlemi başlatılmadı veya gizli anahtar bulunamadı.' });
        }

        // Kodu doğrula
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1 // Zaman kayması için pencere
        });

        if (verified) {
            // 2FA'yı etkin olarak işaretle ve kurtarma kodları oluştur
            const recoveryCodes = Array.from({ length: 5 }, () =>
                Math.random().toString(36).substring(2, 10).toUpperCase() + '-' +
                Math.random().toString(36).substring(2, 10).toUpperCase()
            );

            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { is2FAEnabled: true, is2FAVerified: true, recoveryCodes: recoveryCodes } }
            );

            res.status(200).json({ message: '2FA başarıyla etkinleştirildi!', recoveryCodes });
        } else {
            res.status(400).json({ message: 'Geçersiz 2FA kodu. Lütfen tekrar deneyin.' });
        }

    } catch (error) {
        console.error('2FA etkinleştirme doğrulaması hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Devre Dışı Bırakma Rotası
router.post('/2fa/disable', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { is2FAEnabled: false, twoFactorSecret: null, is2FAVerified: false, recoveryCodes: [] } }
        );
        res.status(200).json({ message: '2FA başarıyla devre dışı bırakıldı.' });
    } catch (error) {
        console.error('2FA devre dışı bırakılırken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kurtarma Kodlarını Getirme Rotası
router.get('/2fa/recovery-codes', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(userId) },
            { projection: { recoveryCodes: 1 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({ recoveryCodes: user.recoveryCodes || [] });
    } catch (error) {
        console.error('Kurtarma kodları çekilirken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kurtarma Kodlarını Yeniden Oluşturma Rotası
router.post('/2fa/regenerate-recovery-codes', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled) {
            return res.status(400).json({ message: '2FA etkin değil, kurtarma kodları oluşturulamaz.' });
        }

        const newRecoveryCodes = Array.from({ length: 5 }, () =>
            Math.random().toString(36).substring(2, 10).toUpperCase() + '-' +
            Math.random().toString(36).substring(2, 10).toUpperCase()
        );

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { recoveryCodes: newRecoveryCodes } }
        );

        res.status(200).json({ message: 'Yeni kurtarma kodları başarıyla oluşturuldu.', recoveryCodes: newRecoveryCodes });
    } catch (error) {
        console.error('Kurtarma kodları yeniden oluşturulurken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Şifre Değiştirme Rotası (users.js'den buraya taşınabilir veya ayrı bir dosyada kalabilir)
router.post('/users/change-password', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Mevcut ve yeni şifreler gerekli.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Yeni şifre en az 8 karakter olmalıdır.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mevcut şifre yanlış.' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedNewPassword } }
        );

        res.status(200).json({ message: 'Şifre başarıyla değiştirildi.' });
    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


module.exports = router;
