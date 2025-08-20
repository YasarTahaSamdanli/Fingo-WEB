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

    if (!name || price === undefined || quantity === undefined || !unit) {
        return res.status(400).json({ message: 'Ürün adı, fiyat, miktar ve birim gereklidir.' });
    }

    try {
        const db = getDb();
        const newProduct = {
            userId: userId, // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kaydet
            name,
            category: category || null,
            price: parseFloat(price),
            quantity: parseInt(quantity),
            unit,
            barcode: barcode || null,
            weightOrVolumePerUnit: (weightOrVolumePerUnit !== null && weightOrVolumePerUnit !== '') ? parseFloat(weightOrVolumePerUnit) : null, // Boş string gelme ihtimaline karşı kontrol
            minStockLevel: parseInt(minStockLevel) || 0, // Varsayılan 0
            imageUrl: imageUrl || null, // Base64 veya URL olarak kaydediyoruz (şimdilik)
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
    const { name, category } = req.query;

    let query = { userId: userId }; // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan

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

            if (product.unit === 'adet' && product.weightOrVolumePerUnit !== null && product.weightOrVolumePerUnit > 0) { // <<<< DÜZELTME: null kontrolü eklendi
                if (product.weightOrVolumePerUnit < 1) { // Örneğin 0.25 kg = 250 gr
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

// Tek bir Ürünü ID ile Getirme Rotası
router.get('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const product = await db.collection('products').findOne({ _id: new ObjectId(id), userId: userId }); // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan

        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }

        let displayGrammage = '';
        let pricePerUnitKgOrLiter = null;
        let isBelowMinStock = product.quantity < product.minStockLevel;

        if (product.unit === 'adet' && product.weightOrVolumePerUnit !== null && product.weightOrVolumePerUnit > 0) { // <<<< DÜZELTME: null kontrolü eklendi
            if (product.weightOrVolumePerUnit < 1) {
                displayGrammage = `${(product.weightOrVolumePerUnit * 1000).toFixed(0)}gr`;
            } else {
                displayGrammage = `${product.weightOrVolumePerUnit.toFixed(1)}kg`;
            }
            pricePerUnitKgOrLiter = product.price / product.weightOrVolumePerUnit;
        } else if (product.unit === 'kg' || product.unit === 'litre') {
            pricePerUnitKgOrLiter = product.price;
        }

        const productWithCalculatedFields = {
            ...product,
            displayGrammage: displayGrammage || null,
            pricePerUnitKgOrLiter: pricePerUnitKgOrLiter ? pricePerUnitKgOrLiter.toFixed(2) : null,
            isBelowMinStock: isBelowMinStock
        };

        res.status(200).json(productWithCalculatedFields);
    } catch (error) {
        console.error('Tek ürün çekilirken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


// Ürün Güncelleme Rotası
router.put('/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, minStockLevel, imageUrl, description } = req.body;
    const userId = req.user.userId;

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
            { _id: new ObjectId(id), userId: userId }, // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan
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

    if (newQuantity === undefined || isNaN(newQuantity)) {
        return res.status(400).json({ message: 'Geçerli bir miktar değeri gerekli.' });
    }

    try {
        const db = getDb();

        // Eşik geçişini tespit etmek için mevcut ürünü çek
        const product = await db.collection('products').findOne({ _id: new ObjectId(id), userId: userId });
        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }

        const previousQuantity = Number(product.quantity);
        const updatedQuantity = parseInt(newQuantity);
        const minLevel = Number.isFinite(product.minStockLevel) ? Number(product.minStockLevel) : 0;
        const threshold = minLevel > 0 ? minLevel : 10;

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: userId }, // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan
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

    try {
        const db = getDb();
        const result = await db.collection('products').deleteOne({ _id: new ObjectId(id), userId: userId }); // <<<< DÜZELTME: userId'yi ObjectId'ye çevirmeden direkt string olarak kullan

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
