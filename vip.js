/* ==========================================================================
   ME26 AĞI - VIP VE PRESTİJ YÖNETİCİSİ (vip.js)
   ========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

let selectedVipNumber = null;

export const VIP = {
    updateModalState: () => {
        const user = STATE.getUser();
        const lockedState = document.getElementById('vip-locked-state');
        const unlockedState = document.getElementById('vip-unlocked-state');

        if (!lockedState || !unlockedState) return;

        if (user.inviteCount >= ME26_CONFIG.requiredInvitesForVip) {
            lockedState.classList.add('hidden');
            unlockedState.classList.remove('hidden');
            VIP.renderGrid();
        } else {
            unlockedState.classList.add('hidden');
            lockedState.classList.remove('hidden');
        }
    },

    renderGrid: () => {
        const grid = document.getElementById('ui-vip-grid');
        const claimBtn = document.getElementById('btn-claim-vip-number');

        if (!grid || grid.children.length > 0) return;

        grid.innerHTML = '';
        selectedVipNumber = null;

        if (claimBtn) claimBtn.disabled = true;

        const sampleNumbers = [
            101, 102, 111, 200,
            222, 500, 777, 999,
            1000, 1071, 1453, 1923,
            2026, 3000, 4444, 5000
        ];

        sampleNumbers.forEach((num) => {
            const btn = document.createElement('button');

            btn.type = 'button';
            btn.className = 'vip-num-btn bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-mono text-sm font-black hover:border-kaos hover:text-kaos transition-all';
            btn.textContent = `#${num}`;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.vip-num-btn').forEach((button) => {
                    button.classList.remove('bg-kaos', 'text-slate-900', 'border-kaos');
                    button.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
                });

                btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
                btn.classList.add('bg-kaos', 'text-slate-900', 'border-kaos');

                selectedVipNumber = num;

                if (claimBtn) claimBtn.disabled = false;
            });

            grid.appendChild(btn);
        });
    },

    fallbackCopy: (text) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (error) {
            console.error('Fallback kopyalama başarısız:', error);
        }

        document.body.removeChild(textArea);
    },

    handleShare: async (isWhatsApp = false) => {
        const inviteLink = 'https://me26.org/katil';

        try {
            if (isWhatsApp) {
                const message = encodeURIComponent(`ME26 dijital stadyumu'na sen de katıl: ${inviteLink}`);
                window.open(`https://wa.me/?text=${message}`, '_blank');
            } else if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(inviteLink);
            } else {
                VIP.fallbackCopy(inviteLink);
            }

            const currentCount = STATE.incrementInviteCount();

            UI.renderProfile();
            VIP.updateModalState();

            if (isWhatsApp) {
                UI.showToast("WhatsApp'a yönlendiriliyor...", 'success');
            } else {
                UI.showToast('Paylaşım bağlantısı kopyalandı.', 'success');
            }

            if (currentCount === ME26_CONFIG.requiredInvitesForVip) {
                UI.showToast('Tebrikler! VIP Kurucu No ekranı açıldı 💎', 'success');
            } else if (currentCount < ME26_CONFIG.requiredInvitesForVip) {
                UI.showToast('Paylaşım ilerlemesi kaydedildi.', 'success');
            }
        } catch (error) {
            console.error('Paylaşım hatası:', error);
            VIP.fallbackCopy(inviteLink);
            UI.showToast('Bağlantı kopyalandı.', 'success');
        }
    },

    claimNumber: () => {
        if (!selectedVipNumber) {
            UI.showToast('Lütfen önce bir VIP Kurucu No seç.', 'error');
            return;
        }

        STATE.setVipNumber(selectedVipNumber);
        UI.closeModal('vip-modal');
        UI.renderProfile();

        UI.showToast(`Tebrikler! VIP Kurucu Numaran #${selectedVipNumber} olarak kaydedildi.`, 'success');
    }
};