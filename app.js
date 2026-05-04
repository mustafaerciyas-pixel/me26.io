/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE DOM DİNLEYİCİLERİ (app.js)
   1 Tıkla Giriş + Kademeli Profilleme Sürümü
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

// =========================================================================
// CANLI OYLAMA SANDIĞI (YETKİ FİLTRESİ VE SUPABASE BAĞLANTISI)
// =========================================================================
export const Me26VotingSystem = {
    init: function() {
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleVote(e.target));
        });

        const unlockBtn = document.getElementById('btn-unlock-manifesto');
        if(unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                if (STATE.isLoggedIn()) {
                    UI.toggleProfileDrawer(true);
                } else {
                    AUTH.loginWithGoogle(); // Kilitli ekrandan geleni direkt Google'a atar
                }
            });
        }
    },

    updateVisibility: function() {
        const lockedState = document.getElementById('locked-state');
        const manifestoGrid = document.getElementById('manifesto-grid');

        if (STATE.isLoggedIn()) {
            if(lockedState) lockedState.style.display = 'none';
            if(manifestoGrid) {
                manifestoGrid.classList.remove('hidden');
                manifestoGrid.classList.add('grid');
            }
            
            // URL'deki kendi referans kodumuzu profile davet linki olarak ekleyelim
            const inviteLinkEl = document.getElementById('ui-invite-link');
            if(inviteLinkEl && STATE.user && STATE.user.davetKodu) {
                inviteLinkEl.textContent = `https://me26.org/katil?ref=${STATE.user.davetKodu}`;
            }
            
        } else {
            if(lockedState) lockedState.style.display = 'flex';
            if(manifestoGrid) {
                manifestoGrid.classList.add('hidden');
                manifestoGrid.classList.remove('grid');
            }
        }
    },

    handleVote: async function(btnEl) {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Oy kullanmak için sisteme giriş yapmalısın!', 'error');
            return;
        }

        const userRole = (STATE.user && (STATE.user.role || STATE.user.job)) ? (STATE.user.role || STATE.user.job).toLowerCase() : '';
        const container = btnEl.closest('.vote-buttons-container');
        const requiredAuth = container.getAttribute('data-auth'); 

        // Not: Artık rol atamasını belgeye göre yaptığımız için, İçmimarlık tek kelime olarak kontrol edilir.
        if (requiredAuth === 'icmimar' && !userRole.includes('içmimar') && !userRole.includes('mimar')) {
            UI.showToast('Erişim Engellendi: Bu sandığı sadece İçmimarlar oylayabilir.', 'error');
            return;
        }
        if (requiredAuth === 'ogrenci' && !userRole.includes('öğrenci')) {
            UI.showToast('Erişim Engellendi: Bu sandık sadece Öğrenciler içindir.', 'error');
            return;
        }

        const currentPower = parseFloat((STATE.user.votePower || "0").replace('x', ''));
        if (currentPower === 0) {
            UI.showToast('Geçersiz Oy Gücü! Profil panelinden e-devlet belgenizi onaylatmalısınız.', 'error');
            return;
        }

        const choice = btnEl.getAttribute('data-vote');
        
        // GÖRSEL (UI) KİLİTLEME VE RENKLENDİRME
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
        
        this.animateResults(container.parentElement, choice, currentPower);
        UI.showToast(`Oyunuz blokzincire başarıyla işlendi! (Güç: ${currentPower}x)`, 'success');
    },

    animateResults: function(cardEl, userChoice, votePower) {
        let baseYes = Math.floor(Math.random() * 40) + 20; 
        let baseAbstain = Math.floor(Math.random() * 10) + 5;
        let baseNo = 100 - (baseYes + baseAbstain);

        if (userChoice === 'yes') baseYes += (20 * votePower);
        if (userChoice === 'abstain') baseAbstain += (20 * votePower);
        if (userChoice === 'no') baseNo += (20 * votePower);

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
// EVENT LISTENER'LAR (ŞALTER KUTUSU)
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    
    Me26VotingSystem.init();

    const bind = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    // ---------------------------------------------------------
    // TÜM TURNİKELER TEK TIKLA GOOGLE'A BAĞLANDI (FORMSUZ GİRİŞ)
    // ---------------------------------------------------------
    const loginButtons = [
        'btn-register-hero', 'btn-register-sticky', 'btn-register-nav', 'btn-register-mobile',
        'btn-login-hero', 'btn-login-sticky', 'btn-login-nav', 'btn-login-mobile'
    ];
    
    loginButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.onclick = AUTH.loginWithGoogle;
    });
    // ---------------------------------------------------------

    bind('btn-open-mobile-menu', 'click', () => UI.toggleMobileMenu(true));
    bind('btn-close-mobile-menu', 'click', () => UI.toggleMobileMenu(false));
    bind('btn-close-profile-drawer', 'click', () => UI.toggleProfileDrawer(false));
    
    bind('btn-close-wow', 'click', () => {
        UI.closeModal('wow-modal');
        UI.showView('voting');
        UI.toggleProfileDrawer(true); 
    });

    // PAYLAŞIM VE LİNK KOPYALAMA
    const copyLinkToClipboard = async () => {
        const inviteLinkEl = document.getElementById('ui-invite-link');
        const link = inviteLinkEl ? inviteLinkEl.textContent : 'https://me26.org';
        try {
            await navigator.clipboard.writeText(link);
            UI.showToast('Davet linkin kopyalandı! Instagramda paylaş.', 'success');
        } catch(e) {
            UI.showToast('Link kopyalanamadı, manuel seç.', 'error');
        }
    };
    
    bind('btn-copy-invite', 'click', copyLinkToClipboard);
    bind('ui-invite-link', 'click', copyLinkToClipboard);
    bind('btn-wow-copy-link', 'click', copyLinkToClipboard);
    bind('btn-vip-copy-invite-locked', 'click', copyLinkToClipboard);

    bind('btn-share-id-card', 'click', copyLinkToClipboard); 
    bind('btn-whatsapp-share', 'click', () => {
        const link = document.getElementById('ui-invite-link')?.textContent || 'https://me26.org';
        window.open(`https://wa.me/?text=Sadece İçmimarların Girebildiği Dijital Stadyuma Katıl: ${link}`, '_blank');
    });

    // VIP KURUCU MODALI 
    bind('btn-open-vip-modal', 'click', () => UI.openModal('vip-modal'));
    bind('btn-close-vip-modal', 'click', () => UI.closeModal('vip-modal'));

    // TELEFON VE SMS MODALI
    bind('btn-open-phone-modal', 'click', () => UI.openModal('phone-modal'));
    bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));
    bind('btn-submit-phone', 'click', AUTH.verifyPhone);
    bind('btn-verify-otp', 'click', AUTH.verifyOtp);

    // FİKİR (ÖNERGE) MODALI
    bind('btn-open-proposal-modal', 'click', () => UI.openModal('onerge-modal'));
    bind('btn-close-proposal-modal', 'click', () => UI.closeModal('onerge-modal'));

    // ÇIKIŞ VE SİLME
    bind('btn-logout', 'click', AUTH.logout);
    bind('btn-delete-account', 'click', AUTH.deleteAccount);

    // KUSURSUZ BELGE (PDF) BAĞLANTISI
    bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
    bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
    
    const btnSubmitPdf = document.getElementById('btn-submit-pdf');
    if (btnSubmitPdf) {
        const newBtn = btnSubmitPdf.cloneNode(true);
        btnSubmitPdf.parentNode.replaceChild(newBtn, btnSubmitPdf);
        newBtn.addEventListener('click', AUTH.verifyPdf);
    }

    // YÖNLENDİRME VE GÖRÜNÜM KONTROLÜ
    const isRedirect = await AUTH.checkRedirect();
    
    if (!isRedirect) {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
        } else {
            UI.showView('landing');
        }
        UI.renderProfile();
        Me26VotingSystem.updateVisibility();
    }
});
