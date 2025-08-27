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

        const hashedPassword = await bcrypt.hash(password, 10); // Buradaki fazla ters eğik çizgi kaldırıldı
        const verificationToken = crypto.randomBytes(32).toString('hex'); // Rastgele token oluştur
        const verificationTokenExpires = new Date(Date.now() + 24 * 3600 * 1000); // 24 saat geçerli

        // Her yeni kullanıcı admin olsun
        const newUser = {
            email,
            password: hashedPassword,
            firstName: '',
            lastName: '',
            role: 'admin', // Her yeni kullanıcı admin
            phone: '',
            department: '',
            isActive: true,
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

        res.status(201).json({ 
            message: 'Admin rolü ile kullanıcı başarıyla kaydedildi. Lütfen e-posta adresinizi doğrulayın.',
            isAdmin: true
        });
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

        // JWT payload'ına 2FA durumunu ve rol bilgisini ekle
        const token = jwt.sign(
            { 
                userId: user._id.toString(), 
                email: user.email, 
                role: user.role || 'staff', // Role yoksa default 'staff'
                is2FAEnabled: user.is2FAEnabled, 
                is2FAVerified: false 
            },
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

        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Fingo - E-posta Doğrulama Başarılı</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                    body {
                        font-family: 'Inter', sans-serif;
                        background: linear-gradient(135deg, #e0f2f7 0%, #c1e4ee 100%);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }
                    .card {
                        background-color: white;
                        padding: 40px;
                        border-radius: 12px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        max-width: 500px;
                        width: 100%;
                        transform: translateY(0);
                        transition: transform 0.5s ease-out;
                    }
                    .card.animate {
                        animation: fadeInScale 0.6s ease-out forwards;
                    }
                    @keyframes fadeInScale {
                        from { opacity: 0; transform: scale(0.9) translateY(20px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    .icon-circle {
                        display: inline-flex;
                        justify-content: center;
                        align-items: center;
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        background-color: #d1fae5; /* Tailwind green-100 */
                        color: #059669; /* Tailwind green-600 */
                        font-size: 3rem;
                        margin-bottom: 25px;
                    }
                    h1 {
                        color: #10B981; /* Tailwind green-500 */
                        font-size: 2.25rem; /* text-4xl */
                        font-weight: 700; /* font-bold */
                        margin-bottom: 15px;
                    }
                    p {
                        color: #4B5563; /* Tailwind gray-600 */
                        font-size: 1.125rem; /* text-lg */
                        margin-bottom: 30px;
                        line-height: 1.8;
                    }
                    .button {
                        background-color: #3B82F6; /* Tailwind blue-500 */
                        color: white;
                        padding: 14px 28px;
                        border-radius: 8px;
                        text-decoration: none;
                        font-weight: 600; /* font-semibold */
                        transition: background-color 0.3s ease, transform 0.2s ease;
                        display: inline-block;
                        box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
                    }
                    .button:hover {
                        background-color: #2563EB; /* Tailwind blue-600 */
                        transform: translateY(-2px);
                        box-shadow: 0 6px 15px rgba(59, 130, 246, 0.4);
                    }
                    .button:active {
                        transform: translateY(0);
                        box-shadow: 0 2px 5px rgba(59, 130, 246, 0.2);
                    }
                </style>
            </head>
            <body>
                <div id="successCard" class="card">
                    <div class="icon-circle">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h1>E-posta Doğrulama Başarılı!</h1>
                    <p>E-posta adresiniz başarıyla doğrulandı. Artık Fingo hesabınıza güvenle giriş yapabilirsiniz.</p>
                    <a href="https://yasartahasamdanli.github.io/Fingo-WEB/auth.html" class="button">Giriş Yapmak İçin Tıklayın</a>
                </div>
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const successCard = document.getElementById('successCard');
                        // Sayfa yüklendiğinde kartı animasyonla göster
                        setTimeout(() => {
                            successCard.classList.add('animate');
                        }, 100); // Küçük bir gecikme ekleyelim
                    });
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('E-posta doğrulama hatası:', error);
        res.status(500).send('Sunucu hatası. Lütfen tekrar deneyin.');
    }
});


module.exports = router;
