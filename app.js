/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE ORKESTRA ŞEFİ (js/app.js)
   (FİREBASE OTP ENTEGRASYONLU TAM SÜRÜM)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';
import { VIP } from './vip.js';

document.addEventListener('DOMContentLoaded', () => {

    const renderProposals = () => {
        const container = document.getElementById('proposals-container');
        if (!container) return;
        
        container.innerHTML = ''; 
        const proposals = STATE.getProposals();

        if (proposals.length === 0) {
            const empty = document.createElement('div');
            empty.className = "bg-black/40 border border-slate-700 rounded-2xl p-6 text-center text-gray-400 text-sm font-bold";
            empty.textContent = "Henüz önerge yok. İlk sorunu sen bildir.";
            container.appendChild(empty);
            return;
        }

        proposals.forEach(prop => {
            const card = document.createElement('div');
            card.className = "bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-md transform transition hover:scale-[1.01] mb-4 toast-in";
            
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="prop-category text-[9px] font-bold tracking-widest text-kaos bg-kaos/10 px-2 py-1 rounded uppercase"></span>
                        <h3 class="prop-title text-white font-black text-lg mt-2"></h3>
                    </div>
                    <div class="flex -space-x-2">
                        <div class="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-lg">Sen</div>
                    </div>
                </div>
                <p class="prop-desc text-slate-400 text-sm mb-4"></p>
                <div class="flex items-center justify-between text-xs text-slate-500 font-bold border-t border-slate-700/50 pt-3">
                    <div class="flex items-center gap-3">
                        <span class="flex items-center gap-1 text-green-400">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path></svg> 1 Destek
                        </span>
                    </div>
                    <span>Az önce</span>
                </div>
            `;

            card.querySelector('.prop-category').textContent = prop.category;
            card.querySelector('.prop-title').textContent = prop.title;
            card.querySelector('.prop-desc').textContent = prop.desc;
            
            container.appendChild(card);
        });
    };

    const initSystem = () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
        } else {
            UI.showView('landing');
        }
        UI.renderProfile();
        renderProposals(); 
    };

    const addClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    };

    const bindEvents = () => {
        const handleMainAction = () => {
            if (STATE.isLoggedIn()) {
                UI.toggleProfileDrawer(true); 
                UI.toggleMobileMenu(false);   
            } else {
                AUTH.login(); 
                UI.toggleMobileMenu(false);
            }
        };

        addClick('btn-desktop-nav-action', handleMainAction);
        addClick('btn-mobile-nav-action', handleMainAction);
        addClick('btn-login-hero', handleMainAction);
        addClick('btn-login-sticky', handleMainAction);

        addClick('btn-open-mobile-menu', () => UI.toggleMobileMenu(true));
        addClick('btn-close-mobile-menu', () => UI.toggleMobileMenu(false));
        addClick('btn-close-profile-drawer', () => UI.toggleProfileDrawer(false));

        addClick('btn-role-icmimar', () => AUTH.submitCommitment('icmimar'));
        addClick('btn-role-ogrenci', () => AUTH.submitCommitment('ogrenci'));
        
        // FİREBASE SMS VE OTP BAĞLANTILARI
        addClick('btn-submit-phone', () => AUTH.verifyPhone());
        addClick('btn-verify-otp', () => AUTH.verifyOtp()); 
        
        addClick('btn-submit-pdf', () => AUTH.verifyPdf());
        
        addClick('btn-open-pdf-modal', () => {
            UI.toggleProfileDrawer(false);
            UI.openModal('pdf-modal');
        });
        addClick('btn-close-wow', () => { UI.closeModal('wow-modal'); UI.showView('voting'); });
        addClick('btn-close-phone-modal', () => UI.closeModal('phone-modal'));
        addClick('btn-close-pdf-modal', () => UI.closeModal('pdf-modal'));
        addClick('btn-close-vip-modal', () => UI.closeModal('vip-modal'));
        addClick('btn-close-proposal-modal', () => UI.closeModal('onerge-modal'));

        addClick('btn-logout', () => AUTH.logout());
        addClick('btn-delete-account', () => AUTH.deleteAccount());

        addClick('btn-open-vip-modal', () => {
            VIP.updateModalState();
            UI.openModal('vip-modal');
        });
        addClick('btn-copy-invite', () => VIP.handleShare(false));
        addClick('btn-wow-copy-link', () => VIP.handleShare(false));
        addClick('btn-vip-copy-invite-locked', () => VIP.handleShare(false));
        addClick('btn-whatsapp-share', () => VIP.handleShare(true));
        addClick('btn-claim-vip-number', () => VIP.claimNumber());

        addClick('btn-open-proposal-modal', () => {
            if (!STATE.isLoggedIn()) {
                UI.showToast("Sorun bildirmek için önce sisteme katıl.", "error");
                AUTH.login();
                return;
            }
            UI.openModal('onerge-modal');
        });

        addClick('btn-submit-proposal', () => {
            const titleEl = document.getElementById('input-proposal-title');
            const descEl = document.getElementById('input-proposal-desc');
            const catEl = document.getElementById('input-proposal-category');
            
            if(!titleEl?.value || !descEl?.value || !catEl?.value) {
                UI.showToast("Lütfen tüm alanları doldurun.", "error");
                return;
            }

            STATE.addProposal({
                title: titleEl.value,
                desc: descEl.value,
                category: catEl.value
            });

            renderProposals();

            UI.showToast("Fikriniz meclise sunuldu ve destek sırasına alındı.", "success");
            UI.closeModal('onerge-modal');
            
            titleEl.value = ''; descEl.value = ''; catEl.value = '';
        });
    };

    document.addEventListener('click', (e) => {
        const voteBtn = e.target.closest('.btn-vote');
        if (voteBtn) {
            if (!STATE.isLoggedIn()) {
                UI.showToast("Oy kullanmak için önce sisteme katıl.", "error");
                AUTH.login();
                return;
            }
            
            const card = voteBtn.closest('.poll-card');
            if (card) {
                const activeArea = card.querySelector('.poll-active-area');
                const resultArea = card.querySelector('.poll-result-area');
                if (activeArea && resultArea) {
                    activeArea.classList.add('hidden');
                    resultArea.classList.remove('hidden');
                    UI.showToast("Oyunuz sisteme kaydedildi.", "success");
                }
            }
        }

        const changeVoteBtn = e.target.closest('.btn-change-vote');
        if (changeVoteBtn) {
            if (!STATE.isLoggedIn()) return;

            const card = changeVoteBtn.closest('.poll-card');
            if (card) {
                const activeArea = card.querySelector('.poll-active-area');
                const resultArea = card.querySelector('.poll-result-area');
                if (activeArea && resultArea) {
                    resultArea.classList.add('hidden');
                    activeArea.classList.remove('hidden');
                    UI.showToast("Oyunuz sıfırlandı. Yeniden oy kullanabilirsiniz.", "success");
                }
            }
        }
    });

    initSystem();
    bindEvents();
});
