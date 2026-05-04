/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase SMS & OTP Entegrasyonlu Sürüm
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseApp = initializeApp(ME26_CONFIG.firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.languageCode = 'tr';

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

    if (phoneVal.startsWith('90')) {
        phoneVal = phoneVal.substring(2);
    }

    if (phoneVal.startsWith('0')) {
        phoneVal = phoneVal.substring(1);
    }

    return phoneVal;
};

const setButtonLoading = (button, loadingText) => {
    if (!button) {
        return () => {};
    }

    const originalText = button.textContent;

    button.textContent = loadingText;
    button.disabled = true;

    return () => {
        button.textContent = originalText;
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

    submitCommitment: async (roleType) => {
        const citySelect = getEl('input-taahhut-sehir');
        if (!citySelect) return;

        const city = citySelect.value;

        if (!city) {
            UI.showToast('Lütfen önce şehrini seç.', 'error');
            return;
        }

        const role = roleType === 'icmimar'
            ? 'İçmimar'
            : 'İçmimarlık Öğrencisi';

        try {
            STATE.setUser({
                authStage: 'registered',
                userNo: 'BEKLEYEN',
                role,
                city,
                votePower: '0.0x',
                inviteCount: 0,
                isVip: false
            });

            UI.closeModal('taahhut-modal');
            UI.renderProfile();

            const wowNoEl = getEl('ui-wow-uye-no');
            if (wowNoEl) {
                wowNoEl.textContent = 'Aday Kurucu';
            }

            UI.openModal('wow-modal');
        } catch (error) {
            console.error('Kayıt hatası:', error);
            UI.showToast('Kayıt işlemi başarısız oldu.', 'error');
        }
    },

    verifyPhone: async () => {
        const phoneInput = getEl('input-phone-number');
        const btnSubmit = getEl('btn-submit-phone');

        if (!phoneInput) return;

        const phoneVal = normalizeTurkishPhone(phoneInput.value);

        if (phoneVal.length !== 10 || !phoneVal.startsWith('5')) {
            UI.showToast('Geçerli bir 10 haneli cep telefonu girin.', 'error');
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

            UI.showToast('Telefon başarıyla doğrulandı.', 'success');
        } catch (error) {
            console.error('OTP doğrulama hatası:', error);
            UI.showToast('Kod hatalı veya süresi dolmuş.', 'error');
        } finally {
            stopLoading();
        }
    },

    verifyPdf: async () => {
        const fileInput = getEl('input-pdf-file');

        if (!fileInput) return;

        if (!fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen cihazından bir PDF belgesi seç.', 'error');
            return;
        }

        const file = fileInput.files[0];

        if (file.type !== 'application/pdf') {
            UI.showToast('Sadece PDF formatında belge yükleyebilirsin.', 'error');
            return;
        }

        UI.showToast(
            'Belgen sıraya alındı. Doğrulama sistemi devreye girdiğinde yetkin yükseltilecek.',
            'success'
        );

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

    deleteAccount: async () => {
        const ok = confirm('Tüm verilerin yok edilecek. Bu işlem geri alınamaz. Emin misin?');

        if (!ok) return;

        try {
            STATE.clearAll();
            UI.toggleProfileDrawer(false);
            UI.showView('landing');
            UI.renderProfile();
            resetPhoneModal();

            UI.showToast('Tüm verilerin sistemden silindi.', 'success');
        } catch (error) {
            console.error('Hesap silme hatası:', error);
            UI.showToast('Hesap silinirken bir hata oluştu.', 'error');
        }
    }
};