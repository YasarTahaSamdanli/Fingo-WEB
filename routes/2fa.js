// routes/2fa.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer'); // E-posta gönderimi için
const jwt = require('jsonwebtoken'); // JWT için ekledik

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
        const secret = speakeasy.generateSecret({ length: 20 });

        // Gizli anahtarı veritabanına kaydet
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { twoFactorSecret: secret, is2FAEnabled: false } } // Henüz etkin değil
        );

        // QR kod için URL oluştur
        const otpauthUrl = speakeasy.otpauthURL({
            secret: secret.ascii,
            issuer: 'Fingo',
            label: user.email,
        });

        // QR kodu veri URL'si olarak döndür
        QRCode.toDataURL(otpauthUrl, (err, data_url) => {
            if (err) {
                console.error('QR kod oluşturma hatası:', err);
                return res.status(500).json({ message: 'QR kod oluşturulurken hata oluştu.' });
            }
            res.status(200).json({ secret: secret.base32, otpauthUrl: data_url, message: '2FA gizli anahtarı oluşturuldu.' });
        });

    } catch (error) {
        console.error('2FA gizli anahtar oluşturma hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Etkinleştirme Doğrulama Rotası (QR kodu okunduktan sonra)
router.post('/2fa/verify-enable', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { token } = req.body; // Kullanıcının girdiği 2FA kodu

    if (!token) {
        return res.status(400).json({ message: 'Doğrulama kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        if (!user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA gizli anahtarı bulunamadı. Lütfen önce oluşturun.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret.base32,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            // 2FA'yı etkinleştir ve kurtarma kodları oluştur
            const recoveryCodes = [];
            for (let i = 0; i < 5; i++) {
                recoveryCodes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
            }

            await db.collection('users').updateOne(
                { _id: new ObjectId(userId) },
                { $set: { is2FAEnabled: true, recoveryCodes: recoveryCodes } }
            );

            res.status(200).json({ message: '2FA başarıyla etkinleştirildi!', recoveryCodes: recoveryCodes });
        } else {
            res.status(400).json({ message: 'Geçersiz doğrulama kodu.' });
        }
    } catch (error) {
        console.error('2FA etkinleştirme doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Giriş Kodu Doğrulama Rotası
router.post('/2fa/verify-login-code', async (req, res) => {
    const { email, token } = req.body; // 'token' burada kullanıcının girdiği 2FA kodudur
    if (!email || !token) {
        return res.status(400).json({ message: 'E-posta ve kod gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        if (!user.is2FAEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ message: 'Bu kullanıcı için 2FA etkin değil.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret.base32,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            // 2FA doğrulandıktan sonra YENİ bir JWT token oluştur
            const newJwtToken = jwt.sign(
                { userId: user._id.toString(), email: user.email, is2FAEnabled: true, is2FAVerified: true },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            // Başarılı doğrulama
            res.status(200).json({
                message: '2FA kodu başarıyla doğrulandı.',
                is2FAVerified: true,
                token: newJwtToken, // YENİ OLUŞTURULAN TOKEN'I GÖNDERİYORUZ
                userId: user._id.toString(), // user ID'yi de gönderiyoruz
                email: user.email // email'i de gönderiyoruz
            });
        } else {
            res.status(400).json({ message: 'Geçersiz 2FA kodu.' });
        }
    } catch (error) {
        console.error('2FA giriş kodu doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Kurtarma Kodu Doğrulama Rotası
router.post('/2fa/verify-recovery-code', async (req, res) => {
    const { email, recoveryCode } = req.body;
    if (!email || !recoveryCode) {
        return res.status(400).json({ message: 'E-posta ve kurtarma kodu gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        if (!user.is2FAEnabled || !user.recoveryCodes || !user.recoveryCodes.length) {
            return res.status(400).json({ message: 'Bu kullanıcı için kurtarma kodları etkin değil veya mevcut değil.' });
        }

        const codeIndex = user.recoveryCodes.indexOf(recoveryCode);
        if (codeIndex > -1) {
            // Kodu kullanıldı olarak işaretle (sil veya başka bir şekilde yönet)
            user.recoveryCodes.splice(codeIndex, 1); // Kullanılan kodu listeden çıkar
            await db.collection('users').updateOne(
                { _id: new ObjectId(user._id) },
                { $set: { recoveryCodes: user.recoveryCodes } }
            );

            // Başarılı doğrulama sonrası YENİ bir JWT token oluştur
            const newJwtToken = jwt.sign(
                { userId: user._id.toString(), email: user.email, is2FAEnabled: true, is2FAVerified: true },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(200).json({
                message: 'Kurtarma kodu başarıyla doğrulandı.',
                is2FAVerified: true,
                token: newJwtToken, // YENİ OLUŞTURULAN TOKEN'I GÖNDERİYORUZ
                userId: user._id.toString(), // user ID'yi de gönderiyoruz
                email: user.email // email'i de gönderiyoruz
            });
        } else {
            res.status(400).json({ message: 'Geçersiz kurtarma kodu.' });
        }
    } catch (error) {
        console.error('Kurtarma kodu doğrulama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// 2FA Kodu Gönderme Rotası (E-posta ile)
router.post('/2fa/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: 'E-posta adresi gerekli.' });
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }
        if (!user.is2FAEnabled || !user.twoFactorSecret) {
            return res.status(400).json({ message: 'Bu kullanıcı için 2FA etkin değil.' });
        }

        // Yeni bir 2FA kodu oluştur
        const token = speakeasy.totp({
            secret: user.twoFactorSecret.base32,
            encoding: 'base32',
            step: 30, // 30 saniyede bir değişir
            window: 1 // +/- 1 pencereye izin ver (yani 90 saniye geçerlilik)
        });

        console.log(`2FA Kodu (${email} için): ${token}`); // Kodu logla

        // E-posta gönderme kısmı (geçici olarak yorum satırı yapıldı)
        // const mailOptions = {
        //     from: process.env.EMAIL_USER,
        //     to: email,
        //     subject: 'Fingo - İki Faktörlü Kimlik Doğrulama Kodunuz',
        //     html: `
        //         <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        //             <h2 style="color: #0056b3;">Fingo İki Faktörlü Kimlik Doğrulama</h2>
        //             <p>Merhaba,</p>
        //             <p>Giriş yapmak için aşağıdaki doğrulama kodunu kullanın:</p>
        //             <h3 style="color: #0056b3; font-size: 24px; font-weight: bold;">${token}</h3>
        //             <p>Bu kod <strong>90 saniye</strong> boyunca geçerlidir. Eğer bu işlemi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
        //             <p>Teşekkürler,<br>Fingo Ekibi</p>
        //         </div>
        //     `
        // };

        // transporter.sendMail(mailOptions, (error, info) => {
        //     if (error) {
        //         console.error('E-posta gönderme hatası:', error);
        //         return res.status(500).json({ message: 'Doğrulama kodu gönderilirken hata oluştu.' });
        //     }
        //     console.log('E-posta gönderildi:', info.response);
        //     res.status(200).json({ message: 'Doğrulama kodu e-posta adresinize gönderildi.' });
        // });

        // E-posta gönderme kısmı yorum satırı olduğu için direkt başarılı yanıt dönüyoruz
        res.status(200).json({ message: 'Doğrulama kodu oluşturuldu ve konsolda gösterildi.' });


    } catch (error) {
        console.error('2FA kodu gönderme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Şifre Değiştirme Rotası (users.js'den buraya taşınabilir veya ayrı bir dosyada kalabilir)
const bcrypt = require('bcryptjs'); // bcryptjs'i de buraya ekledik
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
