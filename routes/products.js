// routes/products.js
const express = require('express');
const { ObjectId } = require('mongodb'); // ObjectId'yi hala kullanıyoruz (_id alanları için)
const { getDb } = require('../db');
const { sendLowStockEmail } = require('../utils/emailSender');
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni Ürün Ekleme Rotası
router.post('/products', authenticateToken, async (req, res) => {
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, minStockLevel, imageUrl, description } = req.body;
    const userId = req.user.userId; // JWT'den gelen userId string formatında
    const organizationId = req.user.organizationId; // Organizasyon ID'si

    if (!name || price === undefined || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Ürün adı, fiyat, miktar ve birim gereklidir.' });
    }

    try {
        const db = getDb();
        const newProduct = {
            userId: userId,
            organizationId: organizationId, // Organizasyon ID'si ekle
            name,
            category: category || null,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            unit,
            barcode: barcode || null,
            weightOrVolumePerUnit: (weightOrVolumePerUnit !== null && weightOrVolumePerUnit !== '') ? parseFloat(weightOrVolumePerUnit) : null,
            minStockLevel: parseInt(minStockLevel) || 0,
            supplierId: req.body.supplierId || null, // Tedarikçi ID'si ekle
            imageUrl: imageUrl || null,
            description: description || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            priceUpdateDate: new Date()
        };
        const result = await db.collection('products').insertOne(newProduct);
        res.status(201).json({ message: 'Ürün başarıyla eklendi!', product: newProduct });
    } catch (error) {
        console.error('Ürün ekleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm Ürünleri Getirme Rotası (Frontend için hesaplanmış değerlerle)
router.get('/products', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId; // Organizasyon ID'si
    const { name, category } = req.query;

    let query = { 
        userId: userId,
        organizationId: organizationId // Sadece kendi organizasyonundaki ürünler
    };

    if (name) {
        query.name = { $regex: name, $options: 'i' };
    }
    if (category) {
        query.category = category;
    }

    try {
        const db = getDb();
        let products = await db.collection('products').find(query).sort({ createdAt: -1 }).toArray();

        products = products.map(product => {
            let displayGrammage = '';
            let pricePerUnitKgOrLiter = null;
            let isBelowMinStock = product.quantity < product.minStockLevel;

            if (product.unit === 'adet' && product.weightOrVolumePerUnit !== null && product.weightOrVolumePerUnit > 0) {
                if (product.weightOrVolumePerUnit < 1) {
                    displayGrammage = `${(product.weightOrVolumePerUnit * 1000).toFixed(0)}gr`;
                } else {
                    displayGrammage = `${product.weightOrVolumePerUnit.toFixed(1)}kg`;
                }
                pricePerUnitKgOrLiter = product.price / product.weightOrVolumePerUnit;
            } else if (product.unit === 'kg') {
                pricePerUnitKgOrLiter = product.price;
            } else if (product.unit === 'litre') {
                pricePerUnitKgOrLiter = product.price;
            }

            return {
                ...product,
                displayGrammage: displayGrammage || null,
                pricePerUnitKgOrLiter: pricePerUnitKgOrLiter ? pricePerUnitKgOrLiter.toFixed(2) : null,
                isBelowMinStock: isBelowMinStock
            };
        });

        res.status(200).json(products);
    } catch (error) {
        console.error('Ürünleri çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// DÜŞÜK STOK ÜRÜNLERİ GETİRME ROTASI (Dashboard Widget için)
router.get('/products/low-stock', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    try {
        const db = getDb();
        const lowStockProducts = await db.collection('products').find({
            userId: userId,
            organizationId: organizationId,
            quantity: { $lte: { $min: ['$minStockLevel', 10] } } // minStockLevel veya 10'dan az
        }).sort({ quantity: 1 }).limit(10).toArray();

        res.status(200).json(lowStockProducts);
    } catch (error) {
        console.error('Düşük stok ürünleri çekme hatası:', error);
        res.status(500).json({ message: 'Düşük stok ürünleri yüklenirken sunucu hatası.' });
    }
});

// POPÜLER ÜRÜNLER GETİRME ROTASI (Dashboard Widget için)
router.get('/products/popular', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    try {
        const db = getDb();
        // Satış verilerinden popüler ürünleri çek
        const popularProducts = await db.collection('sales').aggregate([
            {
                $match: {
                    userId: new ObjectId(userId),
                    organizationId: new ObjectId(organizationId)
                }
            },
            {
                $group: {
                    _id: '$productId',
                    salesCount: { $sum: '$quantity' },
                    totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } }
                }
            },
            {
                $sort: { salesCount: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: '$productInfo'
            },
            {
                $project: {
                    _id: '$productInfo._id',
                    name: '$productInfo.name',
                    salesCount: '$salesCount',
                    totalRevenue: '$totalRevenue'
                }
            }
        ]).toArray();

        res.status(200).json(popularProducts);
    } catch (error) {
        console.error('Popüler ürünleri çekme hatası:', error);
        res.status(500).json({ message: 'Popüler ürünler yüklenirken sunucu hatası.' });
    }
});

// Tek bir Ürünü ID ile Getirme Rotası
router.get('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const organizationId = req.user.organizationId; // Organizasyon ID'si

    try {
        const db = getDb();
        const product = await db.collection('products').findOne({
            _id: new ObjectId(id),
            userId: userId,
            organizationId: organizationId // Sadece kendi organizasyonundaki ürün
        });

        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı.' });
        }

        res.status(200).json(product);
    } catch (error) {
        console.error('Ürün getirme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası.' });
    }
});


// Ürün Güncelleme Rotası
router.put('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, minStockLevel, imageUrl, description } = req.body;
    const userId = req.user.userId;
    const organizationId = req.user.organizationId; // Organizasyon ID'si

    if (!name || price === undefined || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Ürün adı, fiyat, miktar ve birim gerekli.' });
    }

    try {
        const db = getDb();
        const updateDoc = {
            $set: {
                name,
                category: category || null,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                unit,
                barcode: barcode || null,
                weightOrVolumePerUnit: (weightOrVolumePerUnit !== null && weightOrVolumePerUnit !== '') ? parseFloat(weightOrVolumePerUnit) : null, // Boş string gelme ihtimaline karşı kontrol
                minStockLevel: parseInt(minStockLevel) || 0,
                imageUrl: imageUrl || null,
                description: description || null,
                updatedAt: new Date(),
                priceUpdateDate: new Date()
            }
        };

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: userId, organizationId: organizationId }, // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan
            updateDoc
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Ürün başarıyla güncellendi!' });
    } catch (error) {
        console.error('Ürün güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Ürün Stok Güncelleme Rotası (Sadece miktar güncelleme için)
router.put('/products/stock/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { newQuantity } = req.body;
    const userId = req.user.userId;
    const organizationId = req.user.organizationId; // Organizasyon ID'si

    if (newQuantity === undefined || isNaN(newQuantity)) {
        return res.status(400).json({ message: 'Geçerli bir miktar değeri gerekli.' });
    }

    try {
        const db = getDb();

        // Eşik geçişini tespit etmek için mevcut ürünü çek
        const product = await db.collection('products').findOne({ _id: new ObjectId(id), userId: userId, organizationId: organizationId });
        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }

        const previousQuantity = Number(product.quantity);
        const updatedQuantity = parseInt(newQuantity);
        const minLevel = Number.isFinite(product.minStockLevel) ? Number(product.minStockLevel) : 0;
        const threshold = minLevel > 0 ? minLevel : 10;

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: userId, organizationId: organizationId }, // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan
            { $set: { quantity: updatedQuantity, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }

        // Eşik üstünden eşik altına düşüşte e-posta gönder
        if (previousQuantity >= threshold && updatedQuantity < threshold) {
            try {
                const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { email: 1 } });
                if (user && user.email) {
                    // Async fire-and-forget
                    sendLowStockEmail(user.email, {
                        productName: product.name,
                        newQuantity: updatedQuantity,
                        minStockLevel: threshold,
                        unit: product.unit
                    }).catch(err => console.error('Düşük stok e-posta hatası:', err));
                }
            } catch (err) {
                console.error('Düşük stok e-posta hazırlama/lookup hatası:', err);
            }
        }

        res.status(200).json({ message: 'Stok başarıyla güncellendi!', newQuantity: updatedQuantity });
    } catch (error) {
        console.error('Stok güncelleme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


// Ürün Silme Rotası
router.delete('/products/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    const organizationId = req.user.organizationId; // Organizasyon ID'si

    try {
        const db = getDb();
        const result = await db.collection('products').deleteOne({ _id: new ObjectId(id), userId: userId, organizationId: organizationId }); // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Ürün başarıyla silindi!' });
    } catch (error) {
        console.error('Ürün silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
