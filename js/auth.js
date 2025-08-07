// public/js/auth.js
console.log("auth.js script loaded and executing.");

import { TwoFactorAuthHandler } from './twoFactorAuth.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired in auth.js.");

    const API_BASE_URL = 'https://fingo-web.onrender.com/api';

    // DOM Elementleri
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterFormBtn = document.getElementById('showRegisterBtn');
    const showLoginFormBtn = document.getElementById('showLoginFormBtn');
    const loginSection = document.getElementById('loginForm');
    const registerSection = document.getElementById('registerForm');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // 2FA Modal Elementleri
    const twoFactorAuthModal = document.getElementById('twoFactorAuthModal');
    const twoFactorAuthCodeInput = document.getElementById('twoFactorAuthCode');
    const verifyTwoFactorAuthBtn = document.getElementById('verifyTwoFactorAuthBtn');
    const resendTwoFactorAuthCodeBtn = document.getElementById('resendTwoFactorAuthCodeBtn');
    const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');
    const twoFactorAuthModalTitle = document.getElementById('twoFactorAuthModalTitle');
    const closeTwoFactorAuthModalBtn = document.getElementById('closeTwoFactorAuthModalBtn');
    const twoFactorAuthMessage = document.getElementById('twoFactorAuthMessage');


    // Mesaj Kutusu Fonksiyonu
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
            }, 300);
        }, 3000);
    }

    // TwoFactorAuthHandler'ı başlatmadan önce modal elementinin varlığını kontrol et
    if (!twoFactorAuthModal) {
        console.error("CRITICAL ERROR: 'twoFactorAuthModal' element not found in auth.html!");
        showMessageBox("Uygulama hatası: 2FA modalı bulunamadı. Lütfen geliştiriciye başvurun.", "error");
        return;
    } else {
        console.log("SUCCESS: 'twoFactorAuthModal' element found:", twoFactorAuthModal);
    }


    // TwoFactorAuthHandler'ı başlat
    TwoFactorAuthHandler.init({
        twoFactorAuthModal,
        twoFactorAuthCodeInput,
        verifyTwoFactorAuthBtn,
        resendTwoFactorAuthCodeBtn,
        useRecoveryCodeBtn,
        twoFactorAuthModalTitle,
        twoFactorAuthMessage,
        showMessage: showMessageBox,
        apiBaseUrl: API_BASE_URL
    });
    console.log("TwoFactorAuthHandler initialized.");


    // Form görünürlüğünü değiştir
    if (showRegisterFormBtn) {
        showRegisterFormBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Show Register button clicked.");
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
        });
    }

    if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Show Login button clicked.");
            if (registerForm) registerForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
        });
    }

    // Kayıt Formu Gönderimi
    if (registerForm) {
        console.log("Register form element found:", registerForm);
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Register form submitted!");
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (!email || !password || !confirmPassword) {
                showMessageBox('Lütfen tüm alanları doldurun.', 'error');
                return;
            }
            if (password !== confirmPassword) {
                showMessageBox('Parolalar eşleşmiyor.', 'error');
                return;
            }
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]:;"'<>,.?/~`]).*$/;
            if (password.length < 8 || password.length > 50 || !passwordRegex.test(password)) {
                showMessageBox('Parola en az 8 karakter, büyük/küçük harf, rakam ve özel karakter içermelidir.', 'error');
                return;
            }

            const registerBtn = document.getElementById('registerBtn');
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Kaydediliyor...';

            try {
                const response = await fetch(`${API_BASE_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'Kayıt başarısız oldu.');
                }

                showMessageBox(result.message, 'success');
                registerForm.reset();
                if (loginForm) loginForm.classList.remove('hidden');
                if (registerForm) registerForm.classList.add('hidden');

            } catch (error) {
                console.error('Kayıt hatası:', error);
                showMessageBox(`Kayıt olurken hata: ${error.message}`, 'error');
            } finally {
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'Kayıt Ol';
            }
        });
    } else {
        console.error("CRITICAL ERROR: 'registerForm' element not found!");
    }

    // Giriş Formu Gönderimi
    const loginBtn = document.getElementById('loginBtn');

    if (loginBtn) {
        console.log("Login form element found:", loginForm); // loginForm'u logla
        loginForm.addEventListener('submit', async (e) => { // loginForm'un submit eventi
            e.preventDefault();
            console.log("Login form submitted!");
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                showMessageBox('Lütfen e-posta ve parolanızı girin.', 'error');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Giriş Yapılıyor...';

            console.log("Attempting to fetch /api/login with email:", email);

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                console.log("Fetch response received:", response);

                const result = await response.json();
                console.log("Fetch result parsed:", result);

                if (!response.ok) {
                    if (response.status === 403 && result.message === '2FA gerekli.') {
                        showMessageBox('2FA gerekli. Lütfen e-postanıza gönderilen kodu girin.', 'info');
                        console.log("2FA required. Calling TwoFactorAuthHandler.show2FAModal with email:", email, "and token:", result.token);
                        TwoFactorAuthHandler.show2FAModal(email, result.token, 'login');

                        localStorage.setItem('jwtToken', result.token);
                        localStorage.setItem('userId', result.userId);
                        localStorage.setItem('userEmail', email);
                        return;
                    }
                    throw new Error(result.message || 'Giriş başarısız oldu.');
                }

                // Normal giriş başarılı veya 2FA sonrası doğrulama başarılı
                localStorage.setItem('jwtToken', result.token);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('userEmail', email);
                showMessageBox(result.message, 'success');
                setTimeout(() => {
                    window.location.href = '/Fingo-WEB/index.html'; // GitHub Pages için mutlak yol
                }, 500);

            } catch (error) {
                console.error('Giriş hatası:', error);
                showMessageBox(`Giriş yapılırken hata: ${error.message}`, 'error');
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Giriş Yap';
            }
        });
    } else {
        console.error("CRITICAL ERROR: 'loginForm' element not found!");
    }


    // 2FA Modal Kapatma Butonu
    if (closeTwoFactorAuthModalBtn) {
        closeTwoFactorAuthModalBtn.addEventListener('click', () => {
            TwoFactorAuthHandler.hide2FAModal();
            twoFactorAuthCodeInput.value = '';
        });
    }

    // 2FA kodu doğrulama butonu olay dinleyicisi (auth.js içinde)
    if (verifyTwoFactorAuthBtn) {
        verifyTwoFactorAuthBtn.addEventListener('click', async () => {
            const code = twoFactorAuthCodeInput.value.trim();
            const userEmail = localStorage.getItem('userEmail'); // localStorage'dan al
            const jwtToken = localStorage.getItem('jwtToken'); // localStorage'dan al

            if (!code) {
                showMessageBox('Lütfen 2FA kodunu girin.', 'error');
                return;
            }
            if (!userEmail || !jwtToken) {
                showMessageBox('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
                return;
            }

            verifyTwoFactorAuthBtn.disabled = true;
            verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

            try {
                // twoFactorAuth.js modülündeki verify2FACodeLogin fonksiyonunu çağır
                const verificationResult = await TwoFactorAuthHandler.verify2FACodeLogin(userEmail, code); // jwtToken'ı burada göndermiyoruz, backend'de gerek yok

                if (verificationResult.success) {
                    // Düzeltme: Backend'den gelen yeni token, userId ve email'i kullan
                    localStorage.setItem('jwtToken', verificationResult.token);
                    localStorage.setItem('userId', verificationResult.userId);
                    localStorage.setItem('userEmail', verificationResult.email);

                    showMessageBox('2FA doğrulama başarılı! Giriş yapılıyor...', 'success');
                    TwoFactorAuthHandler.hide2FAModal();
                    setTimeout(() => {
                        window.location.href = '/Fingo-WEB/index.html'; // Ana sayfaya yönlendir
                    }, 500);
                } else {
                    showMessageBox(verificationResult.message || '2FA kodu geçersiz.', 'error');
                }
            } catch (error) {
                console.error('2FA doğrulama hatası:', error);
                showMessageBox(`2FA doğrulama sırasında bir hata oluştu: ${error.message}`, 'error');
            } finally {
                verifyTwoFactorAuthBtn.disabled = false;
                verifyTwoFactorAuthBtn.innerHTML = 'Kodu Doğrula';
            }
        });
    }

    // 2FA kodunu tekrar gönderme butonu olay dinleyicisi (auth.js içinde)
    if (resendTwoFactorAuthCodeBtn) {
        resendTwoFactorAuthCodeBtn.addEventListener('click', async () => {
            const userEmail = localStorage.getItem('userEmail');
            const jwtToken = localStorage.getItem('jwtToken'); // Token'ı da gönderiyoruz

            if (!userEmail) {
                showMessageBox('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
                return;
            }

            resendTwoFactorAuthCodeBtn.disabled = true;
            resendTwoFactorAuthCodeBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Gönderiliyor...';

            try {
                // TwoFactorAuthHandler'daki resend2FACode fonksiyonunu çağır
                const resendResult = await TwoFactorAuthHandler.resend2FACode(userEmail, jwtToken);
                if (resendResult.success) {
                    showMessageBox('Yeni kod e-postanıza gönderildi.', 'success');
                } else {
                    showMessageBox(resendResult.message || 'Kod tekrar gönderilemedi.', 'error');
                }
            } catch (error) {
                console.error('Kod tekrar gönderme hatası:', error);
                showMessageBox(`Kod tekrar gönderilirken bir hata oluştu: ${error.message}`, 'error');
            } finally {
                resendTwoFactorAuthCodeBtn.disabled = false;
                resendTwoFactorAuthCodeBtn.innerHTML = 'Kodu Tekrar Gönder';
            }
        });
    }

    // Kurtarma kodu kullanma butonu olay dinleyicisi (auth.js içinde)
    if (useRecoveryCodeBtn) {
        useRecoveryCodeBtn.addEventListener('click', () => {
            // Bu kısım twoFactorAuth.js içinde yönetilecek
            TwoFactorAuthHandler.showRecoveryCodeInput(); // Örneğin, modal içinde kurtarma kodu alanını göster
            showMessageBox('Kurtarma kodu ile giriş yapılıyor...', 'info');
        });
    }

});
