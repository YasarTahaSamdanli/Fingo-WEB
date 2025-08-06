// routes/purchaseOrders.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Satın Alma Siparişi Oluşturma Rotası
router.post('/purchase-orders', authenticateToken, async (req, res) => {
    const { supplierId, orderDate, expectedDeliveryDate, items, status, notes } = req.body;
    const userId = req.user.userId;

    if (!supplierId || !orderDate || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Tedarikçi ID, sipariş tarihi ve ürünler gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al

        // Tedarikçinin varlığını kontrol et
        const supplier = await db.collection('suppliers').findOne({ _id: new ObjectId(supplierId), userId: userId });
        if (!supplier) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı.' });
        }

        let totalOrderAmount = 0;
        let processedOrderItems = [];

        for (const item of items) {
            const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId), userId: userId });
            if (!product) {
                // Eğer ürün bulunamazsa, hata fırlat veya ürünü "bilinmeyen ürün" olarak ekle
                // Şimdilik hata fırlatıyoruz
                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
            }

            const itemTotalPrice = (item.purchasePrice || product.price) * item.quantity; // Alış fiyatı belirtilmezse ürünün kendi fiyatını kullan
            totalOrderAmount += itemTotalPrice;

            processedOrderItems.push({
                productId: product._id.toString(),
                productName: product.name,
                unitPrice: product.price, // Ürünün güncel satış fiyatı
                purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : product.price, // Satın alma fiyatı
                quantity: parseInt(item.quantity),
                unit: product.unit,
                category: product.category,
                totalPrice: itemTotalPrice
            });
        }

        const newPurchaseOrder = {
            userId: userId,
            supplierId: supplierId,
            supplierName: supplier.name, // Tedarikçi adını da kaydet
            orderDate: new Date(orderDate),
            expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
            items: processedOrderItems,
            totalAmount: totalOrderAmount,
            status: status || 'Pending', // Varsayılan durum: Beklemede
            notes: notes || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await db.collection('purchaseOrders').insertOne(newPurchaseOrder);
        res.status(201).json({ message: 'Satın alma siparişi başarıyla oluşturuldu!', purchaseOrder: newPurchaseOrder });

    } catch (error) {
        console.error('Satın alma siparişi oluşturma hatası:', error);
        res.status(500).json({ message: error.message || 'Satın alma siparişi oluşturulurken bir hata oluştu.' });
    }
});

// Tüm Satın Alma Siparişlerini Getirme Rotası (Filtreleme ile)
router.get('/purchase-orders', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { supplierId, status, startDate, endDate } = req.query;

    let query = { userId: userId };

    if (supplierId) {
        query.supplierId = supplierId; // Tedarikçi ID'sine göre filtrele
    }
    if (status) {
        query.status = status; // Duruma göre filtrele (Pending, Completed, Cancelled)
    }
    if (startDate || endDate) {
        query.orderDate = {};
        if (startDate) {
            query.orderDate.$gte = new Date(startDate);
        }
        if (endDate) {
            query.orderDate.$lte = new Date(endDate);
        }
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const purchaseOrders = await db.collection('purchaseOrders').find(query).sort({ orderDate: -1 }).toArray();
        res.status(200).json(purchaseOrders);
    } catch (error) {
        console.error('Satın alma siparişlerini çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Satın Alma Siparişini Güncelleme Rotası
router.put('/purchase-orders/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { supplierId, orderDate, expectedDeliveryDate, items, status, notes } = req.body;
    const userId = req.user.userId;

    if (!supplierId || !orderDate || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Tedarikçi ID, sipariş tarihi ve ürünler gerekli.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al

        // Tedarikçinin varlığını kontrol et
        const supplier = await db.collection('suppliers').findOne({ _id: new ObjectId(supplierId), userId: userId });
        if (!supplier) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı.' });
        }

        let totalOrderAmount = 0;
        let processedOrderItems = [];

        for (const item of items) {
            const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId), userId: userId });
            if (!product) {
                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
            }

            const itemTotalPrice = (item.purchasePrice || product.price) * item.quantity;
            totalOrderAmount += itemTotalPrice;

            processedOrderItems.push({
                productId: product._id.toString(),
                productName: product.name,
                unitPrice: product.price,
                purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : product.price,
                quantity: parseInt(item.quantity),
                unit: product.unit,
                category: product.category,
                totalPrice: itemTotalPrice
            });
        }

        const result = await db.collection('purchaseOrders').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: {
                supplierId: supplierId,
                supplierName: supplier.name,
                orderDate: new Date(orderDate),
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                items: processedOrderItems,
                totalAmount: totalOrderAmount,
                status: status || 'Pending',
                notes: notes || null,
                updatedAt: new Date()
            }}
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Satın alma siparişi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Satın alma siparişi başarıyla güncellendi!' });
    } catch (error) {
        console.error('Satın alma siparişi güncelleme hatası:', error);
        res.status(500).json({ message: error.message || 'Satın alma siparişi güncellenirken bir hata oluştu.' });
    }
});

// Satın Alma Siparişini Tamamlama Rotası (Stokları Güncelle)
router.put('/purchase-orders/:id/complete', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb(); // Veritabanı bağlantısını al

        const purchaseOrder = await db.collection('purchaseOrders').findOne({ _id: new ObjectId(id), userId: userId });

        if (!purchaseOrder) {
            return res.status(404).json({ message: 'Satın alma siparişi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        if (purchaseOrder.status === 'Completed') {
            return res.status(400).json({ message: 'Bu sipariş zaten tamamlanmış.' });
        }

        // Her bir ürün için stokları güncelle
        for (const item of purchaseOrder.items) {
            await db.collection('products').updateOne(
                { _id: new ObjectId(item.productId), userId: userId },
                { $inc: { quantity: item.quantity }, $set: { updatedAt: new Date() } }
            );
        }

        // Sipariş durumunu "Completed" olarak güncelle
        await db.collection('purchaseOrders').updateOne(
            { _id: new ObjectId(id), userId: userId },
            { $set: { status: 'Completed', completedAt: new Date(), updatedAt: new Date() } }
        );

        res.status(200).json({ message: 'Satın alma siparişi başarıyla tamamlandı ve stoklar güncellendi!' });

    } catch (error) {
        console.error('Satın alma siparişini tamamlama hatası:', error);
        res.status(500).json({ message: error.message || 'Satın alma siparişini tamamlarken bir hata oluştu.' });
    }
});

// Satın Alma Siparişini Silme Rotası
router.delete('/purchase-orders/:id', authenticateToken, verify2FA, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        const result = await db.collection('purchaseOrders').deleteOne({ _id: new ObjectId(id), userId: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Satın alma siparişi bulunamadı veya bu kullanıcıya ait değil.' });
        }
        res.status(200).json({ message: 'Satın alma siparişi başarıyla silindi!' });
    } catch (error) {
        console.error('Satın alma siparişi silme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router; // Router objesini dışa aktar
