/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase Google + SMS Entegrasyonlu Sürüm
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseApp = initializeApp(ME26_CONFIG.firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.languageCode = 'tr';

const googleProvider = new GoogleAuthProvider();
let confirmationResult = null;

const getEl = (id) => document.getElementById(id);

const resetPhoneModal = () => {
    const step1 = getEl('phone-step-1');
    const step2 = getEl('phone-step-2');
    const phoneInput = getEl('input-phone-number');
    const otpInput = getEl('input-otp-code');

    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (phoneInput) phoneInput.value = '';
    if (otpInput) otpInput.value = '';
    confirmationResult = null;
};

const normalizeTurkishPhone = (value) => {
    let phoneVal = String(value || '').replace(/\D/g, '');
    if (phoneVal.startsWith('90')) phoneVal = phoneVal.substring(2);
    if (phoneVal.startsWith('0')) phoneVal = phoneVal.substring(1);
    return phoneVal;
};

const setButtonLoading = (button, loadingText) => {
    if (!button) return () => {};
    const originalText = button.innerHTML;
    button.textContent = loadingText;
    button.disabled = true;
    return () => {
        button.innerHTML = originalText;
        button.disabled = false;
    };
};

export const AUTH = {
    login: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast('Sisteme yeniden hoş geldin.', 'success');
            return;
        }
        UI.openModal('taahhut-modal');
    },

    // YENİ: Google ile Giriş Fonksiyonu
    loginWithGoogle: async () => {
        const citySelect = getEl('input-taahhut-sehir');
        if (!citySelect || !citySelect.value) {
            UI.showToast('Google ile katılmadan önce lütfen şehrini seç.', 'error');
            return;
        }

        const btn = getEl('btn-google-login');
        const stopLoading = setButtonLoading(btn, 'GOOGLE BEKLENİYOR...');

        try {
            const result = await signInWithPopup(firebaseAuth, googleProvider);
            const user = result.user;

            STATE.setUser({
                authStage: 'registered',
                userNo: 'BEKLEYEN',
                role: 'İçmimar / Öğrenci', // Varsayılan atanır, içeriden değiştirilebilir
                city: citySelect.value,
                votePower: '0.0x',
                inviteCount: 0,
                isVip: false
            });

            UI.closeModal('taahhut-modal');
            UI.renderProfile();
            
            const wowNoEl = getEl('ui-wow-uye-no');
            if (wowNoEl) wowNoEl.textContent = 'Aday Kurucu';
            
            UI.showToast(`Hoş geldin, ${user.displayName}!`, 'success');
            UI.openModal('wow-modal');

        } catch (error) {
            console.error('Google Giriş Hatası:', error);
            UI.showToast('Google ile giriş iptal edildi veya başarısız oldu.', 'error');
        } finally {
            stopLoading();
        }
    },

    submitCommitment: async (roleType) => {
        const citySelect = getEl('input-taahhut-sehir');
        if (!citySelect || !citySelect.value) {
            UI.showToast('Lütfen önce şehrini seç.', 'error');
            return;
        }

        const role = roleType === 'icmimar' ? 'İçmimar' : 'İçmimarlık Öğrencisi';

        STATE.setUser({
            authStage: 'registered',
            userNo: 'BEKLEYEN',
            role,
            city: citySelect.value,
            votePower: '0.0x',
            inviteCount: 0,
            isVip: false
        });

        UI.closeModal('taahhut-modal');
        UI.renderProfile();

        const wowNoEl = getEl('ui-wow-uye-no');
        if (wowNoEl) wowNoEl.textContent = 'Aday Kurucu';

        UI.openModal('wow-modal');
    },

    verifyPhone: async () => {
        const phoneInput = getEl('input-phone-number');
        const btnSubmit = getEl('btn-submit-phone');
        if (!phoneInput) return;

        const phoneVal = normalizeTurkishPhone(phoneInput.value);
        if (phoneVal.length !== 10 || !phoneVal.startsWith('5')) {
            UI.showToast('Geçerli bir 10 haneli cep telefonu girin (Örn: 5551234567).', 'error');
            return;
        }

        const fullPhone = `+90${phoneVal}`;
        const stopLoading = setButtonLoading(btnSubmit, 'SMS GÖNDERİLİYOR...');

        try {
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(
                    firebaseAuth,
                    'recaptcha-container',
                    { size: 'invisible' }
                );
            }

            UI.showToast('SMS gönderiliyor...', 'success');

            confirmationResult = await signInWithPhoneNumber(
                firebaseAuth,
                fullPhone,
                window.recaptchaVerifier
            );

            UI.showToast('Doğrulama kodu telefonuna gönderildi.', 'success');

            const step1 = getEl('phone-step-1');
            const step2 = getEl('phone-step-2');
            if (step1) step1.classList.add('hidden');
            if (step2) step2.classList.remove('hidden');
        } catch (error) {
            console.error('SMS gönderme hatası:', error);
            UI.showToast('SMS gönderilemedi. Numarayı kontrol edip tekrar dene.', 'error');
            if (window.recaptchaVerifier && window.grecaptcha) {
                try {
                    const widgetId = await window.recaptchaVerifier.render();
                    window.grecaptcha.reset(widgetId);
                } catch (resetError) {
                    console.error('reCAPTCHA sıfırlama hatası:', resetError);
                }
            }
        } finally {
            stopLoading();
        }
    },

    verifyOtp: async () => {
        const otpInput = getEl('input-otp-code');
        const btnVerify = getEl('btn-verify-otp');
        if (!otpInput) return;

        if (!confirmationResult) {
            UI.showToast('Önce telefon numarana SMS gönder.', 'error');
            return;
        }

        const code = String(otpInput.value || '').replace(/\D/g, '');
        if (code.length !== 6) {
            UI.showToast('Lütfen 6 haneli doğrulama kodunu gir.', 'error');
            return;
        }

        const stopLoading = setButtonLoading(btnVerify, 'DOĞRULANIYOR...');

        try {
            await confirmationResult.confirm(code);

            STATE.updateUser('authStage', 'phone_verified');
            STATE.updateUser('votePower', '0.5x');

            UI.closeModal('phone-modal');
            UI.renderProfile();
            resetPhoneModal();

            UI.showToast('Telefon başarıyla doğrulandı. Oy gücün 0.5x oldu!', 'success');
        } catch (error) {
            console.error('OTP doğrulama hatası:', error);
            UI.showToast('Kod hatalı veya süresi dolmuş.', 'error');
        } finally {
            stopLoading();
        }
    },

    verifyPdf: async () => {
        const fileInput = getEl('input-pdf-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen cihazından bir PDF belgesi seç.', 'error');
            return;
        }
        if (fileInput.files[0].type !== 'application/pdf') {
            UI.showToast('Sadece PDF formatında belge yükleyebilirsin.', 'error');
            return;
        }
        UI.showToast('Belgen sıraya alındı.', 'success');
        UI.closeModal('pdf-modal');
        fileInput.value = '';
    },

    logout: () => {
        STATE.clearSession();
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        resetPhoneModal();
        UI.showToast('Oturum kapatıldı. Stadyumdan çıkıldı.', 'success');
    },

    deleteAccount: () => {
        if (!confirm('Tüm verilerin yok edilecek. Emin misin?')) return;
        STATE.clearAll();
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        resetPhoneModal();
        UI.showToast('Tüm verilerin sistemden silindi.', 'success');
    }
};
