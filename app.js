/* ==========================================================================
   ME26 AĞI - ANA BEYİN VE ŞALTER KUTUSU (app.js)
   Tüm buton tıklamaları, ekran geçişleri ve sistemin başlatılması
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

const getEl = (id) => document.getElementById(id);

// --- OYLAMA SİSTEMİ GÖRÜNÜRLÜK KONTROLÜ ---
export const Me26VotingSystem = {
    updateVisibility: () => {
        const lockedState = getEl('locked-state');
        const manifestoGrid = getEl('manifesto-grid');
        
        if (!lockedState || !manifestoGrid) return;

        if (STATE.isLoggedIn()) {
            // Kullanıcı giriş yaptıysa kilit ekranını gizle, sandıkları aç
            lockedState.classList.add('hidden');
            manifestoGrid.classList.remove('hidden');
            manifestoGrid.classList.add('grid');
        } else {
            // Giriş yapmadıysa sandıkları kilitle
            lockedState.classList.remove('hidden');
            manifestoGrid.classList.add('hidden');
            manifestoGrid.classList.remove('grid');
        }
    }
};

// --- TÜM BUTON BAĞLANTILARI (EVENT LISTENERS) ---
const setupEventListeners = () => {
    
    // 1. ANA MENÜ VE GİRİŞ BUTONLARI
    const btnDesktopNav = getEl('btn-desktop-nav-action');
    const btnMobileNav = getEl('btn-mobile-nav-action');
    const btnHeroLogin = getEl('btn-login-hero');
    const btnStickyLogin = getEl('btn-login-sticky');
    const btnUnlockManifesto = getEl('btn-unlock-manifesto');

    const handleLoginClick = () => {
        if (STATE.isLoggedIn()) {
            UI.toggleProfileDrawer(true); // Girişliyse profili aç
        } else {
            AUTH.login(); // Girişli değilse taahhüt modalını aç
        }
    };

    if (btnDesktopNav) btnDesktopNav.addEventListener('click', handleLoginClick);
    if (btnMobileNav) btnMobileNav.addEventListener('click', () => { UI.toggleMobileMenu(false); handleLoginClick(); });
    if (btnHeroLogin) btnHeroLogin.addEventListener('click', AUTH.login);
    if (btnStickyLogin) btnStickyLogin.addEventListener('click', AUTH.login);
    if (btnUnlockManifesto) btnUnlockManifesto.addEventListener('click', AUTH.login);

    // 2. MOBİL MENÜ KONTROLLERİ
    const btnOpenMenu = getEl('btn-open-mobile-menu');
    const btnCloseMenu = getEl('btn-close-mobile-menu');
    if (btnOpenMenu) btnOpenMenu.addEventListener('click', () => UI.toggleMobileMenu(true));
    if (btnCloseMenu) btnCloseMenu.addEventListener('click', () => UI.toggleMobileMenu(false));

    // 3. PROFİL ÇEKMECESİ VE İÇİNDEKİ BUTONLAR
    const btnCloseProfile = getEl('btn-close-profile-drawer');
    const btnLogout = getEl('btn-logout');
    const btnDeleteAccount = getEl('btn-delete-account');
    
    if (btnCloseProfile) btnCloseProfile.addEventListener('click', () => UI.toggleProfileDrawer(false));
    if (btnLogout) btnLogout.addEventListener('click', AUTH.logout);
    if (btnDeleteAccount) btnDeleteAccount.addEventListener('click', AUTH.deleteAccount);

    // Profil içi modal açıcılar
    const btnOpenPhoneModal = getEl('btn-open-phone-modal');
    const btnOpenPdfModal = getEl('btn-open-pdf-modal');
    const btnOpenVipModal = getEl('btn-open-vip-modal');
    
    if (btnOpenPhoneModal) btnOpenPhoneModal.addEventListener('click', () => UI.openModal('phone-modal'));
    if (btnOpenPdfModal) btnOpenPdfModal.addEventListener('click', () => UI.openModal('pdf-modal'));
    if (btnOpenVipModal) btnOpenVipModal.addEventListener('click', () => UI.openModal('vip-modal'));

    // Davet kodu kopyalama
    const btnCopyInvite = getEl('btn-copy-invite');
    if (btnCopyInvite) {
        btnCopyInvite.addEventListener('click', () => {
            const link = getEl('ui-invite-link')?.textContent;
            if (link) {
                navigator.clipboard.writeText(link);
                UI.showToast('Davet linkin kopyalandı!', 'success');
            }
        });
    }

    // 4. MODALLAR (PENCERELER) İÇİNDEKİ BUTONLAR
    
    // -- Taahhüt Modalı (Giriş) --
    const btnTaahhutNext = getEl('btn-taahhut-next');
    const btnTaahhutBack = getEl('btn-taahhut-back');
    const btnGoogleLogin = getEl('btn-google-login');
    const btnCloseTaahhut = getEl('btn-close-taahhut-modal');

    if (btnTaahhutNext) {
        btnTaahhutNext.addEventListener('click', () => {
            const city = getEl('input-taahhut-sehir')?.value;
            const role = getEl('input-taahhut-rol')?.value;
            if (!city || !role) {
                UI.showToast('Lütfen şehrini ve mesleki durumunu seç.', 'error');
                return;
            }
            getEl('taahhut-step-1')?.classList.add('hidden');
            getEl('taahhut-step-2')?.classList.remove('hidden');
        });
    }
    if (btnTaahhutBack) {
        btnTaahhutBack.addEventListener('click', () => {
            getEl('taahhut-step-1')?.classList.remove('hidden');
            getEl('taahhut-step-2')?.classList.add('hidden');
        });
    }
    if (btnGoogleLogin) btnGoogleLogin.addEventListener('click', AUTH.loginWithGoogle);
    if (btnCloseTaahhut) btnCloseTaahhut.addEventListener('click', () => UI.closeModal('taahhut-modal'));

    // -- WOW Modalı (İlk Kayıt Kutlaması) --
    const btnWowCopy = getEl('btn-wow-copy-link');
    const btnCloseWow = getEl('btn-close-wow');
    if (btnWowCopy) {
        btnWowCopy.addEventListener('click', () => {
            const link = getEl('ui-invite-link')?.textContent;
            if (link) {
                navigator.clipboard.writeText(link);
                UI.showToast('Link kopyalandı! Şimdi 3 kişiyi davet et.', 'success');
            }
        });
    }
    if (btnCloseWow) btnCloseWow.addEventListener('click', () => UI.closeModal('wow-modal'));

    // -- Telefon Onayı Modalı --
    const btnSubmitPhone = getEl('btn-submit-phone');
    const btnVerifyOtp = getEl('btn-verify-otp');
    const btnClosePhone = getEl('btn-close-phone-modal');
    if (btnSubmitPhone) btnSubmitPhone.addEventListener('click', AUTH.verifyPhone);
    if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', AUTH.verifyOtp);
    if (btnClosePhone) btnClosePhone.addEventListener('click', () => UI.closeModal('phone-modal'));

    // -- PDF (E-Devlet) Yükleme Modalı (Eksik olan kablo buydu!) --
    const btnSubmitPdf = getEl('btn-submit-pdf');
    const btnClosePdf = getEl('btn-close-pdf-modal');
    if (btnSubmitPdf) btnSubmitPdf.addEventListener('click', AUTH.verifyPdf);
    if (btnClosePdf) btnClosePdf.addEventListener('click', () => UI.closeModal('pdf-modal'));

    // -- VIP Kurucu Modalı İptal Butonu --
    const btnCloseVipModal = getEl('btn-close-vip-modal');
    if (btnCloseVipModal) btnCloseVipModal.addEventListener('click', () => UI.closeModal('vip-modal'));
    
    const btnVipCopyLocked = getEl('btn-vip-copy-invite-locked');
    if (btnVipCopyLocked) {
        btnVipCopyLocked.addEventListener('click', () => {
            const link = getEl('ui-invite-link')?.textContent;
            if (link) {
                navigator.clipboard.writeText(link);
                UI.showToast('Davet linkin kopyalandı!', 'success');
            }
        });
    }

    // -- Önerge (Yeni Fikir) Modalı --
    const btnOpenProposal = getEl('btn-open-proposal-modal');
    const btnCloseProposal = getEl('btn-close-proposal-modal');
    if (btnOpenProposal) btnOpenProposal.addEventListener('click', () => UI.openModal('onerge-modal'));
    if (btnCloseProposal) btnCloseProposal.addEventListener('click', () => UI.closeModal('onerge-modal'));
};

// --- SİSTEMİ BAŞLATAN ANA MOTOR ---
const initApp = async () => {
    UI.init(); 
    setupEventListeners();

    // 1. Firebase Google Yönlendirmesini Kontrol Et
    const isRedirect = await AUTH.checkRedirect();
    
    // 2. Arayüzü Duruma Göre Güncelle
    if (STATE.isLoggedIn()) {
        UI.showView('voting');
        UI.renderProfile();
    } else if (!isRedirect) {
        UI.showView('landing');
        UI.renderProfile();
    }

    // 3. Sandıkların Kilit Durumunu Ayarla
    Me26VotingSystem.updateVisibility();
    
    console.log("ME26 Ağı Sistem İçmimarisi Başarıyla Yüklendi.");
};

// DOM (HTML) tamamen yüklendiğinde şalteri kaldır
document.addEventListener('DOMContentLoaded', initApp);
