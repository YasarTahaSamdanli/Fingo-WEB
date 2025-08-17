// routes/transactions.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni işlem ekleme rotası (genel işlemler için)
router.post('/transactions', authenticateToken, async (req, res) => {
    const { type, amount, description, category, date } = req.body;
    const userId = req.user.userId;

    if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: 'Lütfen tüm gerekli alanları doldurun.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Miktar geçerli bir sayı olmalıdır.' });
    }

    try {
        const db = getDb();
        const newTransaction = {
            userId: new ObjectId(userId), // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            type,
            amount: parseFloat(amount),
            description,
            category: category || null,
            date: new Date(date),
            createdAt: new Date()
        };

        const result = await db.collection('transactions').insertOne(newTransaction);
        res.status(201).json({ message: 'İşlem başarıyla eklendi.', transactionId: result.insertedId });
    } catch (error) {
        console.error('İşlem eklerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// Tüm işlemleri getirme rotası (filtreleme ile)
router.get('/transactions', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { type, category, date, startDate, endDate } = req.query; // Yeni query parametreleri eklendi

    try {
        const db = getDb();
        const query = { userId: new ObjectId(userId) }; // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (type) { query.type = type; }
        if (category) { query.category = category; }

        if (date) {
            const filterDate = new Date(date);
            // Tarih aralığını UTC olarak belirle
            const startOfDay = new Date(Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()));
            const endOfDay = new Date(Date.UTC(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate() + 1));
            query.date = { $gte: startOfDay, $lt: endOfDay };
        } else if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                query.date.$gte = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
            }
            if (endDate) {
                const end = new Date(endDate);
                query.date.$lt = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate() + 1));
            }
        }

        const transactions = await db.collection('transactions').find(query).sort({ date: -1, createdAt: -1 }).toArray();
        res.status(200).json(transactions);
    } catch (error) {
        console.error('İşlemleri çekerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// İşlem güncelleme rotası
router.put('/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { type, amount, description, category, date } = req.body;
    const userId = req.user.userId;

    if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: 'Lütfen tüm gerekli alanları doldurun.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Miktar geçerli bir sayı olmalıdır.' });
    }

    try {
        const db = getDb();
        const updatedTransaction = {
            type,
            amount: parseFloat(amount),
            description,
            category: category || null,
            date: new Date(date),
            updatedAt: new Date()
        };

        const result = await db.collection('transactions').updateOne(
            { _id: new ObjectId(id), userId: new ObjectId(userId) }, // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            { $set: updatedTransaction }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'İşlem bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'İşlem başarıyla güncellendi.' });
    } catch (error) {
        console.error('İşlem güncellerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// İşlem silme rotası
router.delete('/transactions/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();
        const result = await db.collection('transactions').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'İşlem bulunamadı veya yetkiniz yok.' });
        }
        res.status(200).json({ message: 'İşlem başarıyla silindi.' });
    } catch (error) {
        console.error('İşlem silerken hata:', error);
        res.status(500).json({ message: 'Sunucu hatası. Lütfen tekrar deneyin.' });
    }
});

// CSV içe aktarma rotası
router.post('/transactions/import-csv', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    if (!req.body.csvData) {
        return res.status(400).json({ message: 'CSV verisi bulunamadı.' });
    }
    const csvData = req.body.csvData;

    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    const transactionsToInsert = [];
    const failedRecords = [];
    let importedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',');

        if (parts.length < 5) {
            failedRecords.push({ line: i + 1, reason: 'Eksik veri sütunları.', data: line });
            continue;
        }

        const [dateStr, type, amountStr, category, description] = parts;

        const dateParts = dateStr.split('.');
        if (dateParts.length !== 3) {
            failedRecords.push({ line: i + 1, reason: 'Geçersiz tarih formatı (GG.AA.YYYY bekleniyor).', data: line });
            continue;
        }
        const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        const transactionDate = new Date(formattedDate);

        if (isNaN(transactionDate.getTime())) {
            failedRecords.push({ line: i + 1, reason: 'Geçersiz tarih değeri.', data: line });
            continue;
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            failedRecords.push({ line: i + 1, reason: 'Geçersiz miktar değeri.', data: line });
            continue;
        }

        if (type !== 'Gelir' && type !== 'Gider') {
            failedRecords.push({ line: i + 1, reason: 'Geçersiz işlem tipi (Gelir veya Gider bekleniyor).', data: line });
            continue;
        }

        transactionsToInsert.push({
            userId: new ObjectId(userId), // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            type,
            amount,
            description: description || 'CSV İçe Aktarıldı',
            category: category || null,
            date: transactionDate,
            createdAt: new Date()
        });
    }

    try {
        const db = getDb();
        if (transactionsToInsert.length > 0) {
            const insertResult = await db.collection('transactions').insertMany(transactionsToInsert);
            importedCount = insertResult.insertedCount;
        }
        res.status(200).json({
            message: `${importedCount} işlem başarıyla içe aktarıldı, ${failedRecords.length} işlem başarısız oldu.`,
            importedCount,
            failedCount: failedRecords.length,
            failedRecords
        });
    } catch (error) {
        console.error('CSV içe aktarırken veritabanı hatası:', error);
        res.status(500).json({ message: 'CSV içe aktarılırken sunucu hatası oluştu.', error: error.message });
    }
});

// CSV dışa aktarma rotası
router.get('/transactions/export-csv', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const db = getDb();
        const transactions = await db.collection('transactions').find({ userId: new ObjectId(userId) }).sort({ date: 1 }).toArray(); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        let csvContent = "Tarih,Tip,Miktar,Kategori,Açıklama\n";

        transactions.forEach(tx => {
            const date = new Date(tx.date).toLocaleDateString('tr-TR');
            const type = tx.type;
            const amount = tx.amount.toFixed(2);
            const category = tx.category || '';
            const description = tx.description ? tx.description.replace(/"/g, '""') : '';

            csvContent += `"${date}","${type}",${amount},"${category}","${description}"\n`;
        });

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('fingo_islemler.csv');
        res.status(200).send(csvContent);

    } catch (error) {
        console.error('CSV dışa aktarırken hata:', error);
        res.status(500).json({ message: 'CSV dışa aktarılırken sunucu hatası oluştu.' });
    }
});

// Müşterinin veresiye borcuna yeni bir işlem (ödeme veya borç ekleme) ekleme
router.post('/transactions/credit', authenticateToken, async (req, res) => {
    const { customerId, amount, type, description } = req.body;
    const userId = req.user.userId;

    console.log('[DEBUG-BACKEND-TRANSACTION] POST /transactions/credit rotası çağrıldı.');
    console.log('[DEBUG-BACKEND-TRANSACTION] Gelen Body:', { customerId, amount, type, description });
    console.log(`[DEBUG-BACKEND-TRANSACTION] JWT'den gelen userId: ${userId}`);

    if (!customerId || amount === undefined || !type) {
        console.error('[DEBUG-BACKEND-TRANSACTION] Eksik alanlar: customerId, amount veya type eksik.');
        return res.status(400).json({ message: 'Müşteri ID, miktar ve işlem tipi gereklidir.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        console.error('[DEBUG-BACKEND-TRANSACTION] Geçersiz miktar değeri (POST):', amount, 'Parsed:', parsedAmount);
        return res.status(400).json({ message: 'Geçerli ve pozitif bir miktar girilmelidir.' });
    }

    if (type !== 'payment' && type !== 'debt') {
        console.error('[DEBUG-BACKEND-TRANSACTION] Geçersiz işlem tipi:', type);
        return res.status(400).json({ message: 'Geçersiz işlem tipi. "payment" veya "debt" olmalıdır.' });
    }

    try {
        const db = getDb();
        let customerObjectId;

        try {
            customerObjectId = new ObjectId(customerId);
        } catch (e) {
            console.error('[DEBUG-BACKEND-TRANSACTION] ObjectId dönüşüm hatası (POST):', e);
            return res.status(400).json({ message: 'Geçersiz ID formatı.' });
        }

        console.log(`[DEBUG-BACKEND-TRANSACTION] Müşteri aranıyor: { _id: ObjectId("${customerObjectId}"), userId: ObjectId("${userId}") }`);
        const customer = await db.collection('customers').findOne({ _id: customerObjectId, userId: new ObjectId(userId) }); // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz

        if (!customer) {
            console.error('[DEBUG-BACKEND-TRANSACTION] Müşteri bulunamadı. Sorgu parametreleri:', { _id: customerObjectId.toString(), userId: userId });
            const customerByIdOnly = await db.collection('customers').findOne({ _id: customerObjectId });
            if (customerByIdOnly) {
                console.warn(`[DEBUG-BACKEND-TRANSACTION] Müşteri ID ile bulundu (${customerByIdOnly._id}), ancak userId eşleşmiyor. Müşterinin veritabanındaki userId: ${customerByIdOnly.userId}`);
            } else {
                console.warn(`[DEBUG-BACKEND-TRANSACTION] Müşteri ID ile de bulunamadı.`);
            }
            return res.status(404).json({ message: 'Müşteri bulunamadı.' });
        }

        let newDebtAmount = customer.currentDebt || 0;

        if (type === 'payment') {
            newDebtAmount -= parsedAmount;
        } else if (type === 'debt') {
            newDebtAmount += parsedAmount;
        }

        if (newDebtAmount < 0) {
            newDebtAmount = 0;
        }

        console.log(`[DEBUG-BACKEND-TRANSACTION] Müşteri ${customer.name} (${customerId}) için eski borç: ${customer.currentDebt}, İşlem miktarı: ${parsedAmount}, İşlem tipi: ${type}, Yeni borç hesaplandı: ${newDebtAmount}`);

        const updateResult = await db.collection('customers').updateOne(
            { _id: customerObjectId, userId: new ObjectId(userId) },
            { $set: { currentDebt: newDebtAmount, updatedAt: new Date() } }
        );
        console.log(`[DEBUG-BACKEND-TRANSACTION] Müşteri güncelleme sonucu: matchedCount: ${updateResult.matchedCount}, modifiedCount: ${updateResult.modifiedCount}`);

        if (updateResult.matchedCount === 0) {
             console.error('[DEBUG-BACKEND-TRANSACTION] Müşteri güncellenemedi, belki eşleşme yoktu (userId veya _id hatası)');
             return res.status(500).json({ message: 'Müşteri güncellenemedi. Lütfen tekrar deneyin.' });
        }

        const newTransaction = {
            userId: new ObjectId(userId),
            customerId: customerObjectId,
            customerName: customer.name,
            type: type,
            amount: parsedAmount,
            description: description || (type === 'payment' ? 'Veresiye Ödemesi' : 'Manuel Borç Ekleme'),
            date: new Date(),
            createdAt: new Date()
        };
        const transactionInsertResult = await db.collection('transactions').insertOne(newTransaction);
        console.log(`[DEBUG-BACKEND-TRANSACTION] İşlem kaydı eklendi. Inserted ID: ${transactionInsertResult.insertedId}`);

        res.status(200).json({
            message: 'Veresiye işlemi başarıyla kaydedildi ve borç güncellendi.',
            newDebt: newDebtAmount
        });

    } catch (error) {
        console.error('[DEBUG-BACKEND-TRANSACTION] Veresiye işlemi kaydedilirken genel hata:', error);
        res.status(500).json({ message: 'Veresiye işlemi kaydedilirken sunucu hatası oluştu. Lütfen tekrar deneyin.', error: error.message });
    }
});

// Müşteriye ait veresiye işlemlerini getirme
router.get('/transactions/credit/:customerId', authenticateToken, async (req, res) => {
    const { customerId } = req.params;
    const userId = req.user.userId;

    try {
        const db = getDb();

        let customerObjectId;
        try {
            customerObjectId = new ObjectId(customerId);
        } catch (e) {
            console.error('[DEBUG-BACKEND-TRANSACTION] Geçersiz customerId formatı (GET):', customerId, e);
            return res.status(400).json({ message: 'Geçersiz müşteri ID formatı.' });
        }

        console.log(`[DEBUG-BACKEND-TRANSACTION] Veresiye işlemleri çekiliyor. customerId (string): ${customerId}, customerId (ObjectId): ${customerObjectId}, userId: ${userId}`);

        const creditTransactions = await db.collection('transactions').find({
            userId: new ObjectId(userId), // DÜZELTME: userId'yi ObjectId'ye dönüştürüyoruz
            customerId: customerObjectId,
            type: { $in: ['payment', 'debt'] }
        }).sort({ date: -1, createdAt: -1 }).toArray();

        console.log(`[DEBUG-BACKEND-TRANSACTION] Müşteri ${customerId} için ${creditTransactions.length} veresiye işlemi bulundu.`);
        res.status(200).json(creditTransactions);
    } catch (error) {
        console.error('Müşteriye ait veresiye işlemleri çekilirken hata:', error);
        res.status(500).json({ message: 'Müşteriye ait veresiye işlemleri çekilirken sunucu hatası oluştu.' });
    }
});


module.exports = router;
