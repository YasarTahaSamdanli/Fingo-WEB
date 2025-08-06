// routes/transactions.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Yeni işlem ekleme rotası
router.post('/transactions', authenticateToken, async (req, res) => {
    const { type, amount, description, category, date } = req.body;
    const userId = req.user.userId; // JWT'den gelen kullanıcı ID'si

    if (!type || !amount || !description || !date) {
        return res.status(400).json({ message: 'Lütfen tüm gerekli alanları doldurun.' });
    }
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Miktar geçerli bir sayı olmalıdır.' });
    }

    try {
        const db = getDb();
        const newTransaction = {
            userId: new ObjectId(userId),
            type,
            amount: parseFloat(amount),
            description,
            category: category || null, // Kategori opsiyonel
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
    const { type, category, description, startDate, endDate } = req.query;

    try {
        const db = getDb();
        const query = { userId: new ObjectId(userId) };

        if (type) {
            query.type = type;
        }
        if (category) {
            query.category = category;
        }
        if (description) {
            query.description = { $regex: description, $options: 'i' }; // Case-insensitive arama
        }
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                query.date.$gte = new Date(startDate);
            }
            if (endDate) {
                // Bitiş tarihini bir gün ileri alarak o günün sonuna kadar olan kayıtları dahil et
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                query.date.$lt = end;
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
            { _id: new ObjectId(id), userId: new ObjectId(userId) },
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
        const result = await db.collection('transactions').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });

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
    const { csvData } = req.body;

    if (!csvData) {
        return res.status(400).json({ message: 'CSV verisi bulunamadı.' });
    }

    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    const transactionsToInsert = [];
    const failedRecords = [];
    let importedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',');

        // Beklenen format: Tarih (GG.AA.YYYY),Tip (Gelir/Gider),Miktar,Kategori,Açıklama
        if (parts.length < 5) {
            failedRecords.push({ line: i + 1, reason: 'Eksik veri sütunları.', data: line });
            continue;
        }

        const [dateStr, type, amountStr, category, description] = parts;

        // Tarih formatı GG.AA.YYYY olduğu için YYYY-AA-GG'ye çevir
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
            userId: new ObjectId(userId),
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
        const transactions = await db.collection('transactions').find({ userId: new ObjectId(userId) }).sort({ date: 1 }).toArray();

        let csvContent = "Tarih,Tip,Miktar,Kategori,Açıklama\n"; // CSV başlıkları

        transactions.forEach(tx => {
            const date = new Date(tx.date).toLocaleDateString('tr-TR'); // GG.AA.YYYY formatı
            const type = tx.type;
            const amount = tx.amount.toFixed(2);
            const category = tx.category || '';
            const description = tx.description ? tx.description.replace(/"/g, '""') : ''; // Çift tırnakları kaçış karakteriyle değiştir

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

module.exports = router;
