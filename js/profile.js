// public/js/profile.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Profile.js script loaded.");

    // API Base URL
    const API_BASE_URL = 'https://fingo-web.onrender.com/api';

    // DOM Elementleri
    const goToDashboardBtn = document.getElementById('goToDashboardBtn');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const twoFAStatusDisplay = document.getElementById('2FAStatusDisplay');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    // 2FA Elementleri
    const enable2FASection = document.getElementById('enable2FASection');
    const disable2FASection = document.getElementById('disable2FASection');
    const generateSecretBtn = document.getElementById('generateSecretBtn');
    const qrcodeDisplayArea = document.getElementById('qrcodeDisplayArea');
    const qrcodeCanvas = document.getElementById('qrcodeCanvas');
    const secretKeyDisplay = document.getElementById('secretKeyDisplay');
    const twoFACodeInput = document.getElementById('2faCodeInput');
    const verify2FAEnableBtn = document.getElementById('verify2FAEnableBtn');
    const cancel2FASetupBtn = document.getElementById('cancel2FASetupBtn');
    const disable2FABtn = document.getElementById('disable2FABtn');
    const recoveryCodesSection = document.getElementById('recoveryCodesSection');
    const recoveryCodesDisplay = document.getElementById('recoveryCodesDisplay');
    const copyRecoveryCodesBtn = document.getElementById('copyRecoveryCodesBtn');
    const closeRecoveryCodesBtn = document.getElementById('closeRecoveryCodesBtn');

    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    let currentQRCode = null; // QR kodu örneğini tutmak için

    // Yardımcı Fonksiyon: Mesaj Kutusu Göster
    function showMessageBox(message, type = 'success') {
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
            }, 3000); // 3 saniye sonra gizle
        }, 500); // 0.5 saniye sonra gizle (daha hızlı tepki)
    }

    // JWT Token'ı çözümleme fonksiyonu (index.html'den kopyalandı)
    function parseJwt (token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error("JWT parse error:", e);
            return null;
        }
    };

    // Kimlik Doğrulama Hatası Yönetimi
    function handleAuthError() {
        console.error("Authentication error detected in profile page. Redirecting to login.");
        showMessageBox('Oturum süreniz doldu veya yetkiniz yok. Lütfen tekrar giriş yapın.', 'error');
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('fingoNotifications');
        setTimeout(() => {
            window.location.href = '/Fingo-WEB/auth.html'; // GitHub Pages için mutlak yol
        }, 1000);
    }

    // Kullanıcı Bilgilerini ve 2FA Durumunu Çek
    async function fetchUserProfile() {
        const token = localStorage.getItem('jwtToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
            handleAuthError();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/users/me?userId=${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Kullanıcı bilgileri çekilemedi.');
            }

            const userData = await response.json();
            userEmailDisplay.textContent = userData.email;
            twoFAStatusDisplay.textContent = userData.is2FAEnabled ? 'Etkin' : 'Devre Dışı';
            twoFAStatusDisplay.classList.toggle('text-green-600', userData.is2FAEnabled);
            twoFAStatusDisplay.classList.toggle('text-red-600', !userData.is2FAEnabled);

            // 2FA bölümlerinin görünürlüğünü ayarla
            if (userData.is2FAEnabled) {
                enable2FASection.classList.add('hidden');
                disable2FASection.classList.remove('hidden');
                qrcodeDisplayArea.classList.add('hidden'); // Etkinse QR alanı gizli kalsın
                recoveryCodesSection.classList.add('hidden'); // Kurtarma kodları da gizli kalsın
            } else {
                enable2FASection.classList.remove('hidden');
                disable2FASection.classList.add('hidden');
            }

        } catch (error) {
            console.error('Kullanıcı profili çekilirken hata:', error);
            showMessageBox(`Profil bilgileri yüklenirken hata: ${error.message}`, 'error');
        }
    }

    // Şifre Değiştirme Formu Gönderimi
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmNewPassword = confirmNewPasswordInput.value;

            if (!currentPassword || !newPassword || !confirmNewPassword) {
                showMessageBox('Lütfen tüm şifre alanlarını doldurun.', 'warning');
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

            changePasswordBtn.disabled = true;
            changePasswordBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Değiştiriliyor...';

            const token = localStorage.getItem('jwtToken');
            if (!token) {
                handleAuthError();
                changePasswordBtn.disabled = false;
                changePasswordBtn.innerHTML = 'Şifreyi Değiştir';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                const result = await response.json();
                if (response.status === 401 || response.status === 403) {
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.message || 'Şifre değiştirme başarısız oldu.');
                }

                showMessageBox(result.message, 'success');
                changePasswordForm.reset();
            } catch (error) {
                console.error('Şifre değiştirme hatası:', error);
                showMessageBox(`Şifre değiştirilirken hata: ${error.message}`, 'error');
            } finally {
                changePasswordBtn.disabled = false;
                changePasswordBtn.innerHTML = 'Şifreyi Değiştir';
            }
        });
    }

    // 2FA Gizli Anahtar Oluştur ve QR Kodu Göster
    if (generateSecretBtn) {
        generateSecretBtn.addEventListener('click', async () => {
            generateSecretBtn.disabled = true;
            generateSecretBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Oluşturuluyor...';
            showMessageBox('2FA gizli anahtar oluşturuluyor...', 'info');

            const token = localStorage.getItem('jwtToken');
            if (!token) {
                handleAuthError();
                generateSecretBtn.disabled = false;
                generateSecretBtn.innerHTML = '2FA Etkinleştir';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/generate-secret`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                const result = await response.json();
                console.log("Response from /2fa/generate-secret:", result); // KRİTİK LOG

                if (response.status === 401 || response.status === 403) {
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.message || '2FA gizli anahtarı oluşturulamadı.');
                }

                const otpauthUrl = result.otpauthUrl;
                const secretBase32 = result.secret;

                console.log("OTP Auth URL received:", otpauthUrl); // KRİTİK LOG
                console.log("Secret Base32 received:", secretBase32); // KRİTİK LOG

                if (!otpauthUrl || !secretBase32) {
                    throw new Error("Backend'den geçerli OTP Auth URL veya gizli anahtar alınamadı.");
                }

                // QR kodunu temizle ve yeniden oluştur
                if (currentQRCode) {
                    currentQRCode.clear(); // Mevcut QR kodunu temizle
                    qrcodeCanvas.innerHTML = ''; // HTML içeriğini de temizle
                }

                // DÜZELTME: QRCode global olarak tanımlandığı için window objesinden eriş
                currentQRCode = new window.QRCode(qrcodeCanvas, {
                    text: otpauthUrl,
                    width: 180,
                    height: 180,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : window.QRCode.CorrectLevel.H // DÜZELTME: CorrectLevel'e de window üzerinden eriş
                });

                secretKeyDisplay.textContent = secretBase32;
                qrcodeDisplayArea.classList.remove('hidden');
                showMessageBox('QR kodu başarıyla oluşturuldu.', 'success');
            } catch (error) {
                console.error('2FA gizli anahtarı oluşturulurken hata:', error);
                showMessageBox(`2FA gizli anahtar oluşturulurken hata: ${error.message}`, 'error');
            } finally {
                generateSecretBtn.disabled = false;
                generateSecretBtn.innerHTML = '2FA Etkinleştir';
            }
        });
    }

    // 2FA'yı Doğrula ve Etkinleştir
    if (verify2FAEnableBtn) {
        verify2FAEnableBtn.addEventListener('click', async () => {
            const code = twoFACodeInput.value.trim();
            if (!code) {
                showMessageBox('Lütfen 6 haneli doğrulama kodunu girin.', 'warning');
                return;
            }

            verify2FAEnableBtn.disabled = true;
            verify2FAEnableBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

            const token = localStorage.getItem('jwtToken');
            if (!token) {
                handleAuthError();
                verify2FAEnableBtn.disabled = false;
                verify2FAEnableBtn.innerHTML = '2FA\'yı Doğrula ve Etkinleştir';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/verify-enable`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ token: code }) // Backend'deki isimlendirmeye dikkat
                });
                const result = await response.json();
                console.log("Response from /2fa/verify-enable:", result); // KRİTİK LOG

                if (response.status === 401 || response.status === 403) {
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.message || '2FA etkinleştirme başarısız oldu.');
                }

                showMessageBox(result.message, 'success');
                qrcodeDisplayArea.classList.add('hidden'); // QR kod alanını gizle
                twoFACodeInput.value = ''; // Kodu temizle
                fetchUserProfile(); // 2FA durumunu güncelle

                // Kurtarma kodlarını göster
                if (result.recoveryCodes && result.recoveryCodes.length > 0) {
                    recoveryCodesDisplay.innerHTML = result.recoveryCodes.map(c => `<span class="bg-gray-200 px-3 py-1 rounded-md text-sm">${c}</span>`).join('');
                    recoveryCodesSection.classList.remove('hidden');
                }

            } catch (error) {
                console.error('2FA etkinleştirme hatası:', error);
                showMessageBox(`2FA etkinleştirilirken hata: ${error.message}`, 'error');
            } finally {
                verify2FAEnableBtn.disabled = false;
                verify2FAEnableBtn.innerHTML = '2FA\'yı Doğrula ve Etkinleştir';
            }
        });
    }

    // 2FA Kurulumunu İptal Et
    if (cancel2FASetupBtn) {
        cancel2FASetupBtn.addEventListener('click', () => {
            qrcodeDisplayArea.classList.add('hidden');
            twoFACodeInput.value = '';
            // Backend'den gizli anahtarı silmek istersen burada bir API çağrısı yapabilirsin.
            // Şimdilik sadece frontend'de gizliyoruz.
            showMessageBox('2FA kurulumu iptal edildi.', 'info');
            fetchUserProfile(); // Durumu tazelemek için
        });
    }

    // Kurtarma Kodlarını Kopyala
    if (copyRecoveryCodesBtn) {
        copyRecoveryCodesBtn.addEventListener('click', () => {
            const codesText = Array.from(recoveryCodesDisplay.children).map(span => span.textContent).join('\n');
            navigator.clipboard.writeText(codesText).then(() => {
                showMessageBox('Kurtarma kodları panoya kopyalandı!', 'success');
            }).catch(err => {
                console.error('Kurtarma kodlarını kopyalarken hata:', err);
                showMessageBox('Kurtarma kodları kopyalanamadı.', 'error');
            });
        });
    }

    // Kurtarma Kodları Alanını Kapat
    if (closeRecoveryCodesBtn) {
        closeRecoveryCodesBtn.addEventListener('click', () => {
            recoveryCodesSection.classList.add('hidden');
        });
    }

    // 2FA Devre Dışı Bırak
    if (disable2FABtn) {
        disable2FABtn.addEventListener('click', async () => {
            const confirmDisable = confirm("İki faktörlü kimlik doğrulamayı devre dışı bırakmak istediğinizden emin misiniz? Bu, hesabınızın güvenliğini azaltacaktır.");
            if (!confirmDisable) return;

            disable2FABtn.disabled = true;
            disable2FABtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Devre Dışı Bırakılıyor...';

            const token = localStorage.getItem('jwtToken');
            if (!token) {
                handleAuthError();
                disable2FABtn.disabled = false;
                disable2FABtn.innerHTML = '2FA Devre Dışı Bırak';
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/users/disable-2fa`, { // Yeni bir rota varsayıyoruz
                    method: 'POST', // veya DELETE
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ userId: localStorage.getItem('userId') })
                });
                const result = await response.json();
                console.log("Response from /users/disable-2fa:", result); // KRİTİK LOG

                if (response.status === 401 || response.status === 403) {
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.message || '2FA devre dışı bırakılamadı.');
                }

                showMessageBox(result.message, 'success');
                fetchUserProfile(); // Durumu güncelle
            } catch (error) {
                console.error('2FA devre dışı bırakılırken hata:', error);
                showMessageBox(`2FA devre dışı bırakılırken hata: ${error.message}`, 'error');
            } finally {
                disable2FABtn.disabled = false;
                disable2FABtn.innerHTML = '2FA Devre Dışı Bırak';
            }
        });
    }

    // Sayfa Yüklendiğinde
    if (goToDashboardBtn) {
        goToDashboardBtn.addEventListener('click', () => {
            window.location.href = '/Fingo-WEB/index.html'; // Ana sayfaya dön
        });
    }

    // Sayfa yüklendiğinde kullanıcı profilini ve 2FA durumunu çek
    fetchUserProfile();
});
