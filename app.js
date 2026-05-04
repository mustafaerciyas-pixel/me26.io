/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. ÖNCE BEKLE: Google'dan dönen bir kullanıcı var mı?
    const isRedirectLogin = await AUTH.checkRedirect();
    
    // 2. Eğer Google'dan dönmediyse standart ekranları çiz
    if (!isRedirectLogin) {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
        } else {
            UI.showView('landing');
        }
        UI.renderProfile();
    }

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

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

    bind('btn-open-mobile-menu', 'click', () => UI.toggleMobileMenu(true));
    bind('btn-close-mobile-menu', 'click', () => UI.toggleMobileMenu(false));
    bind('btn-close-profile-drawer', 'click', () => UI.toggleProfileDrawer(false));

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

    // Modal Adım Geçişleri (Form Doğrulama)
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

        document.getElementById('taahhut-step-1').classList.add('hidden');
        document.getElementById('taahhut-step-2').classList.remove('hidden');
    });

    bind('btn-taahhut-back', 'click', () => {
        document.getElementById('taahhut-step-1').classList.remove('hidden');
        document.getElementById('taahhut-step-2').classList.add('hidden');
    });

    bind('btn-google-login', 'click', AUTH.loginWithGoogle);
    bind('btn-manuel-login', 'click', AUTH.submitCommitment);
    
    bind('btn-close-wow', 'click', () => {
        UI.closeModal('wow-modal');
        UI.showView('voting');
        UI.toggleProfileDrawer(true); 
    });

    bind('btn-open-phone-modal', 'click', () => UI.openModal('phone-modal'));
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-submit-phone', 'click', AUTH.verifyPhone);
    bind('btn-verify-otp', 'click', AUTH.verifyOtp);

    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-submit-pdf', 'click', AUTH.verifyPdf);

    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

    bind('btn-logout', 'click', AUTH.logout);
    bind('btn-delete-account', 'click', AUTH.deleteAccount);
});
