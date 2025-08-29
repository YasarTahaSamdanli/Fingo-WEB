// routes/stockAlerts.js
const express = require('express');
const { getDb } = require('../db');
const { sendLowStockEmail } = require('../utils/emailSender');

const router = express.Router();

// Düşük stok ürünlerini kontrol et
router.get('/check-low-stock', async (req, res) => {
    try {
        const db = getDb();
        
        // Düşük stok ürünlerini bul
        const lowStockProducts = await db.collection('products').find({
            $expr: {
                $lt: ['$quantity', '$minStockLevel']
            }
        }).toArray();

        // Tedarikçi bilgilerini ekle
        const productsWithSuppliers = [];
        for (const product of lowStockProducts) {
            if (product.supplierId) {
                const supplier = await db.collection('suppliers').findOne({
                    _id: product.supplierId
                });
                
                if (supplier) {
                    productsWithSuppliers.push({
                        ...product,
                        supplierName: supplier.name,
                        supplierEmail: supplier.email,
                        supplierPhone: supplier.phone
                    });
                }
            }
        }

        res.status(200).json(productsWithSuppliers);
    } catch (error) {
        console.error('Düşük stok kontrolü hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tedarikçiye bildirim gönder
router.post('/send-supplier-notification', async (req, res) => {
    try {
        const { supplierId, products, message } = req.body;
        const db = getDb();

        // Tedarikçi bilgilerini al
        const supplier = await db.collection('suppliers').findOne({
            _id: supplierId
        });

        if (!supplier) {
            return res.status(404).json({ message: 'Tedarikçi bulunamadı.' });
        }

        // E-posta gönder
        if (supplier.email) {
            const emailContent = {
                productName: products.map(p => p.productName).join(', '),
                newQuantity: products.map(p => p.currentStock).join(', '),
                minStockLevel: products.map(p => p.minStock).join(', '),
                unit: products[0]?.unit || ''
            };

            await sendLowStockEmail(supplier.email, emailContent);
        }

        // SMS gönder (opsiyonel - Twilio gibi servis kullanılabilir)
        // await sendSMS(supplier.phone, message);

        // Log kaydı
        const alertLog = {
            supplierId,
            supplierName: supplier.name,
            products,
            message,
            sentAt: new Date(),
            sentVia: ['email'], // email, sms, whatsapp gibi
            status: 'sent'
        };

        await db.collection('stockAlerts').insertOne(alertLog);

        res.status(200).json({
            message: 'Bildirim başarıyla gönderildi',
            supplierName: supplier.name,
            products: products.length,
            sentAt: alertLog.sentAt
        });

    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
        res.status(500).json({ message: 'Bildirim gönderilemedi.' });
    }
});

// Stok uyarı geçmişini getir
router.get('/stock-alerts-history', async (req, res) => {
    try {
        const db = getDb();
        const alerts = await db.collection('stockAlerts')
            .find({})
            .sort({ sentAt: -1 })
            .limit(100)
            .toArray();

        res.status(200).json(alerts);
    } catch (error) {
        console.error('Uyarı geçmişi getirme hatası:', error);
        res.status(500).json({ message: 'Uyarı geçmişi alınamadı.' });
    }
});

module.exports = router;
