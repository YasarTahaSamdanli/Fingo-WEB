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

/**
 * Kullanıcıya davet e-postası gönderir (admin tarafından eklenen kullanıcılar için)
 * @param {string} email - Davet e-postasının gönderileceği adres
 * @param {Object} userData - Kullanıcı bilgileri
 */
async function sendInviteEmail(email, userData) {
    const { firstName, lastName, role, organizationName, password, adminEmail } = userData;
    
    // Rol Türkçe karşılıkları
    const roleNames = {
        'admin': 'Yönetici',
        'manager': 'Müdür',
        'cashier': 'Kasiyer',
        'staff': 'Çalışan'
    };

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `${organizationName} - Organizasyona Davet Edildiniz`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Organizasyona Davet Edildiniz!</h1>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">Merhaba ${firstName} ${lastName},</h2>
                    
                    <p><strong>${adminEmail}</strong> tarafından <strong>${organizationName}</strong> organizasyonuna davet edildiniz.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
                        <h3 style="margin-top: 0; color: #667eea;">📋 Hesap Bilgileriniz</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>E-posta:</strong> ${email}</li>
                            <li><strong>Şifre:</strong> <span style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</span></li>
                            <li><strong>Rol:</strong> ${roleNames[role] || role}</li>
                            <li><strong>Organizasyon:</strong> ${organizationName}</li>
                        </ul>
                    </div>
                    
                    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                        <h3 style="margin-top: 0; color: #28a745;">🚀 Nasıl Giriş Yaparsınız?</h3>
                        <ol>
                            <li>Fingo uygulamasına gidin</li>
                            <li>E-posta adresinizi girin: <strong>${email}</strong></li>
                            <li>Şifrenizi girin: <strong>${password}</strong></li>
                            <li>Giriş yapın ve çalışmaya başlayın!</li>
                        </ol>
                    </div>
                    
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://yasartahasamdanli.github.io/Fingo-WEB/auth.html" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                            🚀 Fingo'ya Git
                        </a>
                    </p>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                        <p style="margin: 0; color: #856404;"><strong>⚠️ Güvenlik Notu:</strong> Bu şifreyi kimseyle paylaşmayın. Giriş yaptıktan sonra şifrenizi değiştirmeniz önerilir.</p>
                    </div>
                    
                    <p>Herhangi bir sorunuz olursa, lütfen organizasyon yöneticinizle iletişime geçin.</p>
                    
                    <p>Teşekkürler,<br><strong>${organizationName} Ekibi</strong></p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.<br>
                        Fingo - Organizasyon Yönetim Sistemi
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Davet e-postası ${email} adresine gönderildi.`);
    } catch (error) {
        console.error(`Davet e-postası gönderilemedi (${email}):`, error);
        throw new Error('Davet e-postası gönderilemedi.');
    }
}

module.exports = { sendVerificationEmail, sendLowStockEmail, sendInviteEmail };