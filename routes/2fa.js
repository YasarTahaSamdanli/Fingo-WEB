// routes/2fa.js
const express = require('express');
const { ObjectId } = require('mongodb');
const speakeasy = require('speakeasy'); // 2FA kodları için
const nodemailer = require('nodemailer'); // E-posta göndermek için (şimdilik konsola yazacak)
const bcrypt = require('bcryptjs'); // Kurtarma kodlarını hash'lemek için
const jwt = require('jsonwebtoken'); // JWT kütüphanesini içe aktar! BU EKSİKTİ
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // authenticateToken VE verify2FA'yı içe aktar

const router = express.Router();

// Nodemailer transporter'ı ayarla (e-posta göndermek için)
const transporter = nodemailer.createTransport({
    host: process.env.ETHEREAL_EMAIL_HOST || "smtp.ethereal.email", // .env'den veya varsayılan
    port: process.env.ETHEREAL_EMAIL_PORT || 587,
    secure: process.env.ETHEREAL_EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.ETHEREAL_EMAIL_USER, // .env dosyasından al
        pass: process.env.ETHEREAL_EMAIL_PASS  // .env dosyasından al
    },
});

// Helper function to generate recovery codes
const generateRecoveryCodes = async (count = 10) => {
    const codes = [];
    const hashedCodes = [];
    for (let i = 0; i < count; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase(); // Rastgele 8 karakterli kod
        const hashedCode = await bcrypt.hash(code, 10);
        codes.push(code);
        hashedCodes.push({ hashedCode, used: false });
    }
    return { codes, hashedCodes };
};

// 2FA'yı etkinleştirme/devre dışı bırakma ve QR kodu oluşturma rotası
router.post('/2fa/setup', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { enable } = req.body; // true veya false

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        if (enable) {
            // 2FA'yı etkinleştir
            const secret = speakeasy.generateSecret({ length: 10, name: `FingoApp (${user.email})` });
            const { codes, hashedCodes } = await generateRecoveryCodes(); // Kurtarma kodları oluştur

            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: {
                        is2FAEnabled: true,
                        twoFactorSecret: secret.base32,
                        recoveryCodes: hashedCodes // Hash'lenmiş kurtarma kodlarını kaydet
                    }}
            );
            res.status(200).json({
                message: '2FA etkinleştirildi. Lütfen QR kodunu tarayın ve ilk kodu doğrulayın.',
                secret: secret.base32,
                otpauthUrl: secret.otpauth_url,
                recoveryCodes: codes // Hash'lenmemiş kurtarma kodlarını frontend'e gönder
            });
        } else {
            // 2FA'yı devre dışı bırak
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { is2FAEnabled: false, twoFactorSecret: null, is2FAVerified: false, recoveryCodes: [] } } // Kurtarma kodlarını da temizle
            );
            res.status(200).json({ message: '2FA başarıyla devre dışı bırakıldı.' });
        }
    } catch (error) {
        console.error('2FA kurulum hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA kodunu doğrulama rotası (ilk kurulum veya ayarlar sayfasından doğrulama için)
router.post('/2fa/verify', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { token } = req.body; // Kullanıcının girdiği 2FA kodu

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA etkin değil veya gizli anahtar bulunamadı.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1 // 1 zaman adımı tolerans
        });

        if (verified) {
            // Doğrulama başarılıysa, kullanıcının oturumundaki 2FA durumunu güncelle
            // NOT: Bu sadece anlık oturum için, kalıcı bir değişiklik değil.
            // Kalıcı değişiklikler için login sırasında token'a is2FAVerified ekleyeceğiz.
            res.status(200).json({ message: '2FA kodu doğrulandı!', success: true });
        } else {
            res.status(401).json({ message: 'Geçersiz 2FA kodu.', success: false });
        }
    } catch (error) {
        console.error('2FA doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA kodu gönderme rotası (Giriş sırasında veya kod tekrar gönderme için)
router.post('/2fa/send-code', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const userEmail = req.user.email; // JWT'den gelen e-posta

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled) {
            return res.status(400).json({ message: 'Bu hesapta 2FA etkin değil.' });
        }

        // 6 haneli bir kod oluştur (e-posta için)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Kodu kullanıcının veritabanı kaydına geçici olarak kaydet
        // ve bir süre sonra (örn. 5 dakika) geçerliliğini yitirmesi için bir zaman damgası ekle
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { current2FACode: verificationCode, twoFACodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000) } } // 5 dakika geçerli
        );

        // E-posta gönderme mantığı (şimdilik konsola yazdırıyoruz)
        const mailOptions = {
            from: process.env.EMAIL_USER, // Gönderen e-posta adresi
            to: userEmail, // Kullanıcının e-posta adresi
            subject: 'Fingo - İki Faktörlü Kimlik Doğrulama Kodunuz',
            html: `<p>Merhaba,</p>
                   <p>Fingo hesabınız için iki faktörlü kimlik doğrulama kodunuz: <strong>${verificationCode}</strong></p>
                   <p>Bu kod 5 dakika içinde sona erecektir. Eğer bu isteği siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
                   <p>Saygılarımızla,<br>Fingo Ekibi</p>`
        };

        // Gerçek e-posta göndermek yerine konsola yazdır
        console.log(`\n--- 2FA Kodu (${userEmail}) ---`);
        console.log(`Kod: ${verificationCode}`);
        console.log(`Geçerlilik: 5 dakika`);
        console.log(`--- 2FA Kodu Sonu ---\n`);

        // Eğer gerçek e-posta göndermek istersen:
        /*
        await transporter.sendMail(mailOptions);
        console.log('E-posta başarıyla gönderildi.');
        */

        res.status(200).json({ message: 'Doğrulama kodu e-postanıza gönderildi.', success: true });

    } catch (error) {
        console.error('2FA kodu gönderme hatası:', error);
        res.status(500).json({ message: 'Doğrulama kodu gönderilirken bir hata oluştu.' });
    }
});

// 2FA kodunu doğrulama rotası (Giriş akışı için)
router.post('/2fa/verify-login-code', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { code } = req.body; // Kullanıcının girdiği 2FA kodu

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled || !user.current2FACode || !user.twoFACodeExpiresAt) {
            return res.status(400).json({ message: 'Doğrulama kodu bulunamadı veya 2FA etkin değil.' });
        }

        if (new Date() > new Date(user.twoFACodeExpiresAt)) {
            // Süresi dolmuşsa kodu temizle
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { current2FACode: null, twoFACodeExpiresAt: null } }
            );
            return res.status(401).json({ message: '2FA kodu süresi doldu. Lütfen yeni bir kod isteyin.' });
        }

        if (code === user.current2FACode) {
            // Kod doğruysa, kullanıcının oturumundaki JWT'yi güncelle
            // Yeni bir JWT oluştur ve is2FAVerified: true olarak işaretle
            const newToken = jwt.sign(
                { userId: user._id.toString(), email: user.email, is2FAEnabled: user.is2FAEnabled, is2FAVerified: true },
                process.env.JWT_SECRET,
                { expiresIn: '1h' } // Token 1 saat geçerli
            );

            // Kullanılan kodu temizle
            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { current2FACode: null, twoFACodeExpiresAt: null, is2FAVerified: true } } // Veritabanında da doğrulanmış olarak işaretle
            );

            res.status(200).json({
                message: '2FA doğrulama başarılı!',
                success: true,
                token: newToken,
                userId: user._id.toString(),
                email: user.email
            });
        } else {
            res.status(401).json({ message: 'Geçersiz 2FA kodu.', success: false });
        }
    } catch (error) {
        console.error('2FA giriş kodu doğrulama hatası:', error);
        res.status(500).json({ message: 'Doğrulama sırasında bir hata oluştu.' });
    }
});

// Kurtarma kodu doğrulama rotası
router.post('/2fa/verify-recovery-code', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { recoveryCode } = req.body;

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled || !user.recoveryCodes || !Array.isArray(user.recoveryCodes)) {
            return res.status(400).json({ message: 'Kurtarma kodları etkin değil veya bulunamadı.' });
        }

        // Kurtarma kodunu bul ve kullanıldı olarak işaretle
        // Kurtarma kodları hash'li olduğu için her birini tek tek karşılaştır
        let foundIndex = -1;
        for (let i = 0; i < user.recoveryCodes.length; i++) {
            const rc = user.recoveryCodes[i];
            if (!rc.used && await bcrypt.compare(recoveryCode, rc.hashedCode)) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex === -1) {
            return res.status(401).json({ message: 'Geçersiz veya zaten kullanılmış kurtarma kodu.', success: false });
        }

        // Kurtarma kodunu kullanıldı olarak işaretle
        user.recoveryCodes[foundIndex].used = true;
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { recoveryCodes: user.recoveryCodes } }
        );

        // Yeni bir JWT oluştur ve is2FAVerified: true olarak işaretle
        const newToken = jwt.sign(
            { userId: user._id.toString(), email: user.email, is2FAEnabled: user.is2FAEnabled, is2FAVerified: true },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Kurtarma kodu doğrulandı! Giriş başarılı.',
            success: true,
            token: newToken,
            userId: user._id.toString(),
            email: user.email
        });

    } catch (error) {
        console.error('Kurtarma kodu doğrulama hatası:', error);
        res.status(500).json({ message: 'Kurtarma kodu doğrulanırken bir hata oluştu.' });
    }
});

// Yeni kurtarma kodları oluşturma rotası (Mevcut 2FA'yı doğruladıktan sonra)
router.post('/2fa/generate-new-recovery-codes', authenticateToken, verify2FA, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user || !user.is2FAEnabled) {
            return res.status(400).json({ message: '2FA etkin değil veya kullanıcı bulunamadı.' });
        }

        const { codes, hashedCodes } = await generateRecoveryCodes(); // Yeni kurtarma kodları oluştur

        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { recoveryCodes: hashedCodes } } // Eski kodları yenileriyle değiştir
        );

        res.status(200).json({
            message: 'Yeni kurtarma kodları başarıyla oluşturuldu. Lütfen bunları güvenli bir yere kaydedin.',
            recoveryCodes: codes // Hash'lenmemiş kodları döndür
        });

    } catch (error) {
        console.error('Yeni kurtarma kodları oluşturma hatası:', error);
        res.status(500).json({ message: 'Yeni kurtarma kodları oluşturulurken bir hata oluştu.' });
    }
});


module.exports = router;
