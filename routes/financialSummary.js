// routes/financialSummary.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Genel Finansal Özeti Getirme Rotası
router.get('/financial-summary/general', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const db = getDb();

        // Toplam Gelir (transactions koleksiyonundan)
        const totalIncomeResult = await db.collection('transactions').aggregate([
            { $match: { userId: new ObjectId(userId), type: 'Gelir' } },
            { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
        ]).toArray();
        const totalRevenue = totalIncomeResult.length > 0 ? totalIncomeResult[0].totalIncome : 0;

        // Toplam Gider (transactions koleksiyonundan)
        const totalExpensesResult = await db.collection('transactions').aggregate([
            { $match: { userId: new ObjectId(userId), type: 'Gider' } },
            { $group: { _id: null, totalExpenses: { $sum: "$amount" } } }
        ]).toArray();
        const totalExpenses = totalExpensesResult.length > 0 ? totalExpensesResult[0].totalExpenses : 0;

        // Toplam Bakiye (Gelir - Gider)
        const currentBalance = totalRevenue - totalExpenses;

        // Envanter Değeri (Eğer products koleksiyonu varsa ve userId'ye göre filtreliyorsa)
        const inventoryValueResult = await db.collection('products').aggregate([
            { $match: { userId: new ObjectId(userId) } },
            { $project: { _id: 0, value: { $multiply: ["$quantity", "$price"] } } },
            { $group: { _id: null, totalInventoryValue: { $sum: "$value" } } }
        ]).toArray();
        const totalInventoryValue = inventoryValueResult.length > 0 ? inventoryValueResult[0].totalInventoryValue : 0;

        // DÜZELTME: toFixed() burada kaldırıldı, frontend'de yapılacak.
        res.status(200).json({
            totalRevenue: totalRevenue,
            totalExpenses: totalExpenses,
            currentBalance: currentBalance,
            totalInventoryValue: totalInventoryValue
        });

    } catch (error) {
        console.error('Genel finansal özet çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Aylık Özetleri Getirme Rotası (Bu kısım zaten sayı döndürüyor, değişiklik yok)
router.get('/financial-summary/monthly', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year, month } = req.query;

    let matchQuery = { userId: new ObjectId(userId) };
    if (year && month !== undefined) {
        matchQuery.date = {
            $gte: new Date(parseInt(year), parseInt(month), 1),
            $lt: new Date(parseInt(year), parseInt(month) + 1, 1)
        };
    } else if (year) {
        matchQuery.date = {
            $gte: new Date(parseInt(year), 0, 1),
            $lt: new Date(parseInt(year) + 1, 0, 1)
        };
    }

    try {
        const db = getDb();
        const monthlySummary = await db.collection('transactions').aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        month: { $month: "$date" },
                        type: "$type"
                    },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $group: {
                    _id: { year: "$_id.year", month: "$_id.month" },
                    income: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "Gelir"] }, "$totalAmount", 0]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "Gider"] }, "$totalAmount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id.year",
                    month: "$_id.month",
                    income: "$income",
                    expense: "$expense",
                    netBalance: { $subtract: ["$income", "$expense"] }
                }
            },
            { $sort: { year: 1, month: 1 } }
        ]).toArray();

        res.status(200).json(monthlySummary);
    } catch (error) {
        console.error('Aylık finansal özet çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Yıllık Özetleri Getirme Rotası (Bu kısım zaten sayı döndürüyor, değişiklik yok)
router.get('/financial-summary/annual', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year } = req.query;

    let matchQuery = { userId: new ObjectId(userId) };
    if (year) {
        matchQuery.date = {
            $gte: new Date(parseInt(year), 0, 1),
            $lt: new Date(parseInt(year) + 1, 0, 1)
        };
    }

    try {
        const db = getDb();
        const annualSummary = await db.collection('transactions').aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: "$date" },
                        type: "$type"
                    },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $group: {
                    _id: "$_id.year",
                    income: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "Gelir"] }, "$totalAmount", 0]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [{ $eq: ["$_id.type", "Gider"] }, "$totalAmount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    year: "$_id._id",
                    income: "$income",
                    expense: "$expense",
                    netBalance: { $subtract: ["$income", "$expense"] }
                }
            },
            { $sort: { year: 1 } }
        ]).toArray();

        res.status(200).json(annualSummary);
    } catch (error) {
        console.error('Yıllık finansal özet çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Kategori Bazlı Harcama Dağılımı Rotası (Bu kısım zaten sayı döndürüyor, değişiklik yok)
router.get('/financial-summary/category-distribution', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { type, year, month } = req.query;

    let transactionType;
    if (type === 'income') {
        transactionType = 'Gelir';
    } else if (type === 'expense') {
        transactionType = 'Gider';
    } else {
        return res.status(400).json({ message: 'Geçerli bir "type" (income veya expense) belirtmelisiniz.' });
    }

    let matchQuery = { userId: new ObjectId(userId), type: transactionType };

    if (year && month !== undefined) {
        matchQuery.date = {
            $gte: new Date(parseInt(year), parseInt(month), 1),
            $lt: new Date(parseInt(year), parseInt(month) + 1, 1)
        };
    } else if (year) {
        matchQuery.date = {
            $gte: new Date(parseInt(year), 0, 1),
            $lt: new Date(parseInt(year) + 1, 0, 1)
        };
    }

    try {
        const db = getDb();
        const categoryDistribution = await db.collection('transactions').aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    category: "$_id",
                    totalAmount: "$totalAmount"
                }
            },
            { $sort: { totalAmount: -1 } }
        ]).toArray();

        res.status(200).json(categoryDistribution);
    } catch (error) {
        console.error('Kategori bazlı dağılım çekme hatası:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

module.exports = router;
