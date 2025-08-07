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

    // 2FA Modal Elementleri
    const twoFactorAuthModal = document.getElementById('twoFactorAuthModal');
    const twoFactorAuthCodeInput = document.getElementById('twoFactorAuthCode');
    const verifyTwoFactorAuthBtn = document.getElementById('verifyTwoFactorAuthBtn');
    const resendTwoFactorAuthCodeBtn = document.getElementById('resendTwoFactorAuthCodeBtn');
    const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');
    const twoFactorAuthModalTitle = document.getElementById('twoFactorAuthModalTitle');
    const closeTwoFactorAuthModalBtn = document.getElementById('closeTwoFactorAuthModalBtn');


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

    // DÜZELTME: TwoFactorAuthHandler'ı başlatmadan önce modal elementinin varlığını kontrol et
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
        showMessage: showMessageBox,
        apiBaseUrl: API_BASE_URL
    });
    console.log("TwoFactorAuthHandler initialized.");


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
                        console.log("2FA required. Calling TwoFactorAuthHandler.show2FAModal with email:", email, "and token:", result.token);
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
                localStorage.setItem('userEmail', email);
                showMessageBox(result.message, 'success');
                window.location.href = '/Fingo-WEB/index.html';

            } catch (error) {
                console.error('Giriş hatası:', error);
                showMessageBox(`Giriş yapılırken hata: ${error.message}`, 'error');
            }
        });
    }

    // 2FA Modal Kapatma Butonu
    if (closeTwoFactorAuthModalBtn) {
        closeTwoFactorAuthModalBtn.addEventListener('click', () => {
            TwoFactorAuthHandler.hide2FAModal();
        });
    }
});
