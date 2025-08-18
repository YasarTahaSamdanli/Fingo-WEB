// routes/sales.js
const express = require('express');
const { ObjectId } = require('mongodb'); // ObjectId'yi içe aktardık
const { getDb } = require('../db'); // db.js'den getDb fonksiyonunu al
const { authenticateToken, verify2FA } = require('../middleware/authMiddleware'); // Middleware'leri al

const router = express.Router(); // Yeni bir router objesi oluştur

// Yeni Satış Ekleme Rotası
router.post('/sales', authenticateToken, async (req, res) => {
    // Frontend'den beklenen yeni alanlar: customerId, customerName, paymentMethod, cashPaid, cardPaid
    const { saleItems, customerId, customerName, saleDate, paymentMethod, cashPaid, cardPaid } = req.body;
    const userId = req.user.userId;

    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) {
        return res.status(400).json({ message: 'Satış öğeleri boş olamaz.' });
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        let totalAmount = 0;
        let processedSaleItems = [];

        // Her bir satış öğesi için stok düşme işlemi (ŞİMDİ SADECE BURADA YAPILACAK)
        for (const item of saleItems) {
            const product = await db.collection('products').findOne({ _id: new ObjectId(item.productId), userId: userId });

            if (!product) {
                // Eğer ürün bulunamazsa, hata fırlat ve işlemi durdur
                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
            }
            if (product.quantity < item.quantity) {
                throw new Error(`Yetersiz stok: ${product.name}. Mevcut: ${product.quantity}, İstenen: ${item.quantity}`);
            }

            // Stoktan düşme işlemi
            await db.collection('products').updateOne(
                { _id: new ObjectId(item.productId), userId: userId },
                { $inc: { quantity: -item.quantity }, $set: { updatedAt: new Date() } }
            );

            // İşlenmiş satış öğelerini hazırla
            processedSaleItems.push({
                productId: new ObjectId(item.productId), // ObjectId olarak kaydet
                productName: product.name,
                category: product.category,
                unitPrice: product.price,
                quantity: item.quantity,
                unit: product.unit,
                totalPrice: item.quantity * product.price
            });
            totalAmount += item.quantity * product.price;
        }

        // Satış kaydını oluştur
        const newSale = {
            userId: userId,
            saleItems: processedSaleItems,
            customerName: customerName,
            customerId: customerId ? new ObjectId(customerId) : null, // customerId varsa ObjectId yap
            totalAmount: totalAmount,
            saleDate: new Date(saleDate), // String olarak gelen tarihi Date objesine çevir
            paymentMethod: paymentMethod,
            cashPaid: parseFloat(cashPaid || 0),
            cardPaid: parseFloat(cardPaid || 0),
            creditDebt: totalAmount - (parseFloat(cashPaid || 0) + parseFloat(cardPaid || 0)), // Toplam tutardan ödeneni çıkar
            createdAt: new Date()
        };

        const saleResult = await db.collection('sales').insertOne(newSale);

        // YENİ EKLENEN KISIM: Müşterinin toplam veresiye borcunu güncelle
        if (newSale.creditDebt > 0 && newSale.customerId) {
            await db.collection('customers').updateOne(
                { _id: new ObjectId(newSale.customerId), userId: userId },
                { $inc: { currentDebt: newSale.creditDebt }, $set: { updatedAt: new Date() } }
            );
            console.log(`Müşteri ${newSale.customerName} için veresiye borcu güncellendi: ${newSale.creditDebt} TL eklendi.`);
        }
        // YENİ EKLENEN KISIM SONU

        res.status(201).json({ message: 'Satış başarıyla kaydedildi!', sale: newSale });

    } catch (error) {
        console.error('Satış işlemi hatası:', error);
        // Hata durumunda stokları geri alma (işlemi geri alma - opsiyonel ama iyi bir uygulama)
        // Bu kısım daha karmaşık bir \"işlem yönetimi\" gerektirebilir.
        res.status(500).json({ message: error.message || 'Satış işlemi sırasında bir hata oluştu.' });
    }
});

// Tüm Satışları Getirme Rotası (Filtreleme ile)
router.get('/sales', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { customerName, startDate, endDate, customerId } = req.query; // customerId'yi de al

    // 2FA doğrulaması yapılmış mı kontrol et (raporlama için gerekli)
    // Bu kontrol, 2FA'nın aktif olup olmamasına veya kullanıcının rolüne göre değişebilir
    // Şimdilik, sadece satış geçmişini görmek için 2FA doğrulaması istiyoruz
    if (!req.user.is2FAVerified) {
        return res.status(403).json({ message: 'Satış geçmişini görüntülemek için 2FA doğrulaması gerekli.' });
    }

    let query = { userId: userId };

    if (customerName) {
        // Müşteri adına göre case-insensitive arama
        query.customerName = { $regex: customerName, $options: 'i' };
    }
    // Eğer customerId varsa, sadece o müşterinin satışlarını getir
    if (customerId) {
        query.customerId = new ObjectId(customerId);
    }

    if (startDate || endDate) {
        query.saleDate = {};
        if (startDate) {
            // Başlangıç tarihinden büyük veya eşit
            query.saleDate.$gte = new Date(startDate);
        }
        if (endDate) {
            // Bitiş tarihinden küçük veya eşit
            query.saleDate.$lte = new Date(endDate);
        }
    }

    try {
        const db = getDb(); // Veritabanı bağlantısını al
        // Satışları bul ve tarihe göre azalan sırada sırala
        const sales = await db.collection('sales').find(query).sort({ saleDate: -1, createdAt: -1 }).toArray();
        res.status(200).json(sales);
    } catch (error) {
        console.error('Satışları çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});


module.exports = router;
