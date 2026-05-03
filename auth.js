/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (js/auth.js)
   (ŞEFFAF YAYIN / ERKEN ERİŞİM SÜRÜMÜ)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';

export const AUTH = {
    
    // 1. GİRİŞ VE TAAHHÜT
    login: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast("Sisteme yeniden hoş geldin.", "success");
            return;
        }

        // Direkt taahhüt (şehir/meslek) ekranına alıyoruz
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
                authStage: "registered", // Başlangıç aşaması
                userNo: "BEKLEYEN",      // Gerçek ID gelene kadar bekleyen
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

    // 3. TELEFON ONAYI (Şeffaflık Bildirimi)
    verifyPhone: async () => {
        const phoneInput = document.getElementById('input-phone-number');
        if (!phoneInput) return;

        const phone = phoneInput.value.replace(/\s/g, ''); 
        
        if (phone.length !== 10) {
            UI.showToast("Geçerli bir 10 haneli telefon numarası girin.", "error");
            return;
        }

        // Sahte onay yok, sadece numara kaydedildi bildirimi
        UI.showToast("Numaranız kaydedildi. Doğrulama servisi aktifleştiğinde bilgilendirileceksiniz.", "success");
        UI.closeModal('phone-modal');
    },

    // 4. PDF YÜKLEME (Şeffaflık Bildirimi)
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

        // Sahte onay yok, sadece belge sıraya alındı bildirimi
        UI.showToast("Belgeniz sıraya alındı. Doğrulama sistemi devreye girdiğinde yetkiniz yükseltilecek.", "success");
        UI.closeModal('pdf-modal');
    },

    // 5. ÇIKIŞ YAP (Sadece Oturum Kapanır, Önergeler Kalır)
    logout: () => {
        STATE.clearSession();
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        UI.showToast("Oturum kapatıldı. Stadyumdan çıkıldı.", "success");
    },

    // 6. HESABI VE VERİLERİ SİL (Her Şey Uçar)
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
