/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   VIP Kurucu Grid Sistemi Entegre Edilmiş Sürüm
   ========================================================================== */

import { STATE } from './state.js';

export const UI = {
    // Sayfa Görünümlerini Değiştirme (Landing <-> Voting)
    showView: (viewId) => {
        document.getElementById('landing-view').classList.add('hidden');
        document.getElementById('voting-view').classList.add('hidden');
        document.getElementById('manifesto')?.classList.add('hidden');
        document.getElementById('sticky-cta')?.classList.add('hidden');
        document.getElementById('ana-footer')?.classList.add('hidden');

        if (viewId === 'landing') {
            document.getElementById('landing-view').classList.remove('hidden');
            document.getElementById('manifesto')?.classList.remove('hidden');
            document.getElementById('sticky-cta')?.classList.remove('hidden');
            document.getElementById('ana-footer')?.classList.remove('hidden');
        } else if (viewId === 'voting') {
            document.getElementById('voting-view').classList.remove('hidden');
        }
    },

    // Modalları Açıp Kapatma
    openModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // Çekmece ve Menüler
    toggleMobileMenu: (show) => {
        const menu = document.getElementById('mobile-menu');
        if (!menu) return;
        if (show) {
            menu.classList.remove('-translate-x-full');
        } else {
            menu.classList.add('-translate-x-full');
        }
    },

    toggleProfileDrawer: (show) => {
        const drawer = document.getElementById('profile-drawer');
        if (!drawer) return;
        if (show) {
            drawer.classList.remove('translate-x-full');
        } else {
            drawer.classList.add('translate-x-full');
        }
    },

    // Bildirim (Toast) Mesajları
    showToast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        const isSuccess = type === 'success';
        toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-xs font-bold uppercase tracking-widest transform transition-all duration-500 translate-y-10 opacity-0 ${
            isSuccess ? 'bg-green-900/90 text-green-400 border border-green-700' : 'bg-red-900/90 text-red-400 border border-red-700'
        }`;
        
        toast.innerHTML = `<span>${isSuccess ? '✅' : '❌'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // Profili Ekrana Çizme (Verileri HTML'e Basma)
    renderProfile: () => {
        if (!STATE.isLoggedIn()) return;

        const user = STATE.user;
        
        const setEl = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        // Temel Bilgiler
        setEl('ui-user-city', user.city);
        setEl('ui-user-role', user.role);
        setEl('ui-vote-power', user.votePower);

        // Kimlik Numarası ve Rozet
        const idBadge = document.getElementById('ui-role-badge');
        const userIdEl = document.getElementById('ui-user-id');
        
        if (user.isVip) {
            if (idBadge) {
                idBadge.textContent = 'VIP KURUCU';
                idBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos';
            }
            if (userIdEl) userIdEl.textContent = `TR-IA-${user.userNo}`;
        } else {
            if (idBadge) {
                idBadge.textContent = 'Aday Kurucu';
                idBadge.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold';
            }
            if (userIdEl) userIdEl.textContent = 'TR-IA-BEKLEYEN';
        }

        // Paylaşım ve VIP Barı
        const inviteCount = user.inviteCount || 0;
        setEl('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);
        
        const progressBar = document.getElementById('ui-vip-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${Math.min((inviteCount / 3) * 100, 100)}%`;
        }

        const vipStatus = document.getElementById('ui-vip-status');
        if (vipStatus) {
            if (user.isVip) {
                vipStatus.textContent = 'VIP AKTİF';
                vipStatus.className = 'text-[9px] text-slate-900 font-black bg-kaos px-2 py-1 rounded border border-kaos shadow-kaos';
            } else if (inviteCount >= 3) {
                vipStatus.textContent = 'KİLİT AÇILDI';
                vipStatus.className = 'text-[9px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-700';
            } else {
                vipStatus.textContent = 'KİLİTLİ';
                vipStatus.className = 'text-[9px] text-gray-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700';
            }
        }

        // Yetki Butonlarını Gizle/Göster
        const btnPhone = document.getElementById('btn-open-phone-modal');
        const btnPdf = document.getElementById('btn-open-pdf-modal');

        if (user.authStage === 'phone_verified' || user.authStage === 'pdf_verified') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) btnPdf.classList.remove('hidden'); // Telefon onaylandıysa PDF açılır
        } else {
            if (btnPhone) btnPhone.classList.remove('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
        }

        if (user.authStage === 'pdf_verified' && btnPdf) {
            btnPdf.classList.add('hidden'); // PDF de yüklendiyse butonu sakla
        }
    },

    // =========================================================
    // VIP KURUCU NUMARA MOTORU
    // =========================================================
    
    updateVipModalState: () => {
        const lockedState = document.getElementById('vip-locked-state');
        const unlockedState = document.getElementById('vip-unlocked-state');
        const inviteCount = STATE.user?.inviteCount || 0;

        if (inviteCount >= 3 || STATE.user?.isVip) {
            lockedState.classList.add('hidden');
            unlockedState.classList.remove('hidden');
            UI.renderVipGrid();
        } else {
            lockedState.classList.remove('hidden');
            unlockedState.classList.add('hidden');
        }
    },

    renderVipGrid: () => {
        const gridEl = document.getElementById('ui-vip-grid');
        if (!gridEl) return;
        gridEl.innerHTML = '';

        // 101 ile 1000 arasını çiz
        for (let i = 101; i <= 1000; i++) {
            const btn = document.createElement('button');
            btn.className = 'vip-number-btn bg-slate-800 border border-slate-700 text-gray-400 font-mono text-[10px] md:text-xs py-2 rounded hover:border-kaos hover:text-kaos transition';
            btn.textContent = i;
            
            // Rastgele dolu numaralar (Gerçekçilik için)
            if (i === 105 || i === 199 || i === 206 || i === 333 || i === 404 || i === 500) {
                btn.classList.add('opacity-30', 'cursor-not-allowed', 'bg-red-900/20', 'border-red-900/50', 'text-red-500');
                btn.disabled = true;
            } else {
                btn.onclick = () => UI.selectVipNumber(i, btn);
            }
            gridEl.appendChild(btn);
        }
    },

    selectVipNumber: (num, btnEl) => {
        document.querySelectorAll('.vip-number-btn').forEach(b => {
            b.classList.remove('bg-kaos', 'text-slate-900', 'font-black', 'border-kaos');
            if(!b.disabled) b.classList.add('bg-slate-800', 'text-gray-400');
        });
        
        btnEl.classList.remove('bg-slate-800', 'text-gray-400');
        btnEl.classList.add('bg-kaos', 'text-slate-900', 'font-black', 'border-kaos');

        const claimBtn = document.getElementById('btn-claim-vip-number');
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.dataset.selectedNumber = num;
            claimBtn.textContent = num + ' NUMARAYI KİLİTLE';
        }
    }
};
