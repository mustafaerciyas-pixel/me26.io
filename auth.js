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

// SMS onayındaki butonlar için loading efekti (Google'da kullanmıyoruz)
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

// Ortak Form Kontrolcüsü (Seçimleri Doğrular)
const validateAndGetCommitmentData = () => {
    const cityEl = getEl('input-taahhut-sehir');
    const roleEl = getEl('input-taahhut-rol');
    const paydasEl = getEl('input-paydas-detay');

    if (!cityEl || !cityEl.value) throw new Error('Lütfen şehrini seç.');
    if (!roleEl || !roleEl.value) throw new Error('Lütfen mesleki durumunu seç.');

    let finalRole = roleEl.value;
    
    if (finalRole === 'Öğrenci') finalRole = 'İçmimarlık Öğrencisi';
    if (finalRole === 'Paydaş') {
        const detail = paydasEl.value.trim();
        if (!detail) throw new Error('Lütfen paydaş türünü yaz (Örn: Mimar, Usta).');
        finalRole = `Sektör Paydaşı (${detail})`;
    }

    return { city: cityEl.value, role: finalRole };
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

    loginWithGoogle: async () => {
        let formData;
        try {
            formData = validateAndGetCommitmentData();
        } catch (err) {
            UI.showToast(err.message, 'error');
            return;
        }

        // DİKKAT: Tarayıcının popup engelleyicisine takılmamak için burada
        // butonu devre dışı bırakmıyoruz (Loading efekti eklemiyoruz).
        // Kullanıcı tıkladığı an Google penceresi doğrudan açılmalı.
        
        try {
            const result = await signInWithPopup(firebaseAuth, googleProvider);
            const user = result.user;

            STATE.setUser({
                authStage: 'registered',
                userNo: 'BEKLEYEN',
                role: formData.role,
                city: formData.city,
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
            // Kullanıcı pencereyi kendisi kapatırsa hata verme, sessizce dur
            if (error.code !== 'auth/popup-closed-by-user') {
                UI.showToast('Google ile giriş başarısız oldu.', 'error');
            }
        }
    },

    submitCommitment: async () => {
        let formData;
        try {
            formData = validateAndGetCommitmentData();
        } catch (err) {
            UI.showToast(err.message, 'error');
            return;
        }

        STATE.setUser({
            authStage: 'registered',
            userNo: 'BEKLEYEN',
            role: formData.role,
            city: formData.city,
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
                } catch (resetError) {}
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
