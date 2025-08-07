// js/profile.js
// API Base URL'i
const API_BASE_URL = 'https://fingo-web.onrender.com/api';

// Yardımcı Fonksiyonlar
const getToken = () => localStorage.getItem('jwtToken');
const getUserId = () => localStorage.getItem('userId');
const getUserEmail = () => localStorage.getItem('userEmail');

// Mesaj Kutusu Fonksiyonu
function showMessageBox(message, type = 'success') {
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    if (!messageBox || !messageText) {
        console.error("Message box elements not found!");
        return;
    }
    messageText.innerHTML = message;
    messageBox.className = `message-box show ${type}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => {
        messageBox.classList.remove('show');
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Kimlik Doğrulama Hatası Yönetimi
function handleAuthError() {
    showMessageBox('Oturum süreniz doldu veya yetkiniz yok. Lütfen tekrar giriş yapın.', 'error');
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    window.location.href = '/Fingo-WEB/auth.html'; // GitHub Pages için mutlak yol
}

// DOMContentLoaded olayı, tüm HTML yüklendikten sonra tetiklenir
document.addEventListener('DOMContentLoaded', () => {
    console.log("Profile page DOMContentLoaded fired. Initializing...");

    // Token ve Kullanıcı ID'sini kontrol et
    const jwtToken = getToken();
    const userId = getUserId();
    const userEmail = getUserEmail();

    if (!jwtToken || !userId || !userEmail) {
        handleAuthError();
        return;
    }

    // DOM Elementleri
    const loggedInUserSpan = document.getElementById('loggedInUser');
    const logoutBtn = document.getElementById('logoutBtn');
    const backToDashboardBtn = document.getElementById('backToDashboardBtn');
    const userEmailSpan = document.getElementById('userEmailSpan');

    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');

    const twoFAStatusSpan = document.getElementById('twoFAStatus');
    const toggle2FABtn = document.getElementById('toggle2FABtn');
    const enable2FASection = document.getElementById('enable2FASection');
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const secretKeyText = document.getElementById('secretKeyText');
    const twoFACodeInput = document.getElementById('twoFACodeInput');
    const verify2FAEnableBtn = document.getElementById('verify2FAEnableBtn');
    const cancel2FAEnableBtn = document.getElementById('cancel2FAEnableBtn');
    const recoveryCodesSection = document.getElementById('recoveryCodesSection');
    const recoveryCodesList = document.getElementById('recoveryCodesList');
    const copyRecoveryCodesBtn = document.getElementById('copyRecoveryCodesBtn');
    const regenerateRecoveryCodesBtn = document.getElementById('regenerateRecoveryCodesBtn');

    // Kullanıcı e-postasını göster
    if (userEmailSpan) userEmailSpan.textContent = userEmail;
    if (loggedInUserSpan) loggedInUserSpan.textContent = `Hoş Geldin, ${userEmail.split('@')[0]}...`;

    // Çıkış Yap Butonu
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('fingoNotifications');
            window.location.href = '/Fingo-WEB/auth.html'; // GitHub Pages için mutlak yol
        });
    }

    // Ana Sayfaya Dön Butonu
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            window.location.href = '/Fingo-WEB/index.html'; // GitHub Pages için mutlak yol
        });
    }

    // Şifre Değiştirme Formu
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                showMessageBox('Tüm şifre alanları zorunludur.', 'warning');
                return;
            }
            if (newPassword !== confirmNewPassword) {
                showMessageBox('Yeni şifreler eşleşmiyor.', 'error');
                return;
            }
            if (newPassword.length < 8) {
                showMessageBox('Yeni şifre en az 8 karakter olmalıdır.', 'warning');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken}`
                    },
                    body: JSON.stringify({ userId, currentPassword, newPassword })
                });

                const result = await response.json();
                if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
                if (!response.ok) {
                    throw new Error(result.message || 'Şifre değiştirme başarısız oldu.');
                }

                showMessageBox(result.message, 'success');
                changePasswordForm.reset();
            } catch (error) {
                console.error('Şifre değiştirme hatası:', error);
                showMessageBox(`Şifre değiştirilirken hata: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Durumunu Çek ve Göster
    async function fetch2FAStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/users/2fa-status?userId=${userId}`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });

            if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '2FA durumu çekilemedi.');
            }
            const data = await response.json();
            const is2FAEnabled = data.is2FAEnabled;

            if (twoFAStatusSpan) {
                twoFAStatusSpan.textContent = is2FAEnabled ? 'Etkin' : 'Devre Dışı';
                twoFAStatusSpan.classList.toggle('text-green-500', is2FAEnabled);
                twoFAStatusSpan.classList.toggle('text-red-500', !is2FAEnabled);
            }

            if (toggle2FABtn) {
                toggle2FABtn.textContent = is2FAEnabled ? '2FA\'yı Devre Dışı Bırak' : '2FA\'yı Etkinleştir';
                toggle2FABtn.classList.toggle('bg-red-500', is2FAEnabled);
                toggle2FABtn.classList.toggle('hover:bg-red-600', is2FAEnabled);
                toggle2FABtn.classList.toggle('bg-blue-600', !is2FAEnabled);
                toggle2FABtn.classList.toggle('hover:bg-blue-700', !is2FAEnabled);
            }

            // Eğer 2FA etkinse kurtarma kodlarını göster
            if (is2FAEnabled) {
                fetchRecoveryCodes();
            } else {
                if (recoveryCodesSection) recoveryCodesSection.classList.add('hidden');
            }

        } catch (error) {
            console.error('2FA durumu çekilirken hata:', error);
            showMessageBox(`2FA durumu yüklenirken hata: ${error.message}`, 'error');
        }
    }

    // QR Kodu Oluştur ve Gizli Anahtarı Göster
    async function generate2FASecret() {
        try {
            const response = await fetch(`${API_BASE_URL}/2fa/generate-secret`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({ userId })
            });

            const result = await response.json();
            if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
            if (!response.ok) {
                throw new Error(result.message || '2FA gizli anahtarı oluşturulamadı.');
            }

            const { secret, otpauthUrl } = result;

            if (qrCodeContainer) {
                qrCodeContainer.innerHTML = ''; // Önceki QR'ı temizle
                new QRCode(qrCodeContainer, {
                    text: otpauthUrl,
                    width: 180,
                    height: 180,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.H
                });
            }
            if (secretKeyText) secretKeyText.textContent = `Gizli Anahtar: ${secret}`;
            if (enable2FASection) enable2FASection.classList.remove('hidden');

        } catch (error) {
            console.error('2FA gizli anahtarı oluşturulurken hata:', error);
            showMessageBox(`2FA etkinleştirme hatası: ${error.message}`, 'error');
        }
    }

    // 2FA Etkinleştir/Devre Dışı Bırak Butonu
    if (toggle2FABtn) {
        toggle2FABtn.addEventListener('click', async () => {
            const currentStatus = twoFAStatusSpan.textContent === 'Etkin';
            if (currentStatus) {
                // 2FA'yı devre dışı bırakma isteği
                const confirmDisable = confirm("İki Faktörlü Kimlik Doğrulamayı devre dışı bırakmak istediğinizden emin misiniz?");
                if (!confirmDisable) return;

                try {
                    const response = await fetch(`${API_BASE_URL}/2fa/disable`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${jwtToken}`
                        },
                        body: JSON.stringify({ userId })
                    });

                    const result = await response.json();
                    if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
                    if (!response.ok) {
                        throw new Error(result.message || '2FA devre dışı bırakılamadı.');
                    }
                    showMessageBox(result.message, 'success');
                    fetch2FAStatus(); // Durumu güncelle
                    if (enable2FASection) enable2FASection.classList.add('hidden'); // Etkinleştirme alanını gizle
                } catch (error) {
                    console.error('2FA devre dışı bırakılırken hata:', error);
                    showMessageBox(`2FA devre dışı bırakılırken hata: ${error.message}`, 'error');
                }
            } else {
                // 2FA'yı etkinleştirme akışını başlat
                generate2FASecret();
            }
        });
    }

    // 2FA Etkinleştirme Kodunu Doğrula
    if (verify2FAEnableBtn) {
        verify2FAEnableBtn.addEventListener('click', async () => {
            const token = twoFACodeInput.value.trim();
            if (!token) {
                showMessageBox('Lütfen kimlik doğrulama uygulamasındaki kodu girin.', 'warning');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/verify-enable`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken}`
                    },
                    body: JSON.stringify({ userId, token })
                });

                const result = await response.json();
                if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
                if (!response.ok) {
                    throw new Error(result.message || '2FA doğrulama başarısız oldu.');
                }

                showMessageBox(result.message, 'success');
                if (enable2FASection) enable2FASection.classList.add('hidden');
                twoFACodeInput.value = ''; // Kodu temizle
                fetch2FAStatus(); // Durumu güncelle
            } catch (error) {
                console.error('2FA doğrulama hatası:', error);
                showMessageBox(`2FA doğrulanırken hata: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Etkinleştirme İptal Butonu
    if (cancel2FAEnableBtn) {
        cancel2FAEnableBtn.addEventListener('click', () => {
            if (enable2FASection) enable2FASection.classList.add('hidden');
            twoFACodeInput.value = '';
            // İptal edildiğinde 2FA gizli anahtarını sunucudan silmek isteyebiliriz
            // Ancak bu, backend'de ayrı bir rota gerektirir. Şimdilik sadece gizliyoruz.
        });
    }

    // Kurtarma Kodlarını Çek ve Göster
    async function fetchRecoveryCodes() {
        try {
            const response = await fetch(`${API_BASE_URL}/2fa/recovery-codes?userId=${userId}`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });

            if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Kurtarma kodları çekilemedi.');
            }
            const data = await response.json();
            const recoveryCodes = data.recoveryCodes || [];

            if (recoveryCodesList) {
                recoveryCodesList.innerHTML = '';
                if (recoveryCodes.length > 0) {
                    recoveryCodes.forEach(code => {
                        const li = document.createElement('li');
                        li.textContent = code;
                        recoveryCodesList.appendChild(li);
                    });
                    if (recoveryCodesSection) recoveryCodesSection.classList.remove('hidden');
                } else {
                    if (recoveryCodesSection) recoveryCodesSection.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Kurtarma kodları çekilirken hata:', error);
            showMessageBox(`Kurtarma kodları yüklenirken hata: ${error.message}`, 'error');
        }
    }

    // Kurtarma Kodlarını Kopyala Butonu
    if (copyRecoveryCodesBtn) {
        copyRecoveryCodesBtn.addEventListener('click', () => {
            const codes = Array.from(recoveryCodesList.children).map(li => li.textContent).join('\n');
            if (codes) {
                document.execCommand('copy'); // Eski ama uyumlu yöntem
                const tempInput = document.createElement('textarea');
                tempInput.value = codes;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand('copy');
                document.body.removeChild(tempInput);
                showMessageBox('Kurtarma kodları panoya kopyalandı!', 'success');
            } else {
                showMessageBox('Kopyalanacak kurtarma kodu bulunamadı.', 'warning');
            }
        });
    }

    // Kurtarma Kodlarını Yeniden Oluştur Butonu
    if (regenerateRecoveryCodesBtn) {
        regenerateRecoveryCodesBtn.addEventListener('click', async () => {
            const confirmRegenerate = confirm("Yeni kurtarma kodları oluşturmak istediğinizden emin misiniz? Eski kodlar geçersiz olacaktır.");
            if (!confirmRegenerate) return;

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/regenerate-recovery-codes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken}`
                    },
                    body: JSON.stringify({ userId })
                });

                const result = await response.json();
                if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
                if (!response.ok) {
                    throw new Error(result.message || 'Kurtarma kodları yeniden oluşturulamadı.');
                }
                showMessageBox(result.message, 'success');
                fetchRecoveryCodes(); // Yeni kodları çek ve göster
            } catch (error) {
                console.error('Kurtarma kodları yeniden oluşturulurken hata:', error);
                showMessageBox(`Kurtarma kodları yeniden oluşturulurken hata: ${error.message}`, 'error');
            }
        });
    }

    // Sayfa yüklendiğinde 2FA durumunu çek
    fetch2FAStatus();
});
