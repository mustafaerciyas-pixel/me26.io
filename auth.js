/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (js/auth.js)
   (GERÇEK FİREBASE SMS & OTP ENTEGRASYONU)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';

// Firebase Kütüphaneleri
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Firebase Başlatma
const app = initializeApp(ME26_CONFIG.firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'tr'; 

let confirmationResult = null; 

export const AUTH = {
    
    // 1. GİRİŞ VE TAAHHÜT
    login: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast("Sisteme yeniden hoş geldin.", "success");
            return;
        }
        UI.openModal('taahhut-modal');
    },

    // 2. TAAHHÜT (ŞEHİR VE MESLEK SEÇİMİ)
    submitCommitment: async (roleType) => {
        const citySelect = document.getElementById('input-taahhut-sehir');
        if (!citySelect) return;

        const city = citySelect.value;
        if (!city) {
            UI.showToast("Lütfen önce şehrini (tribününü) seç.", "error");
            return;
        }

        const role = roleType === 'icmimar' ? "İçmimar" : "İçmimarlık Öğrencisi";
        
        try {
            STATE.setUser({
                authStage: "registered",
                userNo: "BEKLEYEN",
                role: role,
                city: city,
                votePower: "0.0x", 
                inviteCount: 0,
                isVip: false
            });

            UI.closeModal('taahhut-modal');
            UI.renderProfile();
            
            const wowNoEl = document.getElementById('ui-wow-uye-no');
            if (wowNoEl) wowNoEl.textContent = `Aday Kurucu`;
            UI.openModal('wow-modal');

        } catch (error) {
            UI.showToast("Kayıt işlemi başarısız oldu.", "error");
        }
    },

    // 3. SMS GÖNDERME (Adım 1)
    verifyPhone: async () => {
        const phoneInput = document.getElementById('input-phone-number');
        if (!phoneInput) return;

        let phoneVal = phoneInput.value.replace(/\s+/g, '');
        if (phoneVal.startsWith('0')) phoneVal = phoneVal.substring(1); 
        const phone = "+90" + phoneVal;
        
        if (phone.length !== 13) { 
            UI.showToast("Geçerli bir 10 haneli numara girin (Örn: 5XX XXX XX XX).", "error");
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-phone');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "BEKLEYİN...";
        btnSubmit.disabled = true;

        try {
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible'
                });
            }

            UI.showToast("SMS gönderiliyor...", "success");
            confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
            UI.showToast("Doğrulama kodu telefonunuza gönderildi!", "success");
            
            // UI Geçişi: SMS alanını kapat, OTP alanını aç
            document.getElementById('phone-step-1').classList.add('hidden');
            document.getElementById('phone-step-2').classList.remove('hidden');

        } catch (error) {
            console.error("SMS Hatası:", error);
            UI.showToast("SMS gönderilemedi. Lütfen numarayı kontrol edip tekrar deneyin.", "error");
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(widgetId => grecaptcha.reset(widgetId));
            }
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    },

    // 4. OTP ONAYLAMA (Adım 2)
    verifyOtp: async () => {
        const otpInput = document.getElementById('input-otp-code');
        if (!otpInput || !confirmationResult) return;

        const code = otpInput.value.replace(/\s+/g, '');
        if (code.length !== 6) {
            UI.showToast("Lütfen telefona gelen 6 haneli kodu eksiksiz girin.", "error");
            return;
        }

        const btnVerify = document.getElementById('btn-verify-otp');
        const originalText = btnVerify.textContent;
        btnVerify.textContent = "DOĞRULANIYOR...";
        btnVerify.disabled = true;

        try {
            const result = await confirmationResult.confirm(code);
            
            UI.showToast("Telefon başarıyla doğrulandı!", "success");
            
            STATE.updateUser("authStage", "phone_verified");
            STATE.updateUser("votePower", "0.5x");
            
            UI.closeModal('phone-modal');
            UI.renderProfile();

            // Ekranı sonraki kullanımlar için sıfırla
            setTimeout(() => {
                document.getElementById('phone-step-1').classList.remove('hidden');
                document.getElementById('phone-step-2').classList.add('hidden');
                otpInput.value = '';
                document.getElementById('input-phone-number').value = '';
            }, 500);
            
        } catch (error) {
            console.error("OTP Hatası:", error);
            UI.showToast("Geçersiz veya hatalı kod girdiniz.", "error");
        } finally {
            btnVerify.textContent = originalText;
            btnVerify.disabled = false;
        }
    },

    // 5. PDF YÜKLEME (Şeffaf / MVP)
    verifyPdf: async () => {
        const fileInput = document.getElementById('input-pdf-file');
        if (!fileInput) return;

        if (!fileInput.files || fileInput.files.length === 0) {
            UI.showToast("Lütfen cihazından bir PDF belgesi seç.", "error");
            return;
        }

        if (fileInput.files[0].type !== "application/pdf") {
            UI.showToast("Sadece PDF formatında belge yükleyebilirsin.", "error");
            return;
        }

        UI.showToast("Belgeniz sıraya alındı. Doğrulama sistemi devreye girdiğinde yetkiniz yükseltilecek.", "success");
        UI.closeModal('pdf-modal');
    },

    // 6. ÇIKIŞ YAP
    logout: () => {
        STATE.clearSession();
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        UI.showToast("Oturum kapatıldı. Stadyumdan çıkıldı.", "success");
    },

    // 7. HESABI SİL
    deleteAccount: async () => {
        if(confirm("Tüm verilerin yok edilecek. Bu işlem geri alınamaz. Emin misin?")) {
            try {
                STATE.clearAll();
                UI.toggleProfileDrawer(false);
                UI.showView('landing');
                UI.renderProfile();
                UI.showToast("Tüm verilerin sistemden silindi.", "success");
            } catch (error) {
                UI.showToast("Hesap silinirken bir hata oluştu.", "error");
            }
        }
    }
};
