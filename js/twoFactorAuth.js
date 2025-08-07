// public/js/twoFactorAuth.js

export const TwoFactorAuthHandler = {
    _twoFactorAuthModal: null,
    _twoFactorAuthCodeInput: null,
    _verifyTwoFactorAuthBtn: null,
    _resendTwoFactorAuthCodeBtn: null,
    _useRecoveryCodeBtn: null,
    _twoFactorAuthModalTitle: null,
    _twoFactorAuthMessage: null,
    _showMessage: null,

    _API_BASE_URL: null,
    _tempUserEmail: null, // Giriş akışı için geçici kullanıcı e-postası
    _tempJwtToken: null,  // Giriş akışı için geçici JWT tokenı

    _setupJwtToken: null, // 2FA kurulum akışı için JWT tokenı
    _setupUserEmail: null, // 2FA kurulum akışı için kullanıcı e-postası

    /**
     * TwoFactorAuthHandler'ı başlatır ve gerekli UI element referanslarını ve ayarları alır.
     * @param {Object} config - Yapılandırma objesi
     */
    init: function(config) {
        this._twoFactorAuthModal = config.twoFactorAuthModal;
        this._twoFactorAuthCodeInput = config.twoFactorAuthCodeInput;
        this._verifyTwoFactorAuthBtn = config.verifyTwoFactorAuthBtn;
        this._resendTwoFactorAuthCodeBtn = config.resendTwoFactorAuthCodeBtn;
        this._useRecoveryCodeBtn = config.useRecoveryCodeBtn;
        this._twoFactorAuthModalTitle = config.twoFactorAuthModalTitle;
        this._showMessage = config.showMessage; // showMessage fonksiyonunu dışarıdan al

        this._API_BASE_URL = config.apiBaseUrl;

        // Olay dinleyicilerini ayarla
        if (this._verifyTwoFactorAuthBtn) {
            this._verifyTwoFactorAuthBtn.addEventListener('click', () => this._handleVerifyButtonClick());
        }
        if (this._resendTwoFactorAuthCodeBtn) {
            this._resendTwoFactorAuthCodeBtn.addEventListener('click', () => this._handleResendButtonClick());
        }
        if (this._useRecoveryCodeBtn) {
            this._useRecoveryCodeBtn.addEventListener('click', () => this._handleUseRecoveryCodeClick());
        }
    },

    /**
     * 2FA doğrulama modalını gösterir.
     * @param {string} userEmail - Doğrulama yapılacak kullanıcının e-posta adresi.
     * @param {string} jwtToken - Kullanıcının JWT tokenı (opsiyonel, giriş sonrası için).
     * @param {string} mode - 'login' veya 'setup' (varsayılan 'login').
     */
    show2FAModal: function(userEmail, jwtToken = null, mode = 'login') {
        if (!this._twoFactorAuthModal) {
            console.error("2FA modal element not found!");
            return;
        }

        this._tempUserEmail = userEmail;
        this._tempJwtToken = jwtToken; // Giriş akışı için token
        this._setupUserEmail = userEmail; // Kurulum akışı için e-posta
        this._setupJwtToken = jwtToken; // Kurulum akışı için token

        if (this._twoFactorAuthModalTitle) {
            this._twoFactorAuthModalTitle.textContent = mode === 'login' ? 'İki Faktörlü Doğrulama' : '2FA Kurulumu';
        }
        if (this._twoFactorAuthCodeInput) {
            this._twoFactorAuthCodeInput.value = ''; // Kodu temizle
            this._twoFactorAuthCodeInput.placeholder = '######';
            this._twoFactorAuthCodeInput.maxLength = 6; // OTP kodları 6 hanelidir
        }
        if (this._verifyTwoFactorAuthBtn) {
            this._verifyTwoFactorAuthBtn.textContent = 'Kodu Doğrula';
            this._verifyTwoFactorAuthBtn.dataset.mode = mode; // Buton modunu ayarla
        }
        if (this._resendTwoFactorAuthCodeBtn) {
            this._resendTwoFactorAuthCodeBtn.style.display = 'block'; // Tekrar gönder butonunu göster
        }
        if (this._useRecoveryCodeBtn) {
            this._useRecoveryCodeBtn.style.display = 'block'; // Kurtarma kodu kullan butonunu göster
        }

        this._twoFactorAuthModal.classList.remove('hidden');
    },

    /**
     * 2FA modalını gizler.
     */
    hide2FAModal: function() {
        if (this._twoFactorAuthModal) {
            this._twoFactorAuthModal.classList.add('hidden');
        }
        this._tempUserEmail = null;
        this._tempJwtToken = null;
        this._setupUserEmail = null;
        this._setupJwtToken = null;
    },

    /**
     * Doğrulama butonuna tıklandığında çalışır.
     * Mod'a göre (login/setup/recovery) farklı doğrulama fonksiyonlarını çağırır.
     */
    _handleVerifyButtonClick: async function() {
        const token = this._twoFactorAuthCodeInput.value.trim();
        const mode = this._verifyTwoFactorAuthBtn.dataset.mode;

        if (!token) {
            this._showMessage('Lütfen doğrulama kodunu girin.', 'warning');
            return;
        }

        this._verifyTwoFactorAuthBtn.disabled = true;
        this._verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

        let result;
        if (mode === 'login') {
            result = await this.verify2FACodeLogin(this._tempUserEmail, token); // DÜZELTME: email parametresi eklendi
        } else if (mode === 'setup') {
            result = await this.verify2FACodeSetup(this._setupUserEmail, token, this._setupJwtToken); // DÜZELTME: email parametresi eklendi
        } else if (mode === 'recovery') {
            result = await this.verifyRecoveryCode(this._tempUserEmail, token); // DÜZELTME: email parametresi eklendi
        }

        if (result.success) {
            this._showMessage(result.message, 'success');
            this.hide2FAModal();
            // Başarılı doğrulama sonrası yönlendirme veya işlem auth.js'de yapılmalı
        } else {
            this._showMessage(result.message, 'error');
        }

        this._verifyTwoFactorAuthBtn.disabled = false;
        this._verifyTwoFactorAuthBtn.innerHTML = 'Kodu Doğrula';
    },

    /**
     * Giriş akışında 2FA kodunu doğrular.
     * @param {string} email - Kullanıcının e-posta adresi.
     * @param {string} token - Kullanıcının girdiği 2FA kodu.
     * @returns {Object} İşlem sonucu (success: boolean, message: string, is2FAVerified: boolean)
     */
    verify2FACodeLogin: async function(email, token) { // DÜZELTME: email parametresi eklendi
        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify-login-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email, token: token }) // DÜZELTME: email gönderiliyor
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '2FA kodu doğrulanamadı.');
            }

            return { success: true, message: result.message, is2FAVerified: result.is2FAVerified };

        } catch (error) {
            console.error('2FA doğrulama hatası:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * 2FA kurulum akışında 2FA kodunu doğrular.
     * @param {string} email - Kullanıcının e-posta adresi.
     * @param {string} token - Kullanıcının girdiği 2FA kodu.
     * @param {string} jwtToken - Kullanıcının JWT tokenı.
     * @returns {Object} İşlem sonucu (success: boolean, message: string, recoveryCodes: array)
     */
    verify2FACodeSetup: async function(email, token, jwtToken) {
        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify-enable`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({ userId: localStorage.getItem('userId'), token: token })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '2FA kurulumu doğrulanamadı.');
            }

            return { success: true, message: result.message, recoveryCodes: result.recoveryCodes };

        } catch (error) {
            console.error('2FA kurulum doğrulama hatası:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Kurtarma kodu ile girişi doğrular.
     * @param {string} email - Kullanıcının e-posta adresi.
     * @param {string} recoveryCode - Kullanıcının girdiği kurtarma kodu.
     * @returns {Object} İşlem sonucu (success: boolean, message: string, is2FAVerified: boolean)
     */
    verifyRecoveryCode: async function(email, recoveryCode) { // DÜZELTME: email parametresi eklendi
        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify-recovery-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: email, recoveryCode: recoveryCode }) // DÜZELTME: email gönderiliyor
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Kurtarma kodu doğrulanamadı.');
            }

            return { success: true, message: result.message, is2FAVerified: result.is2FAVerified };

        } catch (error) {
            console.error('Kurtarma kodu doğrulama hatası:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Tekrar gönder butonuna tıklandığında çalışır.
     */
    _handleResendButtonClick: async function() {
        const email = this._tempUserEmail; // DÜZELTME: email parametresi kullanılıyor
        if (!email) {
            this._showMessage('E-posta adresi bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }
        const result = await this.resend2FACode(email, this._tempJwtToken); // DÜZELTME: email parametresi eklendi
        if (!result.success) {
            this._showMessage(result.message, 'error');
        }
    },

    /**
     * 2FA kodunu tekrar gönderir.
     * @param {string} email - Kullanıcının e-posta adresi.
     * @param {string} token - Kullanıcının JWT tokenı (opsiyonel, giriş sonrası için).
     * @returns {Object} İşlem sonucu (success: boolean, message: string)
     */
    resend2FACode: async function(email, token) { // DÜZELTME: email parametresi eklendi
        this._resendTwoFactorAuthCodeBtn.disabled = true;
        this._resendTwoFactorAuthCodeBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Gönderiliyor...';

        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/send-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${token}` // send-code rotası authenticateToken kullanmıyor
                },
                body: JSON.stringify({ email: email }) // DÜZELTME: email gönderiliyor
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Kod tekrar gönderilemedi.');
            }

            this._showMessage(result.message, 'success');
            return { success: true, message: result.message };

        } catch (error) {
            console.error('Kod tekrar gönderme hatası:', error);
            this._showMessage(`Kod tekrar gönderilirken bir hata oluştu: ${error.message}`, 'error');
            return { success: false, message: error.message };
        } finally {
            this._resendTwoFactorAuthAuthBtn.disabled = false;
            this._resendTwoFactorAuthAuthBtn.innerHTML = 'Kodu Tekrar Gönder';
        }
    },

    /**
     * Kurtarma kodu kullan butonuna tıklandığında çalışır.
     */
    _handleUseRecoveryCodeClick: function() {
        if (this._twoFactorAuthModalTitle) {
            this._twoFactorAuthModalTitle.textContent = 'Kurtarma Kodu Kullan';
        }
        if (this._twoFactorAuthCodeInput) {
            this._twoFactorAuthCodeInput.value = '';
            this._twoFactorAuthCodeInput.placeholder = 'Kurtarma Kodunuz';
            this._twoFactorAuthCodeInput.maxLength = 20; // Kurtarma kodları daha uzun olabilir
        }
        if (this._verifyTwoFactorAuthBtn) {
            this._verifyTwoFactorAuthBtn.textContent = 'Kodu Doğrula';
            this._verifyTwoFactorAuthBtn.dataset.mode = 'recovery'; // Modu kurtarma olarak ayarla
        }
        if (this._resendTwoFactorAuthCodeBtn) {
            this._resendTwoFactorAuthCodeBtn.style.display = 'none'; // Tekrar gönder butonunu gizle
        }
        if (this._useRecoveryCodeBtn) {
            this._useRecoveryCodeBtn.style.display = 'none'; // Kurtarma kodu kullan butonunu gizle
        }
    },

    // auth.js tarafından çağrılan yardımcı fonksiyonlar
    // showRecoveryCodeInput: function() { // Bu fonksiyon artık _handleUseRecoveryCodeClick tarafından yönetiliyor
    //     this._handleUseRecoveryCodeClick();
    // }
};
