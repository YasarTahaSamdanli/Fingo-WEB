// routes/products.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Ürün Ekleme Rotası
router.post('/products', authenticateToken, async (req, res) => {
    // imageUrl'ü de payload'a ekleyelim, ancak şu anlık sadece kaydedeceğiz.
    // Gerçek bir senaryoda bu bir bulut depolama URL'si olmalı.
    const { name, category, price, quantity, unit, barcode, weightOrVolumePerUnit, minStockLevel, imageUrl, description } = req.body;
    const userId = req.user.userId;

    if (!name || price === undefined || quantity === undefined || !unit) { // Kategori artık opsiyonel olabilir
        return res.status(400).json({ message: 'Ürün adı, fiyat, miktar ve birim gereklidir.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const newProduct = {
            userId: new ObjectId(userId), // userId'yi ObjectId olarak kaydet
            name,
            category: category || null, // Kategori opsiyonel
            price: parseFloat(price),
            quantity: parseInt(quantity),
            unit,
            barcode: barcode || null,
            weightOrVolumePerUnit: weightOrVolumePerUnit ? parseFloat(weightOrVolumePerUnit) : null,
            minStockLevel: parseInt(minStockLevel) || 0, // minStockLevel varsayılan 0
            imageUrl: imageUrl || null, // Base64 veya URL olarak kaydediyoruz (şimdilik)
            description: description || null, // Açıklama opsiyonel
            createdAt: new Date(),
            updatedAt: new Date(), // Oluşturma ve güncelleme tarihleri
            priceUpdateDate: new Date() // Fiyatın son güncellendiği tarih (şimdilik createdAt ile aynı)
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
    const { name, category } = req.query; // Filtreleme parametreleri

    let query = { userId: new ObjectId(userId) }; // userId'yi ObjectId olarak filtrele

    if (name) {
        query.name = { $regex: name, $options: 'i' }; // İsim ile case-insensitive arama
    }
    if (category) {
        query.category = category; // Kategoriye göre filtrele
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        let products = await db.collection('products').find(query).sort({ createdAt: -1 }).toArray(); // En yeni ürünler üstte

        // Her ürün için ek alanlar hesapla ve ekle
        products = products.map(product => {
            let displayGrammage = '';
            let pricePerUnitKgOrLiter = null;
            let isBelowMinStock = product.quantity < product.minStockLevel; // Minimum stok seviyesi kontrolü

            // displayGrammage ve pricePerUnitKgOrLiter hesaplamaları
            if (product.unit === 'adet' && product.weightOrVolumePerUnit > 0) {
                if (product.weightOrVolumePerUnit < 1) { // Örneğin 0.25 kg = 250 gr
                    displayGrammage = `${(product.weightOrVolumePerUnit * 1000).toFixed(0)}gr`;
                } else {
                    displayGrammage = `${product.weightOrVolumePerUnit.toFixed(1)}kg`;
                }
                pricePerUnitKgOrLiter = product.price / product.weightOrVolumePerUnit;
            } else if (product.unit === 'kg') {
                pricePerUnitKgOrLiter = product.price; // Zaten kg/L başına fiyat
            } else if (product.unit === 'litre') {
                pricePerUnitKgOrLiter = product.price; // Zaten kg/L başına fiyat
            }

            return {
                ...product,
                displayGrammage: displayGrammage || null,
                pricePerUnitKgOrLiter: pricePerUnitKgOrLiter ? pricePerUnitKgOrLiter.toFixed(2) : null, // 2 ondalık basamak
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
        const product = await db.collection('products').findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });

        if (!product) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }

        // Tek ürün için de hesaplanmış alanları ekleyelim
        let displayGrammage = '';
        let pricePerUnitKgOrLiter = null;
        let isBelowMinStock = product.quantity < product.minStockLevel;

        if (product.unit === 'adet' && product.weightOrVolumePerUnit > 0) {
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

    if (!name || price === undefined || quantity === undefined || !unit) { // Kategori artık opsiyonel olabilir
        return res.status(400).json({ message: 'Ürün adı, fiyat, miktar ve birim gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const updateDoc = {
            $set: {
                name,
                category: category || null,
                price: parseFloat(price),
                quantity: parseInt(quantity),
                unit,
                barcode: barcode || null,
                weightOrVolumePerUnit: weightOrVolumePerUnit ? parseFloat(weightOrVolumePerUnit) : null,
                minStockLevel: parseInt(minStockLevel) || 0,
                imageUrl: imageUrl || null,
                description: description || null,
                updatedAt: new Date(), // Güncelleme tarihi
                priceUpdateDate: new Date() // Fiyat güncellendiğinde bu da güncellensin
            }
        };

        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // userId'yi de ObjectId olarak filtrele
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
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('products').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // userId'yi ObjectId olarak filtrele
            { $set: { quantity: parseInt(newQuantity), updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Stok başarıyla güncellendi!', newQuantity: newQuantity });
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
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('products').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }); // userId'yi ObjectId olarak filtrele

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Ürün bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Ürün başarıyla silindi!' });
    } catch (error) {
        console.error('Ürün silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
