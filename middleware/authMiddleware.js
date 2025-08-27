// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// JWT doğrulama middleware'i
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Erişim reddedildi. Token bulunamadı.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT doğrulama hatası:", err);
            return res.status(403).json({ message: 'Geçersiz veya süresi dolmuş token.' });
        }
        
        // Debug: Token'dan çıkarılan bilgileri logla
        console.log("JWT Token'dan çıkarılan bilgiler:", user);
        console.log("organizationId:", user.organizationId);
        
        req.user = user; // Token'dan çözülen kullanıcı bilgilerini req.user'a ata
        next();
    });
};

// 2FA doğrulama middleware'i
const verify2FA = (req, res, next) => {
    if (!req.user.is2FAVerified) {
        return res.status(403).json({ message: 'Bu işlem için 2FA doğrulaması gerekli.' });
    }
    next();
};

module.exports = {
    authenticateToken,
    verify2FA
};
