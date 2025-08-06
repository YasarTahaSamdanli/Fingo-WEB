// public/js/auth.js
import { TwoFactorAuthHandler } from './twoFactorAuth.js'; // Yeni 2FA modülünü içe aktarıyoruz

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegister');
    const showLoginBtn = document.getElementById('showLogin');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const registerEmailInput = document.getElementById('registerEmail');
    const registerPasswordInput = document.getElementById('registerPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const registerBtn = document.getElementById('registerBtn');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // 2FA modalı ile ilgili elemanlar
    const twoFactorAuthModal = document.getElementById('twoFactorAuthModal');
    const closeTwoFactorAuthModalBtn = document.getElementById('closeTwoFactorAuthModalBtn');
    const twoFactorAuthCodeInput = document.getElementById('twoFactorAuthCode');
    const verifyTwoFactorAuthBtn = document.getElementById('verifyTwoFactorAuthBtn');
    const resendTwoFactorAuthCodeBtn = document.getElementById('resendTwoFactorAuthCodeBtn');
    const useRecoveryCodeBtn = document.getElementById('useRecoveryCodeBtn');

    // API Base URL
    const API_BASE_URL = 'http://localhost:3000/api';

    // Geçici olarak 2FA akışı için kullanılacak kullanıcı bilgileri
    let tempUserEmail = null;
    let tempJwtToken = null; // 2FA doğrulaması için kullanılacak geçici JWT token

    function showMessage(message, type = 'success') {
        messageText.textContent = message;
        messageBox.className = `message-box show ${type}`;
        messageBox.classList.remove('hidden');
        setTimeout(() => {
            messageBox.classList.remove('show');
            setTimeout(() => {
                messageBox.classList.add('hidden');
            }, 300);
        }, 3000);
    }

    // Formları değiştirme fonksiyonları
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Kayıt işlemi
    registerBtn.addEventListener('click', async () => {
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!email || !password || !confirmPassword) {
            showMessage('Lütfen tüm alanları doldurun.', 'error');
            return;
        }
        if (password !== confirmPassword) {
            showMessage('Parolalar eşleşmiyor.', 'error');
            return;
        }
        // Parola regex kontrolü: en az 8 karakter, büyük/küçük harf, rakam, özel karakter
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!^#@?_=)(]).*$/;
        if (password.length < 8 || password.length > 50 || !passwordRegex.test(password)) {
            showMessage('Parola en az 8 karakter, büyük/küçük harf, rakam ve özel karakter (! ^ # @ ? _ = ) ( ) ) içermelidir.', 'error');
            return;
        }

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

            showMessage(result.message, 'success');
            // Kayıt başarılıysa giriş formuna geç
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            loginEmailInput.value = email; // Kayıtlı e-postayı giriş alanına otomatik doldur
            registerEmailInput.value = '';
            registerPasswordInput.value = '';
            confirmPasswordInput.value = '';

        } catch (error) {
            console.error('Kayıt hatası:', error);
            showMessage(`Kayıt sırasında bir hata oluştu: ${error.message}`, 'error');
        } finally {
            registerBtn.disabled = false;
            registerBtn.innerHTML = 'Kayıt Ol';
        }
    });

    // Giriş işlemi
    loginBtn.addEventListener('click', async () => {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value;

        if (!email || !password) {
            showMessage('Lütfen e-posta ve parolanızı girin.', 'error');
            return;
        }

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
                throw new Error(result.message || 'Giriş başarısız oldu.');
            }

            // 2FA kontrolü
            if (result.is2FAEnabled) {
                // 2FA gerekiyorsa, geçici token'ı ve e-postayı kaydet
                tempUserEmail = email;
                tempJwtToken = result.token; // Backend'den gelen asıl token
                // 2FA modalını göster
                TwoFactorAuthHandler.show2FAModal('login', tempUserEmail, tempJwtToken);
                showMessage('İki faktörlü kimlik doğrulama gerekli. Kod gönderiliyor...', 'info');

                // Kodu otomatik olarak gönder
                await TwoFactorAuthHandler.resend2FACode(tempUserEmail, tempJwtToken); // BURADA KOD OTOMATİK GÖNDERİLİYOR

            } else {
                // 2FA gerekmiyorsa veya doğrulama başarılıysa
                localStorage.setItem('jwtToken', result.token);
                localStorage.setItem('userId', result.userId);
                localStorage.setItem('userEmail', result.email); // E-postayı da kaydet
                showMessage('Giriş başarılı!', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            }

        } catch (error) {
            console.error('Giriş hatası:', error);
            showMessage(`Giriş sırasında bir hata oluştu: ${error.message}`, 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Giriş Yap';
        }
    });

    // 2FA modalını kapatma
    closeTwoFactorAuthModalBtn.addEventListener('click', () => {
        TwoFactorAuthHandler.hide2FAModal();
        twoFactorAuthCodeInput.value = ''; // Kodu temizle
        tempUserEmail = null; // Geçici bilgileri sıfırla
        tempJwtToken = null;
    });

    // 2FA kodunu doğrulama butonu (twoFactorAuth.js'e gönderilecek)
    verifyTwoFactorAuthBtn.addEventListener('click', async () => {
        const code = twoFactorAuthCodeInput.value.trim();
        if (!code) {
            showMessage('Lütfen 2FA kodunu girin.', 'error');
            return;
        }
        if (!tempUserEmail || !tempJwtToken) {
            showMessage('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
            return;
        }

        verifyTwoFactorAuthBtn.disabled = true;
        verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

        try {
            // twoFactorAuth.js modülündeki verify2FACodeLogin fonksiyonunu çağır
            const verificationResult = await TwoFactorAuthHandler.verify2FACodeLogin(tempUserEmail, code, tempJwtToken);

            if (verificationResult.success) {
                localStorage.setItem('jwtToken', verificationResult.token);
                localStorage.setItem('userId', verificationResult.userId);
                localStorage.setItem('userEmail', verificationResult.email); // E-postayı da kaydet
                showMessage('2FA doğrulama başarılı! Giriş yapılıyor...', 'success');
                TwoFactorAuthHandler.hide2FAModal();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } else {
                showMessage(verificationResult.message || '2FA kodu geçersiz.', 'error');
            }
        } catch (error) {
            console.error('2FA doğrulama hatası:', error);
            showMessage(`2FA doğrulama sırasında bir hata oluştu: ${error.message}`, 'error');
        } finally {
            verifyTwoFactorAuthBtn.disabled = false;
            verifyTwoFactorAuthBtn.innerHTML = 'Kodu Doğrula';
        }
    });

    // 2FA kodunu tekrar gönderme butonu (twoFactorAuth.js'e gönderilecek)
    resendTwoFactorAuthCodeBtn.addEventListener('click', async () => {
        if (!tempUserEmail || !tempJwtToken) {
            showMessage('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
            return;
        }

        resendTwoFactorAuthCodeBtn.disabled = true;
        resendTwoFactorAuthCodeBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Gönderiliyor...';

        try {
            // TwoFactorAuthHandler'daki public resend2FACode fonksiyonunu çağır
            const resendResult = await TwoFactorAuthHandler.resend2FACode(tempUserEmail, tempJwtToken);
            if (resendResult.success) {
                showMessage('Yeni kod e-postanıza gönderildi.', 'success');
            } else {
                showMessage(resendResult.message || 'Kod tekrar gönderilemedi.', 'error');
            }
        } catch (error) {
            console.error('Kod tekrar gönderme hatası:', error);
            showMessage(`Kod tekrar gönderilirken bir hata oluştu: ${error.message}`, 'error');
        } finally {
            resendTwoFactorAuthCodeBtn.disabled = false;
            resendTwoFactorAuthCodeBtn.innerHTML = 'Kodu Tekrar Gönder';
        }
    });

    // Kurtarma kodu kullanma butonu (twoFactorAuth.js'e gönderilecek)
    useRecoveryCodeBtn.addEventListener('click', () => {
        // Bu kısım twoFactorAuth.js içinde yönetilecek
        TwoFactorAuthHandler.showRecoveryCodeInput(); // Örneğin, modal içinde kurtarma kodu alanını göster
        showMessage('Kurtarma kodu ile giriş yapılıyor...', 'info');
    });

    // TwoFactorAuthHandler'a gerekli elementleri ve API_BASE_URL'i atıyoruz.
    // Bu, TwoFactorAuthHandler'ın kendi UI elementlerine doğrudan erişmesini sağlar.
    TwoFactorAuthHandler.init({
        twoFactorAuthModal: twoFactorAuthModal,
        twoFactorAuthCodeInput: twoFactorAuthCodeInput,
        verifyTwoFactorAuthBtn: verifyTwoFactorAuthBtn,
        resendTwoFactorAuthCodeBtn: resendTwoFactorAuthCodeBtn,
        useRecoveryCodeBtn: useRecoveryCodeBtn,
        twoFactorAuthModalTitle: document.getElementById('twoFactorAuthModalTitle'),
        twoFactorAuthMessage: document.getElementById('twoFactorAuthMessage'),
        API_BASE_URL: API_BASE_URL,
        showMessage: showMessage // auth.js'teki showMessage fonksiyonunu 2FA modülüne geçiyoruz
    });
});
