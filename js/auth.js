// public/js/auth.js
import { TwoFactorAuthHandler } from './twoFactorAuth.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://fingo-web.onrender.com/api';

    // DOM Elementleri
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterFormBtn = document.getElementById('showRegister');
    const showLoginFormBtn = document.getElementById('showLogin');
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
            if (loginSection) loginSection.classList.add('hidden');
            if (registerSection) registerSection.classList.remove('hidden');
        });
    }

    if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerSection) registerSection.classList.add('hidden');
            if (loginSection) loginSection.classList.remove('hidden');
        });
    }

    // Kayıt Formu Gönderimi
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
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
                if (registerSection) registerSection.classList.add('hidden');
                if (loginSection) loginSection.classList.remove('hidden');
            } catch (error) {
                console.error('Kayıt hatası:', error);
                showMessageBox(`Kayıt olurken hata: ${error.message}`, 'error');
            } finally {
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'Kayıt Ol';
            }
        });
    }

    // Giriş Formu Gönderimi
    // DÜZELTME: loginForm.addEventListener('submit', ...) yerine loginBtn.addEventListener('click', ...) kullanıyoruz
    // Eğer loginForm submit event listener'ı çalışmıyorsa, doğrudan butona bağlanmak daha güvenli olabilir.
    const loginBtn = document.getElementById('loginBtn'); // loginBtn referansını burada alıyoruz

    if (loginBtn) { // loginBtn'in varlığını kontrol et
        loginBtn.addEventListener('click', async (e) => {
            e.preventDefault(); // Formun varsayılan submit davranışını engelle
            console.log("Login button clicked!"); // Yeni log
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                showMessageBox('Lütfen e-posta ve parolanızı girin.', 'error');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Giriş Yapılıyor...';

            console.log("Attempting to fetch /api/login with email:", email); // Yeni log

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                console.log("Fetch response received:", response); // Yeni log

                const result = await response.json();
                console.log("Fetch result parsed:", result); // Yeni log

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

                localStorage.setItem('jwtToken', result.token);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('userEmail', email);
                showMessageBox(result.message, 'success');
                setTimeout(() => {
                    window.location.href = '/Fingo-WEB/index.html';
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
        console.error("CRITICAL ERROR: 'loginBtn' element not found!"); // Yeni log
    }


    // 2FA Modal Kapatma Butonu
    const closeTwoFactorAuthModalBtn = document.getElementById('closeTwoFactorAuthModalBtn');
    if (closeTwoFactorAuthModalBtn) {
        closeTwoFactorAuthModalBtn.addEventListener('click', () => {
            TwoFactorAuthHandler.hide2FAModal();
            twoFactorAuthCodeInput.value = '';
        });
    }
});
