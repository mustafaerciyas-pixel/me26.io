/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE ORKESTRA ŞEFİ (js/app.js)
   ========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {

    let selectedVipNumber = null;

    // --- 1. ÖNERGELERİ ÇİZME SİSTEMİ (Güvenli DOM) ---
    const renderProposals = () => {
        const container = document.getElementById('proposals-container');
        if (!container) return;
        
        container.innerHTML = ''; 
        const proposals = STATE.getProposals();

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

    // --- 2. SİSTEMİ BAŞLAT (INIT) ---
    const initSystem = () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
        } else {
            UI.showView('landing');
        }
        UI.renderProfile();
        renderProposals();
    };

    // --- 3. GÜVENLİ TIKLAMA YARDIMCISI ---
    const addClick = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    };

    // --- 4. VIP MODAL VE GRID YÖNETİMİ ---
    const updateVipModalState = () => {
        const user = STATE.getUser();
        const lockedState = document.getElementById('vip-locked-state');
        const unlockedState = document.getElementById('vip-unlocked-state');
        
        if (!lockedState || !unlockedState) return;

        if (user.inviteCount >= ME26_CONFIG.requiredInvitesForVip) {
            lockedState.classList.add('hidden');
            unlockedState.classList.remove('hidden');
            renderVipGrid();
        } else {
            unlockedState.classList.add('hidden');
            lockedState.classList.remove('hidden');
        }
    };

    const renderVipGrid = () => {
        const grid = document.getElementById('ui-vip-grid');
        const claimBtn = document.getElementById('btn-claim-vip-number');
        
        if (!grid || grid.children.length > 0) return; 
        
        grid.innerHTML = '';
        selectedVipNumber = null;
        if (claimBtn) claimBtn.disabled = true; 
        
        const sampleNumbers = [101, 102, 111, 200, 222, 500, 777, 999, 1000, 1071, 1453, 1923, 2026, 3000, 4444, 5000];
        
        sampleNumbers.forEach(num => {
            const btn = document.createElement('button');
            btn.className = "vip-num-btn bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-mono text-sm font-black hover:border-kaos hover:text-kaos transition-all";
            btn.textContent = `#${num}`;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.vip-num-btn').forEach(b => {
                    b.classList.remove('bg-kaos', 'text-slate-900', 'border-kaos');
                    b.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
                });
                
                btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
                btn.classList.add('bg-kaos', 'text-slate-900', 'border-kaos');
                
                selectedVipNumber = num;
                if (claimBtn) claimBtn.disabled = false; 
            });
            
            grid.appendChild(btn);
        });
    };

    // --- 5. PANİĞE KARŞI YEDEK KOPYALAMA SİSTEMİ (FALLBACK) ---
    const fallbackCopyTextToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback kopyalama başarısız', err);
        }
        
        document.body.removeChild(textArea);
    };

    // --- 6. PAYLAŞIM YÖNETİCİSİ (Paylaşım İlerlemesi) ---
    const handleInviteShare = async (isWhatsApp = false) => {
        const inviteLink = "https://me26.org/katil"; 
        
        try {
            if (isWhatsApp) {
                window.open(`https://wa.me/?text=ME26 dijital stadyumu'na sen de katıl: ${inviteLink}`, '_blank');
            } else {
                if (!navigator.clipboard) {
                    fallbackCopyTextToClipboard(inviteLink);
                } else {
                    await navigator.clipboard.writeText(inviteLink);
                }
            }
            
            const currentCount = STATE.incrementInviteCount();
            UI.renderProfile();
            updateVipModalState(); 
            
            if (isWhatsApp) {
                UI.showToast("WhatsApp'a yönlendiriliyor...", "success");
            } else {
                UI.showToast("Paylaşım bağlantısı kopyalandı.", "success");
            }

            if (currentCount === ME26_CONFIG.requiredInvitesForVip) {
                UI.showToast("Tebrikler! Gerekli paylaşıma ulaştınız, VIP Numara seçme kilidi açıldı 💎", "success");
            } else if (currentCount < ME26_CONFIG.requiredInvitesForVip) {
                UI.showToast("Paylaşım ilerlemesi kaydedildi.", "success");
            }

        } catch (err) {
            fallbackCopyTextToClipboard(inviteLink);
            UI.showToast("Bağlantı kopyalandı (Yedek Sistem).", "success");
        }
    };

    // --- 7. BUTONLARI VE EKRANLARI BAĞLA ---
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
        addClick('btn-submit-phone', () => AUTH.verifyPhone());
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

        addClick('btn-open-vip-modal', () => {
            updateVipModalState();
            UI.openModal('vip-modal');
        });

        addClick('btn-logout', () => AUTH.logout());
        addClick('btn-delete-account', () => AUTH.deleteAccount());

        addClick('btn-copy-invite', () => handleInviteShare(false));
        addClick('btn-wow-copy-link', () => handleInviteShare(false));
        addClick('btn-vip-copy-invite-locked', () => handleInviteShare(false));
        addClick('btn-whatsapp-share', () => handleInviteShare(true));

        addClick('btn-claim-vip-number', () => {
            if (!selectedVipNumber) return; 
            
            STATE.setVipNumber(selectedVipNumber);
            UI.closeModal('vip-modal');
            UI.renderProfile();
            UI.showToast(`Tebrikler! Kurucu VIP Numaranız #${selectedVipNumber} olarak tescillendi.`, "success");
        });

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
            
            titleEl.value = '';
            descEl.value = '';
            catEl.value = '';
        });
    };

    // --- 8. OYLAMA SİSTEMİ (Event Delegation) ---
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

    // Motoru Çalıştır
    initSystem();
    bindEvents();
});
