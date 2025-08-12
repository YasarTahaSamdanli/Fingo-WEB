// auth.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired. Initializing Auth page.");

    const API_BASE_URL = 'https://fingo-web.onrender.com/api'; // Render.com API'nin kök URL'si

    // DOM Element Referansları
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const toggleToRegisterBtn = document.getElementById('toggleToRegister');
    const toggleToLoginBtn = document.getElementById('toggleToLogin');
    const emailInputLogin = document.getElementById('emailLogin');
    const passwordInputLogin = document.getElementById('passwordLogin');
    const emailInputRegister = document.getElementById('emailRegister');
    const passwordInputRegister = document.getElementById('passwordRegister');
    const passwordConfirmInputRegister = document.getElementById('passwordConfirmRegister');
    const twoFactorAuthModal = document.getElementById('twoFactorAuthModal');
    const twoFactorAuthCodeInput = document.getElementById('twoFactorAuthCode');
    const verifyTwoFactorAuthBtn = document.getElementById('verifyTwoFactorAuthBtn');
    const resendTwoFactorAuthCodeBtn = document.getElementById('resendTwoFactorAuthCodeBtn');
    const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');
    const recoveryCodeInput = document.getElementById('recoveryCodeInput'); // Kurtarma kodu inputu
    const verifyRecoveryCodeBtn = document.getElementById('verifyRecoveryCodeBtn'); // Kurtarma kodu doğrulama butonu
    const recoveryCodeSection = document.getElementById('recoveryCodeSection'); // Kurtarma kodu bölümü

    // Mesaj Kutusu Elementleri
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // Elementlerin varlığını kontrol et
    if (!loginForm) console.error("Login form element not found!");
    if (!registerForm) console.error("Register form element not found!");
    if (!twoFactorAuthModal) console.error("TwoFactorAuthModal element not found!");
    else console.log("SUCCESS: 'twoFactorAuthModal' element found:", twoFactorAuthModal);

    // Global Değişkenler
    let currentUserId = null; // 2FA işlemi sırasında kullanıcının ID'sini saklamak için

    // Mesaj Kutusu Göster/Gizle
    function showMessage(message, type = 'success') {
        if (!messageBox || !messageText) {
            console.error("Message box elements not found!");
            return;
        }
        messageText.innerHTML = message;
        messageBox.className = `message-box show ${type}`;
        messageBox.classList.remove('hidden'); // Gizli sınıfını kaldır
        setTimeout(() => {
            messageBox.classList.remove('show');
            setTimeout(() => {
                messageBox.classList.add('hidden'); // Gizli sınıfını ekle
            }, 300); // Transition süresi kadar bekle
        }, 3000);
    }

    // Confirm Box fonksiyonu
    function showConfirmBox(message, onConfirm) {
        if (!messageBox || !messageText) {
            console.error("Message box elements not found! Cannot display confirm box.");
            return;
        }

        messageBox.innerHTML = `
            <span id="messageText">${message}</span>
            <div class="flex justify-center space-x-4 mt-3">
                <button id="confirmYes" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">Evet</button>
                <button id="confirmNo" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">Hayır</button>
            </div>
        `;
        messageBox.classList.add('show', 'confirm');
        messageBox.classList.remove('hidden', 'success', 'error', 'info', 'warning');

        document.getElementById('confirmYes').onclick = () => {
            onConfirm();
            messageBox.classList.remove('show', 'confirm');
            messageBox.classList.add('hidden');
            // Orijinal mesaj kutusu içeriğini geri yükle
            messageBox.innerHTML = '<span id="messageText"></span><button class="message-box-close" onclick="document.getElementById(\'messageBox\').classList.add(\'hidden\');">&times;</button>';
        };

        document.getElementById('confirmNo').onclick = () => {
            messageBox.classList.remove('show', 'confirm');
            messageBox.classList.add('hidden');
            // Orijinal mesaj kutusu içeriğini geri yükle
            messageBox.innerHTML = '<span id="messageText"></span><button class="message-box-close" onclick="document.getElementById(\'messageBox\').classList.add(\'hidden\');">&times;</button>';
        };
    }

    // 2FA Modal Göster/Gizle
    function showTwoFactorAuthModal() {
        if (twoFactorAuthModal) twoFactorAuthModal.classList.remove('hidden');
        if (recoveryCodeSection) recoveryCodeSection.classList.add('hidden'); // Kurtarma kodu bölümünü gizle
    }

    function hideTwoFactorAuthModal() {
        if (twoFactorAuthModal) twoFactorAuthModal.classList.add('hidden');
        if (twoFactorAuthCodeInput) twoFactorAuthCodeInput.value = ''; // Kodu temizle
    }

    // 2FA modal kapatma butonu
    if (twoFactorAuthModal) {
        const twoFactorAuthModalCloseBtn = twoFactorAuthModal.querySelector('.absolute.top-4.right-4');
        if (twoFactorAuthModalCloseBtn) {
            twoFactorAuthModalCloseBtn.addEventListener('click', hideTwoFactorAuthModal);
        }
    }
    console.log("TwoFactorAuthHandler initialized."); // Konsol çıktısı

    // Form Geçişleri
    if (toggleToRegisterBtn) {
        toggleToRegisterBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            console.log("Register form element found:", registerForm); // Konsol çıktısı
        });
    }

    if (toggleToLoginBtn) {
        toggleToLoginBtn.addEventListener('click', () => {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            console.log("Login form element found:", loginForm); // Konsol çıktısı
        });
    }

    // Kayıt Formu Gönderimi
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInputRegister.value;
            const password = passwordInputRegister.value;
            const passwordConfirm = passwordConfirmInputRegister.value;

            if (password !== passwordConfirm) {
                showMessage('Şifreler eşleşmiyor.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();
                if (response.ok) {
                    showMessage(result.message || 'Kayıt başarılı! Lütfen giriş yapın.', 'success');
                    registerForm.classList.add('hidden');
                    loginForm.classList.remove('hidden');
                    emailInputLogin.value = email; // Kayıt olan e-postayı login formuna taşı
                } else {
                    showMessage(result.message || 'Kayıt başarısız oldu.', 'error');
                }
            } catch (error) {
                console.error('Kayıt işlemi sırasında hata:', error);
                showMessage('Kayıt işlemi sırasında bir ağ hatası oluştu.', 'error');
            }
        });
    }

    // Giriş Formu Gönderimi
    if (loginForm) {
        console.log("Login form element found:", loginForm); // Konsol çıktısı
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Login form submitted!"); // Konsol çıktısı

            const email = emailInputLogin.value;
            const password = passwordInputLogin.value;

            try {
                console.log(`Attempting to fetch ${API_BASE_URL}/auth/login with email: ${email}`); // Konsol çıktısı (URL'yi kontrol etmek için)

                const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, { // <<<< BURASI DÜZELTİLDİ: /api/login yerine /api/auth/login
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                console.log("Fetch response received:", loginResponse); // Konsol çıktısı
                const result = await loginResponse.json();
                console.log("Fetch result parsed:", result); // Konsol çıktısı

                if (loginResponse.ok) {
                    if (result.requires2FA) {
                        currentUserId = result.userId; // 2FA için userId'yi sakla
                        showMessage('2 Adımlı Doğrulama gerekli. Kodu girin.', 'info');
                        showTwoFactorAuthModal(); // 2FA modalını göster
                        // E-posta ile 2FA kodu gönderme isteği (opsiyonel, backend'de zaten tetikleniyorsa gerek yok)
                        // resendTwoFactorAuthCodeBtn.click(); // Otomatik olarak kod gönderilmesini tetikle
                    } else {
                        // JWT'yi ve userId'yi localStorage'a kaydet
                        localStorage.setItem('jwtToken', result.token);
                        localStorage.setItem('userId', result.userId);
                        localStorage.setItem('userEmail', email); // E-postayı da kaydet
                        showMessage(result.message || 'Giriş başarılı!', 'success');
                        window.location.href = 'index.html'; // Ana sayfaya yönlendir
                    }
                } else {
                    // Hata mesajını backend'den al veya genel bir hata göster
                    showMessage(result.message || 'Giriş başarısız oldu.', 'error');
                }
            } catch (error) {
                console.error('Giriş işlemi sırasında hata:', error);
                showMessage(`Giriş hatası: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Kodu Doğrulama
    if (verifyTwoFactorAuthBtn) {
        verifyTwoFactorAuthBtn.addEventListener('click', async () => {
            const code = twoFactorAuthCodeInput.value.trim();
            if (!code) {
                showMessage('Lütfen 2FA kodunu girin.', 'warning');
                return;
            }
            if (!currentUserId) {
                showMessage('Kullanıcı ID\'si bulunamadı. Lütfen tekrar giriş yapın.', 'error');
                hideTwoFactorAuthModal();
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, code })
                });

                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('jwtToken', result.token); // Yeni token'ı kaydet (2FA sonrası geçerli)
                    localStorage.setItem('userId', currentUserId);
                    localStorage.setItem('userEmail', emailInputLogin.value); // Login sırasındaki e-postayı al
                    showMessage(result.message || '2FA doğrulandı. Giriş başarılı!', 'success');
                    hideTwoFactorAuthModal();
                    window.location.href = 'index.html';
                } else {
                    showMessage(result.message || '2FA kodu geçersiz.', 'error');
                }
            } catch (error) {
                console.error('2FA doğrulama sırasında hata:', error);
                showMessage(`2FA doğrulama hatası: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Kodunu Tekrar Gönder
    if (resendTwoFactorAuthCodeBtn) {
        resendTwoFactorAuthCodeBtn.addEventListener('click', async () => {
            if (!currentUserId) {
                showMessage('Kullanıcı ID\'si bulunamadı. Lütfen tekrar giriş yapın.', 'error');
                hideTwoFactorAuthModal();
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/2fa/resend`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId })
                });

                const result = await response.json();
                if (response.ok) {
                    showMessage(result.message || 'Yeni kod e-postanıza gönderildi.', 'success');
                } else {
                    showMessage(result.message || 'Kod tekrar gönderilemedi.', 'error');
                }
            } catch (error) {
                console.error('Kod tekrar gönderme sırasında hata:', error);
                showMessage(`Kod tekrar gönderme hatası: ${error.message}`, 'error');
            }
        });
    }

    // Kurtarma Kodu Kullan butonu
    if (useRecoveryCodeBtn) {
        useRecoveryCodeBtn.addEventListener('click', () => {
            if (recoveryCodeSection) recoveryCodeSection.classList.remove('hidden');
            if (twoFactorAuthCodeInput) twoFactorAuthCodeInput.value = ''; // Normal 2FA kodunu temizle
            if (twoFactorAuthCodeInput) twoFactorAuthCodeInput.focus(); // Odakla
        });
    }

    // Kurtarma Kodu Doğrulama
    if (verifyRecoveryCodeBtn) {
        verifyRecoveryCodeBtn.addEventListener('click', async () => {
            const recoveryCode = recoveryCodeInput.value.trim();
            if (!recoveryCode) {
                showMessage('Lütfen kurtarma kodunu girin.', 'warning');
                return;
            }
            if (!currentUserId) {
                showMessage('Kullanıcı ID\'si bulunamadı. Lütfen tekrar giriş yapın.', 'error');
                hideTwoFactorAuthModal();
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/2fa/verify-recovery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, recoveryCode })
                });

                const result = await response.json();
                if (response.ok) {
                    localStorage.setItem('jwtToken', result.token);
                    localStorage.setItem('userId', currentUserId);
                    localStorage.setItem('userEmail', emailInputLogin.value);
                    showMessage(result.message || 'Kurtarma kodu doğrulandı. Giriş başarılı!', 'success');
                    hideTwoFactorAuthModal();
                    window.location.href = 'index.html';
                } else {
                    showMessage(result.message || 'Kurtarma kodu geçersiz.', 'error');
                }
            } catch (error) {
                console.error('Kurtarma kodu doğrulama sırasında hata:', error);
                showMessage(`Kurtarma kodu doğrulama hatası: ${error.message}`, 'error');
            }
        });
    }
});
