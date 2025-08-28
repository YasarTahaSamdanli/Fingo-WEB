// routes/reports.js
const express = require('express');
const { ObjectId } = require('mongodb'); // MongoDB ObjectId'ı kullanmak için
const { getDb } = require('../db'); // Veritabanı bağlantısını almak için
const { authenticateToken } = require('../middleware/authMiddleware'); // Kimlik doğrulama middleware'i

const router = express.Router();

// Yardımcı fonksiyon: Tarih aralığını oluşturur
const getDateRange = (startDateStr, endDateStr) => {
    let startDate, endDate;

    if (startDateStr) {
        startDate = new Date(startDateStr);
        // Zaman dilimi farklarını gidermek için başlangıç gününün başına ayarla
        startDate.setUTCHours(0, 0, 0, 0);
    }
    if (endDateStr) {
        endDate = new Date(endDateStr);
        // Zaman dilimi farklarını gidermek için bitiş gününün sonuna ayarla
        endDate.setUTCHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
};

// Kategori Bazında Özet Raporu
// GET /api/reports/category-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&type=income/expense
router.get('/category-summary', authenticateToken, async (req, res) => {
    // userId'yi doğrudan string olarak kullan
    const userId = req.user.userId;
    const { startDate: startDateStr, endDate: endDateStr, type } = req.query;

    const { startDate, endDate } = getDateRange(startDateStr, endDateStr);

    let matchQuery = { userId: userId };
    if (startDate && endDate) {
        matchQuery.date = { $gte: startDate, $lte: endDate };
    }
    if (type) {
        matchQuery.type = type;
    }

    try {
        const db = getDb();
        const summary = await db.collection('transactions').aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { category: "$category", type: "$type" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: "$_id.category",
                    type: "$_id.type",
                    totalAmount: "$totalAmount"
                }
            },
            { $sort: { type: 1, totalAmount: -1 } }
        ]).toArray();

        res.status(200).json(summary);
    } catch (error) {
        console.error('Kategori özet raporu çekilirken hata:', error);
        res.status(500).json({ message: 'Kategori özet raporu çekilirken sunucu hatası oluştu.', error: error.message });
    }
});

// Bakiye Geçmişi Raporu
// GET /api/reports/balance-history?period=monthly/yearly&year=YYYY&month=MM (opsiyonel)
router.get('/balance-history', authenticateToken, async (req, res) => {
    // userId'yi doğrudan string olarak kullan
    const userId = req.user.userId;
    const { period, year, month } = req.query; // period: 'monthly' veya 'yearly'

    let startDate, endDate;

    if (period === 'monthly' && year && month !== undefined) {
        const selectedMonth = parseInt(month);
        const selectedYear = parseInt(year);
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0); // Ayın son günü
    } else if (period === 'yearly' && year) {
        const selectedYear = parseInt(year);
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31); // Yılın son günü
    } else {
        // Varsayılan olarak son 12 ayın geçmişi
        endDate = new Date();
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        startDate.setDate(1); // Bir yıl önceki ayın ilk günü
    }

    // Zaman dilimi farklarını gidermek için UTC saatlerini ayarla
    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    try {
        const db = getDb();
        const transactions = await db.collection('transactions').aggregate([
            {
                $match: {
                    userId: userId, // userId'yi doğrudan string olarak kullan
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" }
                    },
                    totalIncome: {
                        $sum: {
                            $cond: { if: { $eq: ["$type", "Gelir"] }, then: "$amount", else: 0 }
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: { if: { $eq: ["$type", "Gider"] }, then: "$amount", else: 0 }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    income: { $ifNull: ["$totalIncome", 0] },
                    expense: { $ifNull: ["$totalExpense", 0] },
                    netBalance: { $subtract: [{ $ifNull: ["$totalIncome", 0] }, { $ifNull: ["$totalExpense", 0] }] }
                }
            },
            { $sort: { year: 1, month: 1 } }
        ]).toArray();

        // Her ay için kümülatif bakiye hesapla
        let cumulativeBalance = 0;
        const balanceHistory = transactions.map(item => {
            cumulativeBalance += item.netBalance;
            return { ...item, cumulativeBalance: cumulativeBalance };
        });

        res.status(200).json(balanceHistory);
    } catch (error) {
        console.error('Bakiye geçmişi raporu çekilirken hata:', error);
        res.status(500).json({ message: 'Bakiye geçmişi raporu çekilirken sunucu hatası oluştu.', error: error.message });
    }
});

// Stok Hareketleri Raporu (Ürün ve Satış verilerine göre)
// GET /api/reports/stock-movements?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/stock-movements', authenticateToken, async (req, res) => {
    // userId'yi doğrudan string olarak kullan
    const userId = req.user.userId;
    const { startDate: startDateStr, endDate: endDateStr } = req.query;

    const { startDate, endDate } = getDateRange(startDateStr, endDateStr);

    let matchQuery = { userId: userId }; // userId'yi doğrudan string olarak kullan
    if (startDate && endDate) {
        matchQuery.saleDate = { $gte: startDate, $lte: endDate };
    }

    console.log("Stok Hareketleri API: Match Query:", matchQuery);

    try {
        const db = getDb();
        const stockMovements = await db.collection('sales').aggregate([
            { $match: matchQuery },
            { $unwind: '$saleItems' },
            {
                $project: {
                    _id: 0,
                    productId: '$saleItems.productId',
                    productName: '$saleItems.productName',
                    quantitySold: '$saleItems.quantity',
                    saleDate: '$saleDate',
                    totalAmount: '$saleItems.totalPrice'
                }
            },
            { $sort: { saleDate: 1 } }
        ]).toArray();

        console.log("Stok Hareketleri API: Çekilen Veri (sales):", stockMovements);

        res.status(200).json(stockMovements);
    } catch (error) {
        console.error('Stok hareketleri raporu çekilirken hata:', error);
        res.status(500).json({ message: 'Stok hareketleri raporu çekilirken sunucu hatası oluştu.', error: error.message });
    }
});

// Kategori Bazında Stok Raporu
// GET /api/reports/stock-by-category?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&category=categoryName&topN=10
router.get('/stock-by-category', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { startDate: startDateStr, endDate: endDateStr, category, topN = 10 } = req.query;

    const { startDate, endDate } = getDateRange(startDateStr, endDateStr);

    let matchQuery = { userId: userId };
    if (startDate && endDate) {
        matchQuery.saleDate = { $gte: startDate, $lte: endDate };
    }

    try {
        const db = getDb();
        
        // Önce ürünlerin kategorilerini al
        const products = await db.collection('products').find(
            { userId: userId },
            { projection: { _id: 1, name: 1, category: 1 } }
        ).toArray();
        
        const productCategoryMap = {};
        products.forEach(product => {
            productCategoryMap[product._id.toString()] = product.category || 'Kategorisiz';
        });

        // Satış verilerini çek ve kategori bazında grupla
        const stockByCategory = await db.collection('sales').aggregate([
            { $match: matchQuery },
            { $unwind: '$saleItems' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'saleItems.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: '$saleItems.productId',
                    productName: '$saleItems.productName',
                    category: {
                        $ifNull: [
                            { $arrayElemAt: ['$productInfo.category', 0] },
                            'Kategorisiz'
                        ]
                    },
                    quantitySold: { $toInt: '$saleItems.quantity' },
                    saleDate: '$saleDate',
                    totalAmount: { $toDouble: '$saleItems.totalPrice' }
                }
            },
            {
                $group: {
                    _id: {
                        category: '$category',
                        productName: '$productName'
                    },
                    totalQuantity: { $sum: '$quantitySold' },
                    totalAmount: { $sum: '$totalAmount' },
                    saleCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: '$_id.category',
                    productName: '$_id.productName',
                    totalQuantity: '$totalQuantity',
                    totalAmount: '$totalAmount',
                    saleCount: '$saleCount'
                }
            },
            { $sort: { category: 1, totalQuantity: -1 } }
        ]).toArray();

        // Kategori bazında grupla ve top N ürünleri al
        const categoryGroups = {};
        stockByCategory.forEach(item => {
            if (!categoryGroups[item.category]) {
                categoryGroups[item.category] = [];
            }
            categoryGroups[item.category].push(item);
        });

        // Her kategori için top N ürünleri al
        const result = {};
        Object.keys(categoryGroups).forEach(cat => {
            if (!category || category === cat) {
                result[cat] = categoryGroups[cat].slice(0, parseInt(topN));
            }
        });

        // Eğer belirli bir kategori isteniyorsa, sadece o kategoriyi döndür
        if (category && result[category]) {
            res.status(200).json({
                category: category,
                products: result[category],
                totalProducts: result[category].length
            });
        } else {
            res.status(200).json(result);
        }

    } catch (error) {
        console.error('Kategori bazında stok raporu çekilirken hata:', error);
        res.status(500).json({ 
            message: 'Kategori bazında stok raporu çekilirken sunucu hatası oluştu.', 
            error: error.message 
        });
    }
});

module.exports = router;
