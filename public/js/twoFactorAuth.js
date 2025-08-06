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
    _tempUserEmail: null,
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
        this._twoFactorAuthMessage = config.twoFactorAuthMessage;
        this._API_BASE_URL = config.API_BASE_URL;
        this._showMessage = config.showMessage;

        // 2FA modalındaki butonların olay dinleyicilerini bağlama
        this._verifyTwoFactorAuthBtn.addEventListener('click', () => this._handleVerifyButtonClick());
        this._resendTwoFactorAuthCodeBtn.addEventListener('click', () => this._handleResendButtonClick());
        this._useRecoveryCodeBtn.addEventListener('click', () => this._handleRecoveryButtonClick());
    },

    /**
     * 2FA modalını gösterir.
     * @param {string} type - Modalın gösterilme amacı ('login' veya 'setup')
     * @param {string} email - Kullanıcının e-posta adresi
     * @param {string} token - İlgili akış için kullanılacak JWT tokenı (giriş için tempToken, kurulum için normal jwtToken)
     */
    show2FAModal: function(type, email, token) {
        this._twoFactorAuthCodeInput.value = ''; // Inputu temizle
        this._twoFactorAuthCodeInput.focus(); // Inputa odaklan

        if (type === 'login') {
            this._tempUserEmail = email;
            this._tempJwtToken = token;
            this._setupUserEmail = null; // Kurulum bilgileri temizle
            this._setupJwtToken = null;

            this._twoFactorAuthModalTitle.textContent = 'İki Faktörlü Kimlik Doğrulama';
            this._twoFactorAuthMessage.textContent = 'E-posta adresinize gönderilen 6 haneli kodu girin.';
            this._resendTwoFactorAuthCodeBtn.classList.remove('hidden');
            this._useRecoveryCodeBtn.classList.remove('hidden');
            this._verifyTwoFactorAuthBtn.textContent = 'Kodu Doğrula';
            this._verifyTwoFactorAuthBtn.dataset.mode = 'login'; // Modu belirle
        } else if (type === 'setup') {
            this._setupUserEmail = email;
            this._setupJwtToken = token;
            this._tempUserEmail = null; // Giriş bilgileri temizle
            this._tempJwtToken = null;

            this._twoFactorAuthModalTitle.textContent = '2FA Etkinleştirme Doğrulaması';
            this._twoFactorAuthMessage.textContent = 'E-posta adresinize gönderilen doğrulama kodunu girin.';
            this._resendTwoFactorAuthCodeBtn.classList.remove('hidden'); // Kurulumda da tekrar gönderilebilir
            this._useRecoveryCodeBtn.classList.add('hidden'); // Kurulumda kurtarma kodu kullanılmaz
            this._verifyTwoFactorAuthBtn.textContent = '2FA\'yı Etkinleştir';
            this._verifyTwoFactorAuthBtn.dataset.mode = 'setup'; // Modu belirle
        }

        this._twoFactorAuthModal.classList.remove('hidden');
    },

    /**
     * 2FA modalını gizler.
     */
    hide2FAModal: function() {
        this._twoFactorAuthModal.classList.add('hidden');
        this._twoFactorAuthCodeInput.value = '';
        this._tempUserEmail = null;
        this._tempJwtToken = null;
        this._setupUserEmail = null;
        this._setupJwtToken = null;
    },

    /**
     * Doğrulama butonuna tıklandığında hangi modda olduğunu kontrol eder ve ilgili fonksiyonu çağırır.
     * Bu, tek bir buton üzerinden farklı 2FA akışlarını yönetmemizi sağlar.
     */
    _handleVerifyButtonClick: async function() {
        const mode = this._verifyTwoFactorAuthBtn.dataset.mode;
        const code = this._twoFactorAuthCodeInput.value.trim();

        if (!code) {
            this._showMessage('Lütfen kodu girin.', 'error');
            return;
        }

        if (mode === 'login') {
            if (!this._tempUserEmail || !this._tempJwtToken) {
                this._showMessage('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
                return;
            }
            const verificationResult = await this.verify2FACodeLogin(this._tempUserEmail, code, this._tempJwtToken);
            if (verificationResult.success) {
                localStorage.setItem('jwtToken', verificationResult.token);
                localStorage.setItem('userId', verificationResult.userId);
                localStorage.setItem('userEmail', verificationResult.email); // E-postayı da kaydet
                this._showMessage('2FA doğrulama başarılı! Giriş yapılıyor...', 'success');
                this.hide2FAModal();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } else {
                this._showMessage(verificationResult.message || '2FA kodu geçersiz.', 'error');
            }
        } else if (mode === 'setup') {
            if (!this._setupUserEmail || !this._setupJwtToken) {
                this._showMessage('2FA kurulum bilgisi bulunamadı. Lütfen tekrar deneyin.', 'error');
                return;
            }
            const verificationResult = await this.verify2FACodeSetup(this._setupUserEmail, code, this._setupJwtToken);
            if (verificationResult.success) {
                this._showMessage('2FA başarıyla etkinleştirildi! Kurtarma kodlarınızı kaydedin.', 'success');
                this.hide2FAModal();
                setTimeout(() => { window.location.reload(); }, 500);

            } else {
                this._showMessage(verificationResult.message || 'Etkinleştirme kodu geçersiz.', 'error');
            }
        } else if (mode === 'recovery') {
            if (!this._tempUserEmail || !this._tempJwtToken) {
                this._showMessage('Geçici kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapmayı deneyin.', 'error');
                return;
            }
            const verificationResult = await this.verifyRecoveryCode(this._tempUserEmail, code, this._tempJwtToken);
            if (verificationResult.success) {
                localStorage.setItem('jwtToken', verificationResult.token);
                localStorage.setItem('userId', verificationResult.userId);
                localStorage.setItem('userEmail', verificationResult.email);
                this._showMessage('Kurtarma kodu doğrulama başarılı! Giriş yapılıyor...', 'success');
                this.hide2FAModal();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
            } else {
                this._showMessage(verificationResult.message || 'Kurtarma kodu geçersiz.', 'error');
            }
        }
    },

    _handleResendButtonClick: async function() {
        const mode = this._verifyTwoFactorAuthBtn.dataset.mode;
        let emailToResend, tokenToResend;

        if (mode === 'login') {
            emailToResend = this._tempUserEmail;
            tokenToResend = this._tempJwtToken;
        } else if (mode === 'setup') {
            emailToResend = this._setupUserEmail;
            tokenToResend = this._setupJwtToken;
        }

        if (!emailToResend || !tokenToResend) {
            this._showMessage('Kullanıcı bilgisi bulunamadı. Lütfen tekrar deneyin.', 'error');
            return;
        }

        await this.resend2FACode(emailToResend, tokenToResend);
    },

    _handleRecoveryButtonClick: function() {
        this._twoFactorAuthMessage.textContent = 'Lütfen kurtarma kodunuzu girin.';
        this._verifyTwoFactorAuthBtn.textContent = 'Kurtarma Kodu ile Doğrula';
        this._verifyTwoFactorAuthBtn.dataset.mode = 'recovery';
        this._resendTwoFactorAuthCodeBtn.classList.add('hidden');
        this._useRecoveryCodeBtn.classList.add('hidden');
        this._twoFactorAuthCodeInput.type = 'text';
        this._twoFactorAuthCodeInput.placeholder = 'Kurtarma Kodunuz';
        this._twoFactorAuthCodeInput.maxLength = 16;
    },

    // ------------------------------------------------------------------------------------------------
    // 2FA Fonksiyonları (Backend ile İletişim) - Bunlar artık public metotlar
    // ------------------------------------------------------------------------------------------------

    /**
     * Giriş akışında 2FA kodunu doğrular.
     */
    verify2FACodeLogin: async function(email, code, tempToken) {
        this._verifyTwoFactorAuthBtn.disabled = true;
        this._verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify-login-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tempToken}`
                },
                body: JSON.stringify({ email, code })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '2FA doğrulama başarısız oldu.');
            }

            return { success: true, message: result.message, token: result.token, userId: result.userId, email: result.email };

        } catch (error) {
            console.error('2FA doğrulama hatası:', error);
            this._showMessage(`2FA doğrulama sırasında bir hata oluştu: ${error.message}`, 'error');
            return { success: false, message: error.message };
        } finally {
            this._verifyTwoFactorAuthBtn.disabled = false;
            this._verifyTwoFactorAuthBtn.innerHTML = 'Kodu Doğrula';
        }
    },

    /**
     * 2FA Etkinleştirme kodunu doğrular.
     * @param {string} email - Kullanıcının e-posta adresi
     * @param {string} code - Kullanıcının girdiği doğrulama kodu
     * @param {string} jwtToken - Kullanıcının ana JWT tokenı (kimlik doğrulaması için)
     * @returns {Object} Doğrulama sonucu (success: boolean, message: string, recoveryCodes?: string[])
     */
    verify2FACodeSetup: async function(email, code, jwtToken) {
        this._verifyTwoFactorAuthBtn.disabled = true;
        this._verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Etkinleştiriliyor...';

        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: JSON.stringify({ email, code })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '2FA etkinleştirme doğrulama başarısız oldu.');
            }
            return { success: true, message: result.message, recoveryCodes: result.recoveryCodes };

        } catch (error) {
            console.error('2FA etkinleştirme doğrulama hatası:', error);
            this._showMessage(`2FA etkinleştirme sırasında bir hata oluştu: ${error.message}`, 'error');
            return { success: false, message: error.message };
        } finally {
            this._verifyTwoFactorAuthBtn.disabled = false;
            this._verifyTwoFactorAuthBtn.innerHTML = '2FA\'yı Etkinleştir';
        }
    },

    /**
     * Kurtarma kodunu doğrular.
     */
    verifyRecoveryCode: async function(email, recoveryCode, tempToken) {
        this._verifyTwoFactorAuthBtn.disabled = true;
        this._verifyTwoFactorAuthBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Doğrulanıyor...';

        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/verify-recovery-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tempToken}`
                },
                body: JSON.stringify({ email, recoveryCode })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Kurtarma kodu doğrulama başarısız oldu.');
            }

            return { success: true, message: result.message, token: result.token, userId: result.userId, email: result.email };

        } catch (error) {
            console.error('Kurtarma kodu doğrulama hatası:', error);
            this._showMessage(`Kurtarma kodu doğrulama sırasında bir hata oluştu: ${error.message}`, 'error');
            return { success: false, message: error.message };
        } finally {
            this._verifyTwoFactorAuthBtn.disabled = false;
            this._verifyTwoFactorAuthBtn.innerHTML = 'Kurtarma Kodu ile Doğrula';
        }
    },

    /**
     * 2FA kodunu tekrar gönderir. (Public metot olarak eklendi)
     * @param {string} email - Kullanıcının e-posta adresi
     * @param {string} token - Kullanıcının JWT tokenı
     * @returns {Object} İşlem sonucu (success: boolean, message: string)
     */
    resend2FACode: async function(email, token) {
        this._resendTwoFactorAuthCodeBtn.disabled = true;
        this._resendTwoFactorAuthCodeBtn.innerHTML = '<span class="inline-block h-4 w-4 border-2 border-t-2 border-white rounded-full animate-spin mr-2"></span> Gönderiliyor...';

        try {
            const response = await fetch(`${this._API_BASE_URL}/2fa/send-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email: email })
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
            this._resendTwoFactorAuthCodeBtn.disabled = false;
            this._resendTwoFactorAuthCodeBtn.innerHTML = 'Kodu Tekrar Gönder';
        }
    }
};
