// routes/financialSummary.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Genel Finansal Özeti Getirme Rotası (Bu zaten mevcuttu)
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

// YILLIK FİNANSAL ÖZETİ GETİRME ROTASI (Bu da mevcuttu, doğruluğunu teyit ettim)
// Frontend'den gelen yıl parametresine göre yıllık gelir, gider ve net bakiyeyi döndürür.
router.get('/financial-summary/annual', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year } = req.query;

    if (!year) {
        return res.status(400).json({ message: 'Yıl belirtmelisiniz.' });
    }

    try {
        const db = getDb();
        const startOfYear = new Date(parseInt(year), 0, 1);
        const endOfYear = new Date(parseInt(year) + 1, 0, 1);

        const annualSummary = await db.collection('transactions').aggregate([
            {
                $match: {
                    userId: new ObjectId(userId),
                    date: { $gte: startOfYear, $lt: endOfYear }
                }
            },
            {
                $group: {
                    _id: "$type", // Gelir veya Gider'e göre grupla
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


// YENİ EKLENECEK KOD: AYLIK FİNANSAL ÖZETİ GETİRME ROTASI
// Frontend'den gelen yıl ve ay parametrelerine göre aylık gelir, gider ve net bakiyeyi döndürür.
router.get('/financial-summary/monthly', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year, month } = req.query; // Ay 0-tabanlı (0-11) olarak gelebilir, dikkat!

    if (!year || month === undefined) {
        return res.status(400).json({ message: 'Yıl ve ay belirtmelisiniz.' });
    }

    try {
        const db = getDb();
        // JavaScript Date nesnesi için ay 0-tabanlıdır (Ocak=0, Ağustos=7).
        // Ancak frontend'den month=8 geliyorsa, bu Ağustos'u temsil eder.
        // API'de gelen ay değerini direkt kullanıyoruz, çünkü frontend'de month+1 yapılıyordu.
        // Frontend'den gelen ay 1-tabanlıysa (month=8 gibi), new Date(year, month-1, 1) olmalı.
        // Eğer frontend'den 0-tabanlı gelip burada +1 bekliyorsak, new Date(year, month, 1) olur.
        // Önceki konuşmamızdan frontend'in month değerini API'ye +1 yaparak gönderdiğini anlıyorum.
        // Dolayısıyla backend'de month-1 yaparak Date nesnesi oluşturacağız.

        const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1); // Frontend'den 1-tabanlı ay (örneğin 8) gelirse, burada 0-tabanlıya (7) çevir.
        const endOfMonth = new Date(parseInt(year), parseInt(month), 0); // Bir sonraki ayın 0. günü = mevcut ayın son günü

        console.log(`Backend: Aylık özet isteği - Yıl: ${year}, Ay (API'den Gelen): ${month}, MongoDB için Başlangıç Tarihi: ${startOfMonth}, Bitiş Tarihi: ${endOfMonth}`); // Debug log

        const monthlySummary = await db.collection('transactions').aggregate([
            {
                $match: {
                    userId: new ObjectId(userId),
                    date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: "$type", // Gelir veya Gider'e göre grupla
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
            month: parseInt(month), // API'den gelen 1-tabanlı ay
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


// Aylık Gelir ve Gider Dağılımını Getirme Rotası (Category Distribution) (Bu zaten mevcuttu)
// BU ROTANIN URL'İ /financial-summary/monthly-category-distribution olmalıdır.
router.get('/financial-summary/monthly-category-distribution', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { year, month, type } = req.query; // type is 'income' or 'expense'

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

    let matchQuery = { userId: new ObjectId(userId), type: transactionType };

    // Burada ay filtresini doğru uyguladığından emin ol.
    // Frontend'den gelen ay 1-tabanlı ise, parseInt(month) - 1 yapmalısın
    matchQuery.date = {
        $gte: new Date(parseInt(year), parseInt(month) - 1, 1), // Ayı 0-tabanlıya çevir
        $lt: new Date(parseInt(year), parseInt(month), 1) // Bir sonraki ayın ilk günü (bu ayın sonu için)
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
