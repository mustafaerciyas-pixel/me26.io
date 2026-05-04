/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE ORKESTRA ŞEFİ (app.js)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { AUTH } from './auth.js';
import { VIP } from './vip.js';

/* --------------------------------------------------------------------------
   GÜVENLİ DOM YARDIMCILARI
-------------------------------------------------------------------------- */

const getEl = (id) => document.getElementById(id);

const addClick = (id, callback) => {
    const el = getEl(id);
    if (el) el.addEventListener('click', callback);
};

/* --------------------------------------------------------------------------
   ÖNERGE KARTLARI
-------------------------------------------------------------------------- */

const renderProposals = () => {
    const container = getEl('proposals-container');
    if (!container) return;

    container.innerHTML = '';

    const proposals = STATE.getProposals();

    if (proposals.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'bg-black/40 border border-slate-700 rounded-2xl p-6 text-center text-gray-400 text-sm font-bold';
        empty.textContent = 'Henüz önerge yok. İlk sorunu sen bildir.';
        container.appendChild(empty);
        return;
    }

    proposals.forEach((proposal) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800 rounded-xl p-5 border border-slate-700 shadow-md transform transition hover:scale-[1.01] mb-4 toast-in';

        const top = document.createElement('div');
        top.className = 'flex justify-between items-start mb-3';

        const textWrap = document.createElement('div');

        const category = document.createElement('span');
        category.className = 'text-[9px] font-bold tracking-widest text-kaos bg-kaos/10 px-2 py-1 rounded uppercase';
        category.textContent = proposal.category;

        const title = document.createElement('h3');
        title.className = 'text-white font-black text-lg mt-2';
        title.textContent = proposal.title;

        textWrap.appendChild(category);
        textWrap.appendChild(title);

        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'flex -space-x-2';

        const avatar = document.createElement('div');
        avatar.className = 'w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-800 flex items-center justify-center text-xs font-bold text-white shadow-lg';
        avatar.textContent = 'Sen';

        avatarWrap.appendChild(avatar);

        top.appendChild(textWrap);
        top.appendChild(avatarWrap);

        const desc = document.createElement('p');
        desc.className = 'text-slate-400 text-sm mb-4';
        desc.textContent = proposal.desc;

        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-between text-xs text-slate-500 font-bold border-t border-slate-700/50 pt-3';

        const supportWrap = document.createElement('div');
        supportWrap.className = 'flex items-center gap-3';

        const support = document.createElement('span');
        support.className = 'flex items-center gap-1 text-green-400';
        support.textContent = `${proposal.support || 1} Destek`;

        supportWrap.appendChild(support);

        const time = document.createElement('span');
        time.textContent = 'Az önce';

        footer.appendChild(supportWrap);
        footer.appendChild(time);

        card.appendChild(top);
        card.appendChild(desc);
        card.appendChild(footer);

        container.appendChild(card);
    });
};

/* --------------------------------------------------------------------------
   SİSTEM BAŞLANGICI
-------------------------------------------------------------------------- */

const initSystem = () => {
    if (STATE.isLoggedIn()) {
        UI.showView('voting');
    } else {
        UI.showView('landing');
    }

    UI.renderProfile();
    renderProposals();
};

/* --------------------------------------------------------------------------
   BUTONLARI BAĞLA
-------------------------------------------------------------------------- */

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

    /* ----------------------------------------------------------------------
       ANA GİRİŞ / PROFİL
    ---------------------------------------------------------------------- */

    addClick('btn-desktop-nav-action', handleMainAction);
    addClick('btn-mobile-nav-action', handleMainAction);
    addClick('btn-login-hero', handleMainAction);
    addClick('btn-login-sticky', handleMainAction);

    /* ----------------------------------------------------------------------
       MOBİL MENÜ / PROFİL ÇEKMECESİ
    ---------------------------------------------------------------------- */

    addClick('btn-open-mobile-menu', () => UI.toggleMobileMenu(true));
    addClick('btn-close-mobile-menu', () => UI.toggleMobileMenu(false));
    addClick('btn-close-profile-drawer', () => UI.toggleProfileDrawer(false));

    /* ----------------------------------------------------------------------
       KİMLİK / KAYIT / YETKİ
    ---------------------------------------------------------------------- */

    addClick('btn-role-icmimar', () => AUTH.submitCommitment('icmimar'));
    addClick('btn-role-ogrenci', () => AUTH.submitCommitment('ogrenci'));

    addClick('btn-submit-phone', () => AUTH.verifyPhone());
    addClick('btn-verify-otp', () => AUTH.verifyOtp());

    addClick('btn-submit-pdf', () => AUTH.verifyPdf());

    addClick('btn-open-pdf-modal', () => {
        UI.toggleProfileDrawer(false);
        UI.openModal('pdf-modal');
    });

    /* ----------------------------------------------------------------------
       MODAL KAPATICILAR
    ---------------------------------------------------------------------- */

    addClick('btn-close-wow', () => {
        UI.closeModal('wow-modal');
        UI.showView('voting');
    });

    addClick('btn-close-phone-modal', () => {
        UI.closeModal('phone-modal');
    });

    addClick('btn-close-pdf-modal', () => {
        UI.closeModal('pdf-modal');
    });

    addClick('btn-close-vip-modal', () => {
        UI.closeModal('vip-modal');
    });

    addClick('btn-close-proposal-modal', () => {
        UI.closeModal('onerge-modal');
    });

    /* ----------------------------------------------------------------------
       ÇIKIŞ / SİLME
    ---------------------------------------------------------------------- */

    addClick('btn-logout', () => AUTH.logout());
    addClick('btn-delete-account', () => AUTH.deleteAccount());

    /* ----------------------------------------------------------------------
       VIP / PAYLAŞIM
    ---------------------------------------------------------------------- */

    addClick('btn-open-vip-modal', () => {
        VIP.updateModalState();
        UI.openModal('vip-modal');
    });

    addClick('btn-copy-invite', () => VIP.handleShare(false));
    addClick('btn-wow-copy-link', () => VIP.handleShare(false));
    addClick('btn-vip-copy-invite-locked', () => VIP.handleShare(false));
    addClick('btn-whatsapp-share', () => VIP.handleShare(true));
    addClick('btn-claim-vip-number', () => VIP.claimNumber());

    /* ----------------------------------------------------------------------
       ÖNERGE
    ---------------------------------------------------------------------- */

    addClick('btn-open-proposal-modal', () => {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Sorun bildirmek için önce sisteme katıl.', 'error');
            AUTH.login();
            return;
        }

        UI.openModal('onerge-modal');
    });

    addClick('btn-submit-proposal', () => {
        const titleEl = getEl('input-proposal-title');
        const descEl = getEl('input-proposal-desc');
        const catEl = getEl('input-proposal-category');

        const title = titleEl ? titleEl.value.trim() : '';
        const desc = descEl ? descEl.value.trim() : '';
        const category = catEl ? catEl.value.trim() : '';

        if (!title || !desc || !category) {
            UI.showToast('Lütfen tüm alanları doldurun.', 'error');
            return;
        }

        const ok = STATE.addProposal({ title, desc, category });

        if (!ok) {
            UI.showToast('Önerge kaydedilemedi.', 'error');
            return;
        }

        renderProposals();

        if (titleEl) titleEl.value = '';
        if (descEl) descEl.value = '';
        if (catEl) catEl.value = '';

        UI.closeModal('onerge-modal');
        UI.showToast('Fikrin meclise sunuldu ve destek sırasına alındı.', 'success');
    });
};

/* --------------------------------------------------------------------------
   OYLAMA SİSTEMİ
-------------------------------------------------------------------------- */

const bindVotingEvents = () => {
    document.addEventListener('click', (event) => {
        const voteBtn = event.target.closest('.btn-vote');

        if (voteBtn) {
            if (!STATE.isLoggedIn()) {
                UI.showToast('Oy kullanmak için önce sisteme katıl.', 'error');
                AUTH.login();
                return;
            }

            const card = voteBtn.closest('.poll-card');
            if (!card) return;

            const activeArea = card.querySelector('.poll-active-area');
            const resultArea = card.querySelector('.poll-result-area');

            if (activeArea && resultArea) {
                activeArea.classList.add('hidden');
                resultArea.classList.remove('hidden');
            }

            UI.showToast('Oyun sisteme kaydedildi.', 'success');
            return;
        }

        const changeVoteBtn = event.target.closest('.btn-change-vote');

        if (changeVoteBtn) {
            if (!STATE.isLoggedIn()) return;

            const card = changeVoteBtn.closest('.poll-card');
            if (!card) return;

            const activeArea = card.querySelector('.poll-active-area');
            const resultArea = card.querySelector('.poll-result-area');

            if (activeArea && resultArea) {
                resultArea.classList.add('hidden');
                activeArea.classList.remove('hidden');
            }

            UI.showToast('Oyun sıfırlandı. Yeniden oy kullanabilirsin.', 'success');
        }
    });
};

/* --------------------------------------------------------------------------
   ÇALIŞTIR
-------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    initSystem();
    bindEvents();
    bindVotingEvents();
});