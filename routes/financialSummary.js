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

        res.status(200).json({ totalRevenue, totalExpenses, currentBalance });
    } catch (error) {
        console.error('Genel finansal özet verilerini çekerken hata:', error);
        res.status(500).json({ message: 'Genel finansal özet yüklenirken sunucu hatası.' });
    }
});

// YILLIK FİNANSAL ÖZETİ GETİRME ROTASI
router.get('/financial-summary/annual', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year } = req.query;

    if (!year) {
        return res.status(400).json({ message: 'Yıl belirtmelisiniz.' });
    }

    try {
        const db = getDb();
        // DÜZELTME: Tarihleri UTC olarak oluşturmaya devam ediyoruz.
        const startOfYear = new Date(Date.UTC(parseInt(year), 0, 1)); // Yılın ilk günü, 00:00:00 UTC
        const endOfYear = new Date(Date.UTC(parseInt(year) + 1, 0, 1)); // Bir sonraki yılın ilk günü, 00:00:00 UTC

        const annualSummary = await db.collection('transactions').aggregate([
            {
                $match: {
                    userId: new ObjectId(userId),
                    date: { $gte: startOfYear, $lt: endOfYear } // $lt kullanmak daha güvenlidir
                }
            },
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id",
                    totalAmount: "$totalAmount"
                }
            }
        ]).toArray();

        let income = 0;
        let expense = 0;

        annualSummary.forEach(item => {
            if (item.type === 'Gelir') {
                income = item.totalAmount;
            } else if (item.type === 'Gider') {
                expense = item.totalAmount;
            }
        });

        res.status(200).json([{ year: parseInt(year), income: income, expense: expense, netBalance: income - expense }]);
    } catch (error) {
        console.error('Yıllık finansal özet verilerini çekerken hata:', error);
        res.status(500).json({ message: 'Yıllık finansal özet yüklenirken sunucu hatası.' });
    }
});


// AYLIK FİNANSAL ÖZETİ GETİRME ROTASI
router.get('/financial-summary/monthly', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year, month } = req.query; // Frontend'den gelen ay 0-11 arası (JavaScript'in Date objesi gibi)

    if (!year || month === undefined) {
        return res.status(400).json({ message: 'Yıl ve ay belirtmelisiniz.' });
    }

    try {
        const db = getDb();
        // DÜZELTME: Tarihleri UTC olarak oluşturmaya devam ediyoruz.
        const startOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month), 1)); // Ayın ilk günü, 00:00:00 UTC
        const endOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) + 1, 1)); // Bir sonraki ayın ilk günü, 00:00:00 UTC

        console.log(`Backend: Aylık özet isteği - Yıl: ${year}, Ay (API'den Gelen): ${month}, MongoDB için Başlangıç Tarihi (UTC): ${startOfMonth}, Bitiş Tarihi (UTC): ${endOfMonth}`); // Debug log

        const monthlySummary = await db.collection('transactions').aggregate([
            {
                $match: {
                    userId: new ObjectId(userId),
                    date: { $gte: startOfMonth, $lt: endOfMonth } // $lt kullanmak daha güvenlidir
                }
            },
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: "$_id",
                    totalAmount: "$totalAmount"
                }
            }
        ]).toArray();

        let income = 0;
        let expense = 0;

        monthlySummary.forEach(item => {
            if (item.type === 'Gelir') {
                income = item.totalAmount;
            } else if (item.type === 'Gider') {
                expense = item.totalAmount;
            }
        });

        const result = [{
            year: parseInt(year),
            month: parseInt(month) + 1, // Frontend'e 1-tabanlı ay olarak geri dön
            income: income,
            expense: expense,
            netBalance: income - expense
        }];

        console.log("Backend: Dönülecek Aylık Özet Sonuç:", result); // Debug log
        res.status(200).json(result);

    } catch (error) {
        console.error('Aylık finansal özet verilerini çekerken hata:', error);
        res.status(500).json({ message: 'Aylık finansal özet yüklenirken sunucu hatası.' });
    }
});


// Aylık Gelir ve Gider Dağılımını Getirme Rotası (Category Distribution)
router.get('/financial-summary/monthly-category-distribution', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year, month, type } = req.query; // type is 'income' or 'expense'. month is 0-indexed from frontend.

    if (!year || month === undefined || !type) {
        return res.status(400).json({ message: 'Yıl, ay ve işlem tipi (income/expense) belirtmelisiniz.' });
    }

    let transactionType;
    if (type === 'income') {
        transactionType = 'Gelir';
    } else if (type === 'expense') {
        transactionType = 'Gider';
    } else {
        return res.status(400).json({ message: 'Geçerli bir "type" (income veya expense) belirtmelisiniz.' });
    }

    // DÜZELTME: Tarihleri UTC olarak oluşturmaya devam ediyoruz.
    const startOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month), 1));
    const endOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) + 1, 1));

    let matchQuery = {
        userId: new ObjectId(userId),
        type: transactionType,
        date: { $gte: startOfMonth, $lt: endOfMonth }
    };

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
        console.error('Kategori dağılımı verilerini çekerken hata:', error);
        res.status(500).json({ message: 'Kategori dağılımı yüklenirken sunucu hatası.' });
    }
});

module.exports = router;
