/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    
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

    // YENİ: Sektör Paydaşı Seçildiğinde Detay Kutusunu Aç
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

    // KAYIT İŞLEMLERİ (Google veya Manuel)
    bind('btn-google-login', 'click', AUTH.loginWithGoogle);
    bind('btn-manuel-login', 'click', AUTH.submitCommitment);
    
    bind('btn-close-wow', 'click', () => {
        UI.closeModal('wow-modal');
        UI.showView('voting');
        UI.toggleProfileDrawer(true); 
    });

    // TELEFON VE SMS MODALI
    bind('btn-open-phone-modal', 'click', () => UI.openModal('phone-modal'));
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-submit-phone', 'click', AUTH.verifyPhone);
    bind('btn-verify-otp', 'click', AUTH.verifyOtp);

    // BELGE (PDF) İŞLEMLERİ
    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    bind('btn-submit-pdf', 'click', AUTH.verifyPdf);

    // FİKİR (ÖNERGE) MODALI
    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

    // ÇIKIŞ
    bind('btn-logout', 'click', AUTH.logout);
    bind('btn-delete-account', 'click', AUTH.deleteAccount);
});
