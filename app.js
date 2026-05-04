/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

// =========================================================================
// YENİ EKLENEN: ORTAK AKIL SANDIĞI (YETKİ FİLTRESİ VE KİLİT MOTORU)
// =========================================================================
export const Me26VotingSystem = {
    init: function() {
        // Tıklanan oylama butonlarını dinle
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e.target));
        });

        // Kilit Ekranındaki Yönlendirme Butonu (Profil çekmecesini veya giriş ekranını açar)
        const unlockBtn = document.getElementById('btn-unlock-manifesto');
        if(unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                if (STATE.isLoggedIn()) {
                    UI.toggleProfileDrawer(true);
                } else {
                    // Kullanıcıyı direkt giriş menüsüne yönlendirir
                    const taahhutModal = document.getElementById('taahhut-modal');
                    if(taahhutModal && typeof UI.openModal === 'function') {
                        UI.openModal('taahhut-modal');
                    } else {
                        UI.toggleProfileDrawer(true); 
                    }
                }
            });
        }
        
        console.log("🛠️ Me26 Oylama ve Kilit Motoru Başlatıldı.");
    },

    updateVisibility: function() {
        const lockedState = document.getElementById('locked-state');
        const manifestoGrid = document.getElementById('manifesto-grid');

        if (STATE.isLoggedIn()) {
            // Giriş yapıldıysa kilidi sakla ve önergeleri (kartları) göster
            if(lockedState) lockedState.style.display = 'none';
            if(manifestoGrid) {
                manifestoGrid.classList.remove('hidden');
                manifestoGrid.classList.add('grid');
            }
        } else {
            // Giriş yoksa önergeleri sakla, kilidi göster
            if(lockedState) lockedState.style.display = 'flex';
            if(manifestoGrid) {
                manifestoGrid.classList.add('hidden');
                manifestoGrid.classList.remove('grid');
            }
        }
    },

    handleVote: function(btnEl) {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Oy kullanmak için sisteme giriş yapmalısın!', 'error');
            return;
        }

        // STATE objesinden kullanıcının rolünü al ('İçmimar', 'Öğrenci' vb.)
        const userRole = (STATE.user && (STATE.user.role || STATE.user.job)) ? (STATE.user.role || STATE.user.job).toLowerCase() : '';
        
        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); // 'icmimar', 'ogrenci', 'all'

        // YETKİ KONTROLÜ (FİLTRE)
        if (requiredAuth === 'icmimar' && !userRole.includes('içmimar') && !userRole.includes('mimar')) {
            UI.showToast('Erişim Engellendi: Bu önergeyi sadece İçmimarlar oylayabilir.', 'error');
            return;
        }
        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) {
            UI.showToast('Erişim Engellendi: Bu önerge sadece Öğrenciler içindir.', 'error');
            return;
        }

        const choice = btnEl.getAttribute('data-vote');

        // BUTONLARI KİLİTLE VE RENKLENDİR
        const allButtons = container.querySelectorAll('.vote-btn');
        allButtons.forEach(b => {
            b.disabled = true;
            b.classList.remove('hover:border-green-500', 'hover:border-yellow-500', 'hover:border-red-500', 'hover:bg-slate-700');
            b.classList.add('opacity-30', 'cursor-not-allowed');
        });

        btnEl.classList.remove('opacity-30', 'bg-slate-800', 'text-gray-400');
        
        if (choice === 'yes') btnEl.classList.add('bg-green-900/60', 'border-green-500', 'text-green-400');
        else if (choice === 'abstain') btnEl.classList.add('bg-yellow-900/60', 'border-yellow-500', 'text-yellow-400');
        else if (choice === 'no') btnEl.classList.add('bg-red-900/60', 'border-red-500', 'text-red-400');

        // ANİMASYONU TETİKLE
        this.animateResults(container.parentElement, choice);
        UI.showToast('Oyunuz blokzincire başarıyla eklendi!', 'success');
    },

    animateResults: function(cardEl, userChoice) {
        let baseYes = Math.floor(Math.random() * 40) + 20; 
        let baseAbstain = Math.floor(Math.random() * 10) + 5;
        let baseNo = 100 - (baseYes + baseAbstain);

        if (userChoice === 'yes') baseYes += 20;
        if (userChoice === 'abstain') baseAbstain += 20;
        if (userChoice === 'no') baseNo += 20;

        const total = baseYes + baseAbstain + baseNo;
        const pY = Math.round((baseYes / total) * 100);
        const pA = Math.round((baseAbstain / total) * 100);
        const pN = 100 - (pY + pA);

        setTimeout(() => {
            const barY = cardEl.querySelector('.vote-bar-yes');
            const barA = cardEl.querySelector('.vote-bar-abstain');
            const barN = cardEl.querySelector('.vote-bar-no');
            if(barY) barY.style.width = pY + '%';
            if(barA) barA.style.width = pA + '%';
            if(barN) barN.style.width = pN + '%';

            const textY = cardEl.querySelector('.vote-text-yes');
            const textA = cardEl.querySelector('.vote-text-abstain');
            const textN = cardEl.querySelector('.vote-text-no');
            if(textY) textY.textContent = `%${pY} Kabul`;
            if(textA) textA.textContent = `%${pA} Çekimser`;
            if(textN) textN.textContent = `%${pN} Ret`;
        }, 50);
    }
};

// =========================================================================
// MEVCUT SİSTEM VE EVENT LISTENER'LAR
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Oylama motorunu başlat ve ekran kilidini kontrol et
    Me26VotingSystem.init();
    Me26VotingSystem.updateVisibility();

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

    // Sektör Paydaşı Seçildiğinde Detay Kutusunu Aç
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
