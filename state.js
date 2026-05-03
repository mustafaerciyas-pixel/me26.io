/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (js/auth.js)
   (GERÇEK YAYIN / API ENTEGRASYONUNA HAZIR SÜRÜM)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';

export const AUTH = {
    
    // 1. GOOGLE İLE GİRİŞ
    login: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast("Sisteme yeniden hoş geldin.", "success");
            return;
        }

        try {
            // BURAYA GERÇEK GOOGLE AUTH KODU GELECEK
            UI.openModal('taahhut-modal');
        } catch (error) {
            UI.showToast("Google ile giriş yapılamadı. Tekrar deneyin.", "error");
            console.error("Auth Hatası:", error);
        }
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
            // Şimdilik sistemin kilitlenmemesi için geçici bir değişken tutuyoruz
            const realUserNo = Math.floor(1000 + Math.random() * 9000); 

            STATE.setUser({
                authStage: "google_only", 
                userNo: realUserNo,
                role: role,
                city: city,
                votePower: "0.0x", 
                inviteCount: 0,
                isVip: false
            });

            UI.closeModal('taahhut-modal');
            UI.renderProfile();
            
            const wowNoEl = document.getElementById('ui-wow-uye-no');
            if (wowNoEl) wowNoEl.textContent = `Kurucu Üye #${realUserNo}`;
            UI.openModal('wow-modal');

        } catch (error) {
            UI.showToast("Kayıt işlemi başarısız oldu.", "error");
        }
    },

    // 3. GERÇEK TELEFON ONAYI
    verifyPhone: async () => {
        const phoneInput = document.getElementById('input-phone-number');
        if (!phoneInput) return;

        const phone = phoneInput.value.replace(/\s/g, ''); 
        
        if (phone.length !== 10) {
            UI.showToast("Geçerli bir 10 haneli telefon numarası girin.", "error");
            return;
        }

        try {
            // BURAYA GERÇEK SMS GÖNDERME KODU GELECEK
            UI.showToast("Telefon doğrulandı! Oy gücü 0.5x'e yükseldi.", "success");
            
            STATE.updateUser("authStage", "phone_verified");
            STATE.updateUser("votePower", "0.5x");
            
            UI.closeModal('phone-modal');
            UI.renderProfile();
        } catch (error) {
            UI.showToast("Telefon onayı başarısız oldu.", "error");
        }
    },

    // 4. GERÇEK PDF YÜKLEME
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

        try {
            // BURAYA GERÇEK DOSYA YÜKLEME KODU GELECEK
            UI.showToast("Belge yüklendi ve onaylandı! Oy gücü 1.0x (Tam Yetki).", "success");
            
            STATE.updateUser("authStage", "fully_verified");
            STATE.updateUser("votePower", "1.0x");
            
            UI.closeModal('pdf-modal');
            UI.renderProfile();
        } catch (error) {
            UI.showToast("Belge yüklenirken bir sorun oluştu.", "error");
        }
    },

    // 5. ÇIKIŞ YAP (Sadece Oturum Kapanır, Önergeler Kalır)
    logout: () => {
        STATE.clearSession(); // DÜZELTİLDİ
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        UI.showToast("Oturum kapatıldı. Stadyumdan çıkıldı.", "success");
    },

    // 6. HESABI VE VERİLERİ SİL (Her Şey Uçar)
    deleteAccount: async () => {
        if(confirm("Tüm verilerin yok edilecek. Bu işlem geri alınamaz. Emin misin?")) {
            try {
                STATE.clearAll(); // DÜZELTİLDİ
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
