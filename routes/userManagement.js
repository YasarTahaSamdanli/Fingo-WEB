// routes/userManagement.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireManager, checkPermission } = require('../middleware/roleMiddleware');

const router = express.Router();

// Tüm kullanıcıları listele (SADECE kendi organizasyonundaki aktif kullanıcılar)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Debug: req.user bilgilerini logla
        console.log("req.user bilgileri:", req.user);
        console.log("req.user.organizationId:", req.user.organizationId);
        
        const db = getDb();
        const users = await db.collection('users').find(
            { 
                organizationId: req.user.organizationId, // Sadece kendi organizasyonundaki kullanıcılar
                isActive: true // Sadece aktif kullanıcılar
            },
            { projection: { password: 0, twoFactorSecret: 0, recoveryCodes: 0, verificationToken: 0, verificationTokenExpires: 0 } }
        ).toArray();

        res.status(200).json(users);
    } catch (error) {
        console.error('Kullanıcı listesi hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Yeni kullanıcı oluştur (Sadece kendi organizasyonunda)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    const { email, password, firstName, lastName, role, phone, department } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ message: 'E-posta, şifre, ad, soyad ve rol gerekli.' });
    }

    try {
        const db = getDb();
        
        // E-posta kontrolü (sadece kendi organizasyonunda)
        const existingUser = await db.collection('users').findOne({ 
            email, 
            organizationId: req.user.organizationId 
        });
        if (existingUser) {
            return res.status(409).json({ message: 'Bu e-posta adresi zaten organizasyonunuzda kayıtlı.' });
        }

        // Şifre hash'leme
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
            organizationId: req.user.organizationId, // Admin'in organizasyon ID'si
            phone: phone || '',
            department: department || '',
            isActive: true,
            is2FAEnabled: false,
            twoFactorSecret: null,
            is2FAVerified: false,
            isVerified: true, // Admin tarafından oluşturulan kullanıcılar otomatik doğrulanmış
            createdAt: new Date(),
            createdBy: req.user.userId,
            lastLogin: null,
            isOrganizationAdmin: false, // Yeni kullanıcılar organizasyon admini değil
            isInvited: true, // Davet edilmiş kullanıcı
            inviteDate: new Date()
        };

        const result = await db.collection('users').insertOne(newUser);
        
        // Organizasyon bilgisini al
        const organization = await db.collection('organizations').findOne({ 
            organizationId: req.user.organizationId 
        });

        // Davet e-postası gönder
        try {
            const { sendInviteEmail } = require('../utils/emailSender');
            await sendInviteEmail(email, {
                firstName: firstName,
                lastName: lastName,
                role: role,
                organizationName: organization ? organization.name : 'Organizasyon',
                password: password, // Şifreyi e-postada gönder
                adminEmail: req.user.email
            });
        } catch (emailError) {
            console.error('Davet e-postası gönderilemedi:', emailError);
            // E-posta gönderilemese bile kullanıcı oluşturulur
        }
        
        // Şifre olmadan kullanıcı bilgilerini döndür
        const { password: _, ...userWithoutPassword } = newUser;
        userWithoutPassword._id = result.insertedId;

        res.status(201).json({
            message: 'Kullanıcı başarıyla oluşturuldu ve davet e-postası gönderildi.',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Kullanıcı oluşturma hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcı güncelle (Admin ve Manager - kendi organizasyonunda ve kendi rollerini değiştiremez)
router.put('/users/:userId', authenticateToken, requireManager, async (req, res) => {
    const { userId } = req.params;
    const { firstName, lastName, role, phone, department, isActive } = req.body;

    try {
        const db = getDb();
        
        // Kullanıcıyı bul (sadece kendi organizasyonunda)
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(userId),
            organizationId: req.user.organizationId
        });
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // Manager kendi rolünü değiştiremez
        if (req.userRole === 'manager' && user.role === 'admin') {
            return res.status(403).json({ message: 'Admin rolünü değiştirme yetkiniz bulunmuyor.' });
        }

        // Organizasyon admini rolünü değiştiremez
        if (user.isOrganizationAdmin) {
            return res.status(403).json({ message: 'Organizasyon admini rolü değiştirilemez.' });
        }

        // Güncelleme verilerini hazırla
        const updateData = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            role: role || user.role,
            phone: phone !== undefined ? phone : user.phone,
            department: department !== undefined ? department : user.department,
            isActive: isActive !== undefined ? isActive : user.isActive,
            updatedAt: new Date(),
            updatedBy: req.user.userId
        };

        // Güncelleme işlemi
        await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );

        res.status(200).json({ message: 'Kullanıcı başarıyla güncellendi.' });
    } catch (error) {
        console.error('Kullanıcı güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcı şifresini sıfırla (Sadece Admin)
router.post('/users/:userId/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({ message: 'Yeni şifre gerekli.' });
    }

    try {
        const db = getDb();
        
        // Şifre hash'leme
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    password: hashedPassword,
                    updatedAt: new Date(),
                    updatedBy: req.user.userId
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json({ message: 'Şifre başarıyla sıfırlandı.' });
    } catch (error) {
        console.error('Şifre sıfırlama hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcıyı devre dışı bırak/etkinleştir (Admin ve Manager)
router.patch('/users/:userId/toggle-status', authenticateToken, requireManager, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDb();
        
        // Kullanıcıyı bul
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // Manager admin'i devre dışı bırakamaz
        if (req.userRole === 'manager' && user.role === 'admin') {
            return res.status(403).json({ message: 'Admin kullanıcısını devre dışı bırakma yetkiniz bulunmuyor.' });
        }

        const newStatus = !user.isActive;
        
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    isActive: newStatus,
                    updatedAt: new Date(),
                    updatedBy: req.user.userId
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        const statusText = newStatus ? 'etkinleştirildi' : 'devre dışı bırakıldı';
        res.status(200).json({ message: `Kullanıcı başarıyla ${statusText}.` });
    } catch (error) {
        console.error('Kullanıcı durumu değiştirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcıyı sil (Sadece kendi organizasyonunda)
router.delete('/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDb();
        
        // Kullanıcıyı bul (sadece kendi organizasyonunda)
        const user = await db.collection('users').findOne({ 
            _id: new ObjectId(userId),
            organizationId: req.user.organizationId
        });
        
        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        // Organizasyon admini silinemez
        if (user.isOrganizationAdmin) {
            return res.status(403).json({ message: 'Organizasyon admini silinemez.' });
        }

        // Kendini silmeye çalışıyorsa engelle
        if (userId === req.user.userId) {
            return res.status(403).json({ message: 'Kendinizi silemezsiniz.' });
        }

        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
        res.status(200).json({ message: 'Kullanıcı başarıyla silindi.' });
    } catch (error) {
        console.error('Kullanıcı silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcı detaylarını getir (sadece kendi organizasyonunda)
router.get('/users/:userId', authenticateToken, requireManager, async (req, res) => {
    const { userId } = req.params;

    try {
        const db = getDb();
        const user = await db.collection('users').findOne(
            { 
                _id: new ObjectId(userId),
                organizationId: req.user.organizationId // Sadece kendi organizasyonundaki kullanıcı
            },
            { projection: { password: 0, twoFactorSecret: 0, recoveryCodes: 0, verificationToken: 0, verificationTokenExpires: 0 } }
        );

        if (!user) {
            return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Kullanıcı detay hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Kullanıcı istatistiklerini getir (SADECE Admin - kendi organizasyonunda)
router.get('/users/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const db = getDb();
        
        // Sadece kendi organizasyonundaki kullanıcıları say
        const stats = await db.collection('users').aggregate([
            {
                $match: { organizationId: req.user.organizationId } // Sadece kendi organizasyonu
            },
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 },
                    activeCount: {
                        $sum: { $cond: ['$isActive', 1, 0] }
                    }
                }
            }
        ]).toArray();

        const totalUsers = await db.collection('users').countDocuments({ organizationId: req.user.organizationId });
        const activeUsers = await db.collection('users').countDocuments({ 
            organizationId: req.user.organizationId, 
            isActive: true 
        });

        res.status(200).json({
            totalUsers,
            activeUsers,
            inactiveUsers: totalUsers - activeUsers,
            roleBreakdown: stats
        });
    } catch (error) {
        console.error('Kullanıcı istatistik hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

// Organizasyon bilgilerini getir
router.get('/organization', authenticateToken, async (req, res) => {
    try {
        const db = getDb();
        const organization = await db.collection('organizations').findOne({ 
            organizationId: req.user.organizationId 
        });
        
        if (!organization) {
            return res.status(404).json({ message: 'Organizasyon bulunamadı.' });
        }

        res.status(200).json(organization);
    } catch (error) {
        console.error('Organizasyon bilgisi hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});

module.exports = router;
