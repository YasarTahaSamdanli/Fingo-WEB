// utils/emailSender.js
const nodemailer = require('nodemailer');

// Nodemailer transporter (e-posta gönderimi için)
// Kendi SMTP ayarlarınızı buraya girin veya .env'den çekin
// ÖNEMLİ: Gmail için uygulama şifresi kullanmanız gerekebilir.
// https://support.google.com/accounts/answer/185833?hl=tr adresini kontrol edin.
const transporter = nodemailer.createTransport({
    service: 'gmail', // veya 'outlook', 'hotmail' vb.
    auth: {
        user: process.env.EMAIL_USER, // .env dosyanızda tanımlayın (örn: fingo.app.dev@gmail.com)
        pass: process.env.EMAIL_PASS  // .env dosyanızda tanımlayın (örn: Gmail uygulama şifresi)
    }
});

/**
 * Kullanıcıya e-posta doğrulama linki gönderir.
 * @param {string} email - Doğrulama e-postasının gönderileceği adres.
 * @param {string} token - Doğrulama için kullanılacak benzersiz token.
 */
async function sendVerificationEmail(email, token) {
    // Doğrulama linki, Render backend'inin URL'si olmalı
    const verificationLink = `https://fingo-web.onrender.com/api/verify-email?token=${token}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Fingo - E-posta Adresinizi Doğrulayın',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #0056b3;">Fingo E-posta Doğrulama</h2>
                <p>Merhaba,</p>
                <p>Fingo hesabınızı oluşturduğunuz için teşekkür ederiz. Hesabınızı aktif hale getirmek için lütfen aşağıdaki linke tıklayın:</p>
                <p style="text-align: center; margin: 20px 0;">
                    <a href="${verificationLink}" style="background-color: #3B82F6; color: white; padding: 12px 25px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
                        E-postayı Doğrula
                    </a>
                </p>
                <p>Bu link 24 saat boyunca geçerlidir. Eğer bu işlemi siz yapmadıysanız, lütfen bu e-postayı dikkate almayın.</p>
                <p>Teşekkürler,<br>Fingo Ekibi</p>
                <br>
                <p style="font-size: 0.8em; color: #666;">Not: Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Doğrulama e-postası ${email} adresine gönderildi.`);
    } catch (error) {
        console.error(`Doğrulama e-postası gönderilirken hata oluştu (${email}):`, error);
        throw new Error('Doğrulama e-postası gönderilemedi.');
    }
}

module.exports = { sendVerificationEmail };

/**
 * Düşük stok uyarı e-postası gönderir.
 * @param {string} email - Alıcı e-posta adresi
 * @param {{ productName: string, newQuantity: number, minStockLevel?: number, unit?: string }} params
 */
async function sendLowStockEmail(email, { productName, newQuantity, minStockLevel, unit }) {
    const threshold = Number(minStockLevel ?? 10);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Düşük Stok Uyarısı: ${productName}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #EF4444;">Düşük Stok Uyarısı</h2>
                <p><strong>${productName}</strong> ürününün stoğu eşik değerinin altına düştü.</p>
                <ul>
                    <li>Mevcut Stok: <strong>${newQuantity} ${unit || ''}</strong></li>
                    <li>Eşik Değer: <strong>${threshold}</strong></li>
                </ul>
                <p>Stokları kontrol etmeniz tavsiye edilir.</p>
                <p style="font-size: 12px; color: #666;">Bu mesaj otomatik gönderilmiştir.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Düşük stok e-postası ${email} adresine gönderildi.`);
    } catch (error) {
        console.error(`Düşük stok e-postası gönderilemedi (${email}):`, error);
        throw new Error('Düşük stok e-postası gönderilemedi.');
    }
}

module.exports = { sendVerificationEmail, sendLowStockEmail };