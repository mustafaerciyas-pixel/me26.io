/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Sayfa açıldığında Google'dan geri dönüp dönmediğimizi kontrol et
    AUTH.checkRedirect();
    
    // 1. Başlangıç Durumunu Kontrol Et
    if (STATE.isLoggedIn()) {
        UI.showView('voting');
    } else {
        UI.showView('landing');
    }
    UI.renderProfile();

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    // 2. Ana Navigasyon ve Giriş Butonları
    const handleLoginOrProfile = () => {
        if (STATE.isLoggedIn()) {
            UI.toggleProfileDrawer(true);
        } else {
            AUTH.login();
        }
    };

    ['btn-login-hero', 'btn-login-sticky', 'btn-desktop-nav-action', 'btn-mobile-nav-action'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = handleLoginOrProfile;
    });

    // 3. Menü ve Çekmece Kontrolleri
    bind('btn-open-mobile-menu', 'click', () => UI.toggleMobileMenu(true));
    bind('btn-close-mobile-menu', 'click', () => UI.toggleMobileMenu(false));
    bind('btn-close-profile-drawer', 'click', () => UI.toggleProfileDrawer(false));

    // 4. Sektör Paydaşı Seçildiğinde Detay Kutusunu Aç
    const roleSelect = document.getElementById('input-taahhut-rol');
    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            const divPaydas = document.getElementById('div-paydas-detay');
            if (e.target.value === 'Paydaş') {
                divPaydas.classList.remove('hidden');
            } else {
                divPaydas.classList.add('hidden');
            }
        });
    }

    // 5. YENİ: Kayıt Modalı Adım Geçişleri (Form Doğrulama)
    bind('btn-taahhut-next', 'click', () => {
        const cityEl = document.getElementById('input-taahhut-sehir');
        const roleEl = document.getElementById('input-taahhut-rol');
        const paydasEl = document.getElementById('input-paydas-detay');

        if (!cityEl || !cityEl.value) {
            UI.showToast('Lütfen önce şehrini seç.', 'error');
            return;
        }
        if (!roleEl || !roleEl.value) {
            UI.showToast('Lütfen mesleki durumunu seç.', 'error');
            return;
        }
        if (roleEl.value === 'Paydaş' && (!paydasEl || !paydasEl.value.trim())) {
            UI.showToast('Lütfen paydaş türünü yaz (Örn: Mimar, Usta).', 'error');
            return;
        }

        // Doğrulama başarılıysa Adım 2'ye geç
        document.getElementById('taahhut-step-1').classList.add('hidden');
        document.getElementById('taahhut-step-2').classList.remove('hidden');
    });

    bind('btn-taahhut-back', 'click', () => {
        // Geri dönmek isterse Adım 1'i tekrar aç
        document.getElementById('taahhut-step-1').classList.remove('hidden');
        document.getElementById('taahhut-step-2').classList.add('hidden');
    });

    // 6. Kayıt İşlemleri (Google veya Manuel)
    bind('btn-google-login', 'click', AUTH.loginWithGoogle);
    bind('btn-manuel-login', 'click', AUTH.submitCommitment);
    
    // 7. Tebrikler (Wow) Ekranı Kapatma
    bind('btn-close-wow', 'click', () => {
        UI.closeModal('wow-modal');
        UI.showView('voting');
        UI.toggleProfileDrawer(true); 
    });

    // 8. TELEFON VE SMS MODALI
    bind('btn-open-phone-modal', 'click', () => UI.openModal('phone-modal'));
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-submit-phone', 'click', AUTH.verifyPhone);
    bind('btn-verify-otp', 'click', AUTH.verifyOtp);

    // 9. Belge (PDF) İşlemleri
    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-submit-pdf', 'click', AUTH.verifyPdf);

    // 10. Fikir (Önerge) Modalı
    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

    // 11. Çıkış ve Silme
    bind('btn-logout', 'click', AUTH.logout);
    bind('btn-delete-account', 'click', AUTH.deleteAccount);
});
