// middleware/roleMiddleware.js
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

// Kullanıcı rolleri
const ROLES = {
    ADMIN: 'admin',           // Patron - Tüm yetkilere sahip
    MANAGER: 'manager',       // Yönetici - Çoğu yetkiye sahip
    CASHIER: 'cashier',       // Kasiyer - Satış ve temel işlemler
    STAFF: 'staff'            // Çalışan - Sınırlı yetkiler
};

// Rol bazlı yetkiler
const PERMISSIONS = {
    [ROLES.ADMIN]: [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'product:create', 'product:read', 'product:update', 'product:delete',
        'sale:create', 'sale:read', 'sale:update', 'sale:delete',
        'supplier:create', 'supplier:read', 'supplier:update', 'supplier:delete',
        'customer:create', 'customer:read', 'customer:update', 'customer:delete',
        'transaction:create', 'transaction:read', 'transaction:update', 'transaction:delete',
        'report:read', 'financial:read', 'settings:update'
    ],
    [ROLES.MANAGER]: [
        'user:read', 'user:update',
        'product:create', 'product:read', 'product:update',
        'sale:create', 'sale:read', 'sale:update',
        'supplier:create', 'supplier:read', 'supplier:update',
        'customer:create', 'customer:read', 'customer:update',
        'transaction:create', 'transaction:read', 'transaction:update',
        'report:read', 'financial:read'
    ],
    [ROLES.CASHIER]: [
        'product:read',
        'sale:create', 'sale:read',
        'customer:read',
        'transaction:create', 'transaction:read'
    ],
    [ROLES.STAFF]: [
        'product:read',
        'sale:read',
        'customer:read',
        'transaction:read'
    ]
};

// Rol kontrolü middleware'i
const checkRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.userId) {
                return res.status(401).json({ message: 'Kimlik doğrulama gerekli.' });
            }

            const db = getDb();
            const user = await db.collection('users').findOne(
                { _id: new ObjectId(req.user.userId) },
                { projection: { role: 1 } }
            );

            if (!user) {
                return res.status(404).json({ message: 'Kullanıcı bulunamadı.' });
            }

            if (!user.role) {
                return res.status(403).json({ message: 'Kullanıcı rolü tanımlanmamış.' });
            }

            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({ 
                    message: 'Bu işlem için yetkiniz bulunmuyor.',
                    requiredRole: allowedRoles,
                    userRole: user.role
                });
            }

            req.userRole = user.role;
            next();
        } catch (error) {
            console.error('Rol kontrolü hatası:', error);
            res.status(500).json({ message: 'Sunucu hatası.' });
        }
    };
};

// Yetki kontrolü middleware'i
const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.userId) {
                return res.status(401).json({ message: 'Kimlik doğrulama gerekli.' });
            }

            const db = getDb();
            const user = await db.collection('users').findOne(
                { _id: new ObjectId(req.user.userId) },
                { projection: { role: 1 } }
            );

            if (!user || !user.role) {
                return res.status(403).json({ message: 'Kullanıcı rolü tanımlanmamış.' });
            }

            const userPermissions = PERMISSIONS[user.role] || [];
            
            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({ 
                    message: 'Bu işlem için yetkiniz bulunmuyor.',
                    requiredPermission,
                    userRole: user.role
                });
            }

            next();
        } catch (error) {
            console.error('Yetki kontrolü hatası:', error);
            res.status(500).json({ message: 'Sunucu hatası.' });
        }
    };
};

// Admin rolü kontrolü
const requireAdmin = checkRole([ROLES.ADMIN]);

// Yönetici ve üzeri rol kontrolü
const requireManager = checkRole([ROLES.ADMIN, ROLES.MANAGER]);

// Kasiyer ve üzeri rol kontrolü
const requireCashier = checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER]);

// Tüm kullanıcılar için
const requireAuth = checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER, ROLES.STAFF]);

module.exports = {
    ROLES,
    PERMISSIONS,
    checkRole,
    checkPermission,
    requireAdmin,
    requireManager,
    requireCashier,
    requireAuth
};
