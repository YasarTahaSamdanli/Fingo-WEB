// routes/2fa.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Nodemailer transporter (e-posta gönderimi için)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 2FA Gizli Anahtarı Oluşturma Rotası (Profil Yönetimi için)
router.post('/2fa/generate-secret', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const secret = speakeasy.generateSecret({
            name: `FingoApp (${user.email})`,
            length: 20
        });

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { twoFactorSecret: secret.base32, is2FAVerified: false } }
        );

        const otpauthUrl = secret.otpauth_url;

        res.status(200).json({
            message: '2FA gizli anahtarı başarıyla oluşturuldu.',
            secret: secret.base32,
            otpauthUrl: otpauthUrl
        });

    } catch (error) {
        console.error('2FA gizli anahtarı oluşturulurken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Etkinleştirme Doğrulaması Rotası (Profil Yönetimi için)
router.post('/2fa/verify-enable', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Doğrulama kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA etkinleştirme işlemi başlatılmadı veya gizli anahtar bulunamadı.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1
        });

        if (verified) {
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

// 2FA Devre Dışı Bırakma Rotası (Profil Yönetimi için)
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

// Kurtarma Kodlarını Getirme Rotası (Profil Yönetimi için)
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

// Kurtarma Kodlarını Yeniden Oluşturma Rotası (Profil Yönetimi için)
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

// Yeni 2FA Giriş Akışı Rotaları

// 2FA Kodu Gönderme Rotası (Giriş sırasında)
router.post('/2fa/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'E-posta adresi gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user || !user.is2FAEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ message: 'Kullanıcı bulunamadı veya 2FA etkin değil.' });
        }

        const token = speakeasy.totp({
            secret: user.twoFactorSecret,
            encoding: 'base32'
        });

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika geçerli
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { current2FACode: token, twoFACodeExpiresAt: expiresAt } }
        );

        // GEÇİCİ ÇÖZÜM: Gerçek e-posta adresleri olmadığı için Nodemailer'ı devre dışı bırakıyoruz.
        // const mailOptions = {
        //     from: process.env.EMAIL_USER,
        //     to: user.email,
        //     subject: 'Fingo - İki Faktörlü Kimlik Doğrulama Kodunuz',
        //     html: `<p>Merhaba,</p><p>Fingo hesabınıza giriş yapmak için 2FA kodunuz: <strong>${token}</strong></p><p>Bu kod 5 dakika içinde geçerliliğini yitirecektir.</p><p>Eğer bu isteği siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p><p>Teşekkürler,</p><p>Fingo Ekibi</p>`
        // };
        // await transporter.sendMail(mailOptions);

        // DİKKAT: Backend'de oluşturulan kodu manuel olarak test etmek için bu console.log'u kullanabilirsin.
        console.log(`2FA Kodu (${user.email} için): ${token}`);

        res.status(200).json({ message: '2FA kodu e-posta adresinize gönderildi.' });

    } catch (error) {
        console.error('2FA kodu gönderilirken hata:', error);
        console.error('Nodemailer sendMail error details:', error.response);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Giriş Kodu Doğrulama Rotası
router.post('/2fa/verify-login-code', async (req, res) => {
    const { email, token } = req.body;

    if (!email || !token) {
        return res.status(400).json({ message: 'E-posta ve doğrulama kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user || !user.is2FAEnabled || !user.current2FACode || !user.twoFACodeExpiresAt) {
            return res.status(400).json({ message: '2FA kodu bulunamadı veya süresi doldu.' });
        }

        if (new Date() > user.twoFACodeExpiresAt) {
            return res.status(400).json({ message: '2FA kodu süresi doldu. Lütfen tekrar gönderin.' });
        }

        if (user.current2FACode === token) {
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { current2FACode: null, twoFACodeExpiresAt: null, is2FAVerified: true } }
            );
            res.status(200).json({ message: '2FA kodu başarıyla doğrulandı.', is2FAVerified: true });
        } else {
            res.status(400).json({ message: 'Geçersiz 2FA kodu.' });
        }

    } catch (error) {
        console.error('2FA giriş kodu doğrulanırken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kurtarma Kodu ile Giriş Doğrulama Rotası
router.post('/2fa/verify-recovery-code', async (req, res) => {
    const { email, recoveryCode } = req.body;

    if (!email || !recoveryCode) {
        return res.status(400).json({ message: 'E-posta ve kurtarma kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user || !user.is2FAEnabled || !user.recoveryCodes || user.recoveryCodes.length === 0) {
            return res.status(400).json({ message: 'Kullanıcı bulunamadı veya kurtarma kodları ayarlı değil.' });
        }

        const codeIndex = user.recoveryCodes.indexOf(recoveryCode.toUpperCase());
        if (codeIndex > -1) {
            user.recoveryCodes.splice(codeIndex, 1);
            await db.collection('users').updateOne(
                { _id: user._id },
                { $set: { recoveryCodes: user.recoveryCodes, is2FAVerified: true } }
            );
            res.status(200).json({ message: 'Kurtarma kodu başarıyla doğrulandı.', is2FAVerified: true });
        } else {
            res.status(400).json({ message: 'Geçersiz veya kullanılmış kurtarma kodu.' });
        }

    } catch (error) {
        console.error('Kurtarma kodu doğrulanırken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Şifre Değiştirme Rotası (authenticateToken middleware'i ile korunuyor)
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

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedPassword } }
        );

        res.status(200).json({ message: 'Şifre başarıyla değiştirildi.' });
    } catch (error) {
        console.error('Şifre değiştirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
