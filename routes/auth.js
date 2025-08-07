// public/js/auth.js
import { TwoFactorAuthHandler } from './twoFactorAuth.js';

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://fingo-web.onrender.com/api';

    // DOM Elementleri
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterFormBtn = document.getElementById('showRegisterFormBtn');
    const showLoginFormBtn = document.getElementById('showLoginFormBtn');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');
    const twoFactorAuthModal = document.getElementById('twoFactorAuthModal');
    const twoFactorAuthCodeInput = document.getElementById('twoFactorAuthCode');
    const verifyTwoFactorAuthBtn = document.getElementById('verifyTwoFactorAuthBtn');
    const resendTwoFactorAuthCodeBtn = document.getElementById('resendTwoFactorAuthCodeBtn');
    const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');
    const twoFactorAuthModalTitle = document.getElementById('twoFactorAuthModalTitle');

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

    // TwoFactorAuthHandler'ı başlat
    TwoFactorAuthHandler.init({
        twoFactorAuthModal,
        twoFactorAuthCodeInput,
        verifyTwoFactorAuthBtn,
        resendTwoFactorAuthCodeBtn,
        useRecoveryCodeBtn,
        twoFactorAuthModalTitle,
        showMessage: showMessageBox, // showMessageBox'ı TwoFactorAuthHandler'a iletiyoruz
        apiBaseUrl: API_BASE_URL
    });

    // Form görünürlüğünü değiştir
    if (showRegisterFormBtn) {
        showRegisterFormBtn.addEventListener('click', () => {
            if (loginSection) loginSection.classList.add('hidden');
            if (registerSection) registerSection.classList.remove('hidden');
        });
    }

    if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', () => {
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
            }
        });
    }

    // Giriş Formu Gönderimi
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

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
                        TwoFactorAuthHandler.show2FAModal(email, result.token, 'login'); // DÜZELTME: email ve token gönderiliyor
                        // Token'ı localStorage'a kaydet (2FA doğrulaması için)
                        localStorage.setItem('jwtToken', result.token);
                        localStorage.setItem('userId', result.userId);
                        localStorage.setItem('userEmail', email); // E-postayı da kaydet
                        return; // 2FA modalını gösterdikten sonra işlemi durdur
                    }
                    throw new Error(result.message || 'Giriş başarısız oldu.');
                }

                // Normal giriş başarılı
                localStorage.setItem('jwtToken', result.token);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('userEmail', email); // E-postayı da kaydet
                showMessageBox(result.message, 'success');
                window.location.href = '/Fingo-WEB/index.html'; // GitHub Pages için mutlak yol

            } catch (error) {
                console.error('Giriş hatası:', error);
                showMessageBox(`Giriş yapılırken hata: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Modal Kapatma Butonu
    const closeTwoFactorAuthModalBtn = document.getElementById('closeTwoFactorAuthModalBtn');
    if (closeTwoFactorAuthModalBtn) {
        closeTwoFactorAuthModalBtn.addEventListener('click', () => {
            TwoFactorAuthHandler.hide2FAModal();
        });
    }

    // 2FA Kodu Doğrulama Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // if (verifyTwoFactorAuthBtn) {
    //     verifyTwoFactorAuthBtn.addEventListener('click', async () => {
    //         const code = twoFactorAuthCodeInput.value;
    //         const userEmail = localStorage.getItem('userEmail'); // E-postayı localStorage'dan al
    //         const jwtToken = localStorage.getItem('jwtToken');

    //         const result = await TwoFactorAuthHandler.verify2FACodeLogin(userEmail, code);
    //         if (result.success) {
    //             showMessageBox(result.message, 'success');
    //             TwoFactorAuthHandler.hide2FAModal();
    //             // Eğer 2FA doğrulandıysa ana sayfaya yönlendir
    //             if (result.is2FAVerified) {
    //                 window.location.href = '/Fingo-WEB/index.html';
    //             }
    //         } else {
    //             showMessageBox(result.message, 'error');
    //         }
    //     });
    // }

    // 2FA Kodu Tekrar Gönder Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // if (resendTwoFactorAuthCodeBtn) {
    //     resendTwoFactorAuthCodeBtn.addEventListener('click', async () => {
    //         const userEmail = localStorage.getItem('userEmail');
    //         const jwtToken = localStorage.getItem('jwtToken');
    //         const result = await TwoFactorAuthHandler.resend2FACode(userEmail, jwtToken);
    //         if (!result.success) {
    //             showMessageBox(result.message, 'error');
    //         }
    //     });
    // }

    // Kurtarma Kodu Kullan Butonu (TwoFactorAuthHandler tarafından yönetiliyor)
    // if (useRecoveryCodeBtn) {
    //     useRecoveryCodeBtn.addEventListener('click', () => {
    //         TwoFactorAuthHandler.showRecoveryCodeInput();
    //     });
    // }
});
