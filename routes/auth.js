// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb'); // ObjectId'yi ekledik
const { sendVerificationEmail } = require('../utils/emailSender'); // Yeni e-posta gönderme yardımcı fonksiyonunu içe aktarıyoruz
const crypto = require('crypto'); // Token oluşturmak için

const router = express.Router();

// Kullanıcı Kayıt Rotası
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'E-posta ve şifre gerekli.' });
    }

    try {
        const db = getDb();
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex'); // Rastgele token oluştur
        const verificationTokenExpires = new Date(Date.now() + 24 * 3600 * 1000); // 24 saat geçerli

        const newUser = {
            email,
            password: hashedPassword,
            is2FAEnabled: false,
            twoFactorSecret: null,
            is2FAVerified: false, // Oturum bazında 2FA doğrulaması
            isVerified: false, // E-posta doğrulaması için yeni alan, varsayılan olarak false
            verificationToken: verificationToken,
            verificationTokenExpires: verificationTokenExpires,
            createdAt: new Date()
        };
        await db.collection('users').insertOne(newUser);

        // Doğrulama e-postasını gönder
        await sendVerificationEmail(email, verificationToken);

        res.status(201).json({ message: 'Kullanıcı başarıyla kaydedildi. Lütfen e-posta adresinizi doğrulayın.' });
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
        const db = getDb();
        const user = await db.collection('users').findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Geçersiz kimlik bilgileri.' });
        }

        // DÜZELTME: E-posta doğrulaması kontrolü
        if (!user.isVerified) {
            return res.status(403).json({ message: 'E-posta adresiniz doğrulanmamış. Lütfen e-postanızı kontrol edin.' });
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

        // Eğer 2FA etkinse, kullanıcıya 2FA yapması gerektiğini bildir
        if (user.is2FAEnabled) {
            // is2FAVerified: false olarak ayarla, 2FA doğrulaması bekleniyor
            return res.status(403).json({ message: '2FA gerekli.', token, userId: user._id.toString() });
        }

        res.status(200).json({ message: 'Giriş başarılı.', token, userId: user._id.toString() });
    } catch (error) {
        console.error('Giriş hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// E-posta Doğrulama Rotası
router.get('/verify-email', async (req, res) => {
    const { token } = req.query; // URL'den token'ı alıyoruz

    if (!token) {
        return res.status(400).send('Geçersiz doğrulama linki.');
    }

    try {
        const db = getDb();
        const user = await db.collection('users').findOne({ verificationToken: token });

        if (!user) {
            return res.status(400).send('Geçersiz veya süresi dolmuş doğrulama tokenı.');
        }

        if (user.verificationTokenExpires < new Date()) {
            // Token süresi dolmuşsa, yeni bir token oluşturma ve tekrar e-posta gönderme seçeneği sunabiliriz
            return res.status(400).send('Doğrulama tokenının süresi dolmuş. Lütfen tekrar kayıt olmayı deneyin veya yeni bir doğrulama e-postası talep edin.');
        }

        // Kullanıcıyı doğrula ve token alanlarını temizle
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { isVerified: true }, $unset: { verificationToken: "", verificationTokenExpires: "" } }
        );

        // Başarılı doğrulama sonrası kullanıcıyı giriş sayfasına yönlendir
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>E-posta Doğrulama Başarılı</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: 'Inter', sans-serif; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
                    .container { background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); text-align: center; max-width: 500px; width: 90%; }
                    h1 { color: #22C55E; font-size: 2rem; font-weight: bold; margin-bottom: 20px; }
                    p { color: #4B5563; font-size: 1rem; margin-bottom: 20px; }
                    a { background-color: #3B82F6; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; transition: background-color 0.3s ease; }
                    a:hover { background-color: #2563EB; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ E-posta Doğrulama Başarılı!</h1>
                    <p>E-posta adresiniz başarıyla doğrulandı. Şimdi giriş yapabilirsiniz.</p>
                    <a href="https://yasartahasamdanli.github.io/Fingo-WEB/auth.html">Giriş Yapmak İçin Tıklayın</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('E-posta doğrulama hatası:', error);
        res.status(500).send('Sunucu hatası. Lütfen tekrar deneyin.');
    }
});


module.exports = router;
