// public/js/auth.js
import { TwoFactorAuthHandler } from './twoFactorAuth.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://fingo-web.onrender.com/api';

    // DOM Elementleri
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    // Düzeltme: showRegister ve showLogin butonları için doğru ID'ler
    const showRegisterFormBtn = document.getElementById('showRegister'); // auth.html'deki ID
    const showLoginFormBtn = document.getElementById('showLogin');     // auth.html'deki ID
    const loginSection = document.getElementById('loginForm'); // auth.html'de loginForm div'i loginSection olarak kullanılıyor
    const registerSection = document.getElementById('registerForm'); // auth.html'de registerForm div'i registerSection olarak kullanılıyor

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
    // Düzeltme: twoFactorAuthMessage elementini de alıyoruz
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
        return; // Modal yoksa daha fazla ilerleme
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
        twoFactorAuthMessage, // Düzeltme: Mesaj elementini de iletiyoruz
        showMessage: showMessageBox,
        apiBaseUrl: API_BASE_URL
    });
    console.log("TwoFactorAuthHandler initialized.");


    // Form görünürlüğünü değiştir
    // Düzeltme: showRegisterBtn ve showLoginBtn yerine showRegisterFormBtn ve showLoginFormBtn kullanıyoruz
    if (showRegisterFormBtn) {
        showRegisterFormBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Varsayılan link davranışını engelle
            if (loginSection) loginSection.classList.add('hidden');
            if (registerSection) registerSection.classList.remove('hidden');
        });
    }

    if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Varsayılan link davranışını engelle
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
            const confirmPassword = document.getElementById('confirmPassword').value; // Confirm password'ı da al

            if (!email || !password || !confirmPassword) { // Confirm password kontrolü de eklendi
                showMessageBox('Lütfen tüm alanları doldurun.', 'error');
                return;
            }
            if (password !== confirmPassword) { // Parola eşleşme kontrolü
                showMessageBox('Parolalar eşleşmiyor.', 'error');
                return;
            }
            // Parola regex kontrolü: en az 8 karakter, büyük/küçük harf, rakam, özel karakter
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]:;"'<>,.?/~`]).*$/;
            if (password.length < 8 || password.length > 50 || !passwordRegex.test(password)) {
                showMessageBox('Parola en az 8 karakter, büyük/küçük harf, rakam ve özel karakter içermelidir.', 'error');
                return;
            }


            // Buton durumunu güncelle
            const registerBtn = document.getElementById('registerBtn'); // Buton referansını al
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
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                showMessageBox('Lütfen e-posta ve parolanızı girin.', 'error');
                return;
            }

            // Buton durumunu güncelle
            const loginBtn = document.getElementById('loginBtn'); // Buton referansını al
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Giriş Yapılıyor...';

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();
                if (!response.ok) {
                    // 2FA gerekiyorsa özel mesajı işle
                    if (response.status === 403 && result.message === '2FA gerekli.') {
                        showMessageBox('2FA gerekli. Lütfen e-postanıza gönderilen kodu girin.', 'info');
                        console.log("2FA required. Calling TwoFactorAuthHandler.show2FAModal with email:", email, "and token:", result.token);
                        // Düzeltme: Parametre sıralaması userEmail, jwtToken, mode
                        TwoFactorAuthHandler.show2FAModal(email, result.token, 'login');

                        localStorage.setItem('jwtToken', result.token);
                        localStorage.setItem('userId', result.userId);
                        localStorage.setItem('userEmail', email);
                        return;
                    }
                    throw new Error(result.message || 'Giriş başarısız oldu.');
                }

                // Normal giriş başarılı
                localStorage.setItem('jwtToken', result.token);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('userEmail', email); // E-postayı da kaydet
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
    }

    // 2FA Modal Kapatma Butonu
    if (closeTwoFactorAuthModalBtn) {
        closeTwoFactorAuthModalBtn.addEventListener('click', () => {
            TwoFactorAuthHandler.hide2FAModal();
            twoFactorAuthCodeInput.value = ''; // Kodu temizle
            // tempUserEmail ve tempJwtToken TwoFactorAuthHandler içinde yönetiliyor
        });
    }

    // 2FA Kodu Doğrulama Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // Bu kısım artık TwoFactorAuthHandler içinde _handleVerifyButtonClick tarafından yönetiliyor.
    // auth.js içinde manuel olarak dinleyici eklemeye gerek yok.
    // if (verifyTwoFactorAuthBtn) {
    //     verifyTwoFactorAuthBtn.addEventListener('click', async () => {
    //         const code = twoFactorAuthCodeInput.value.trim();
    //         const userEmail = localStorage.getItem('userEmail');
    //         const jwtToken = localStorage.getItem('jwtToken');

    //         const verificationResult = await TwoFactorAuthHandler.verify2FACodeLogin(userEmail, code);

    //         if (verificationResult.success) {
    //             localStorage.setItem('jwtToken', verificationResult.token);
    //             localStorage.setItem('userId', verificationResult.userId);
    //             localStorage.setItem('userEmail', userEmail); // E-postayı da kaydet
    //             showMessageBox('2FA doğrulama başarılı! Giriş yapılıyor...', 'success');
    //             TwoFactorAuthHandler.hide2FAModal();
    //             setTimeout(() => {
    //                 window.location.href = '/Fingo-WEB/index.html';
    //             }, 500);
    //         } else {
    //             showMessageBox(verificationResult.message || '2FA kodu geçersiz.', 'error');
    //         }
    //     });
    // }

    // 2FA Kodu Tekrar Gönder Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // Bu kısım artık TwoFactorAuthHandler içinde _handleResendButtonClick tarafından yönetiliyor.
    // if (resendTwoFactorAuthCodeBtn) {
    //     resendTwoFactorAuthCodeBtn.addEventListener('click', async () => {
    //         const userEmail = localStorage.getItem('userEmail');
    //         const jwtToken = localStorage.getItem('jwtToken');
    //         const resendResult = await TwoFactorAuthHandler.resend2FACode(userEmail, jwtToken);
    //         if (!resendResult.success) {
    //             showMessageBox(resendResult.message || 'Kod tekrar gönderilemedi.', 'error');
    //         }
    //     });
    // }

    // Kurtarma Kodu Kullan Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // Bu kısım artık TwoFactorAuthHandler içinde _handleUseRecoveryCodeClick tarafından yönetiliyor.
    // if (useRecoveryCodeBtn) {
    //     useRecoveryCodeBtn.addEventListener('click', () => {
    //         TwoFactorAuthHandler.showRecoveryCodeInput();
    //     });
    // }
});
