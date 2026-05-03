/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (js/auth.js)
   (GERÇEK FİREBASE SMS ENTEGRASYONU)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';

// Firebase Kütüphanelerini Web üzerinden çağırıyoruz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Firebase'i Başlat
const app = initializeApp(ME26_CONFIG.firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'tr'; // SMS dilini Türkçe yap

let confirmationResult = null; // Gelen SMS onay objesini burada tutacağız

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

    // 3. GERÇEK TELEFON ONAYI - ADIM 1: SMS GÖNDER
    verifyPhone: async () => {
        const phoneInput = document.getElementById('input-phone-number');
        if (!phoneInput) return;

        // Numarayı temizle ve +90 formatına sok (Baştaki 0'ı atar)
        let phoneVal = phoneInput.value.replace(/\s+/g, '');
        if (phoneVal.startsWith('0')) phoneVal = phoneVal.substring(1); 
        const phone = "+90" + phoneVal;
        
        if (phone.length !== 13) { // +905554443322
            UI.showToast("Geçerli bir 10 haneli numara girin (Örn: 5XX XXX XX XX).", "error");
            return;
        }

        const btnSubmit = document.getElementById('btn-submit-phone');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = "BEKLEYİN...";
        btnSubmit.disabled = true;

        try {
            // Görünmez reCAPTCHA oluştur (index.html'in en altındaki div'i kullanır)
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible'
                });
            }

            UI.showToast("SMS gönderiliyor...", "success");
            
            // Firebase SMS Gönderme İsteği
            confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
            
            UI.showToast("Doğrulama kodu telefonunuza gönderildi!", "success");
            
            // UI Geçişi: 1. Adımı gizle, 2. Adımı (Kod Girme Ekranını) aç
            document.getElementById('phone-step-1').classList.add('hidden');
            document.getElementById('phone-step-2').classList.remove('hidden');

        } catch (error) {
            console.error("SMS Hatası:", error);
            UI.showToast("SMS gönderilemedi. Lütfen numarayı kontrol edip tekrar deneyin.", "error");
            // Hata olursa recaptcha'yı sıfırla ki tekrar deneyebilsin
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.render().then(function(widgetId) {
                    grecaptcha.reset(widgetId);
                });
            }
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    },

    // 4. GERÇEK TELEFON ONAYI - ADIM 2: KODU DOĞRULA
    confirmSmsCode: async () => {
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
            // Gelen kodu Firebase ile kontrol et
            const result = await confirmationResult.confirm(code);
            
            // Başarılı olursa!
            UI.showToast("Telefon başarıyla doğrulandı!", "success");
            
            // Yetkiyi artır ve state'i güncelle
            STATE.updateUser("authStage", "phone_verified");
            STATE.updateUser("votePower", "0.5x");
            
            // Modalı kapat ve profili yeniden çiz
            UI.closeModal('phone-modal');
            UI.renderProfile();

            // Modal arka planda kapandıktan sonra UI'ı eski haline getir (sonraki girişler için)
            setTimeout(() => {
                document.getElementById('phone-step-1').classList.remove('hidden');
                document.getElementById('phone-step-2').classList.add('hidden');
                otpInput.value = '';
                document.getElementById('input-phone-number').value = '';
            }, 500);
            
        } catch (error) {
            console.error("Kod doğrulama hatası:", error);
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

        const file = fileInput.files[0];
        if (file.type !== "application/pdf") {
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
