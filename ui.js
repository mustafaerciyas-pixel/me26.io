/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   Kademeli Profilleme (Progressive Onboarding) Uyumlu Sürüm
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
        const isInfo = type === 'info';
        
        let bgColor = isSuccess ? 'bg-green-900/90 text-green-400 border-green-700' : 
                      isInfo ? 'bg-blue-900/90 text-blue-400 border-blue-700' : 
                      'bg-red-900/90 text-red-400 border-red-700';
                      
        let icon = isSuccess ? '✅' : isInfo ? 'ℹ️' : '❌';

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-xs font-bold uppercase tracking-widest transform transition-all duration-500 translate-y-10 opacity-0 border ${bgColor}`;
        
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
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

        // GÖREV 1 KONTROLÜ: Şehir seçilmiş mi?
        const isCitySelected = user.city && user.city !== 'Seçilmedi' && user.city !== 'Belirsiz';
        
        setEl('ui-user-city', isCitySelected ? user.city : 'TRİBÜN SEÇİLMEDİ');
        
        // E-Devlet Yüklenmediyse Rolü "Kimlik Bekleniyor" Göster
        const displayRole = (user.role === 'Belirsiz' || !user.role) ? 'Kimlik Bekleniyor' : user.role;
        setEl('ui-user-role', displayRole);
        
        setEl('ui-vote-power', user.votePower || '0.0x');

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

        // =========================================================
        // YETKİ BUTONLARI VE ONAY BEKLEME EKRANI (GÖREVLER)
        // =========================================================
        const btnPhone = document.getElementById('btn-open-phone-modal');
        const btnPdf = document.getElementById('btn-open-pdf-modal');
        const citySelector = document.getElementById('ui-city-selector-container'); // Yeni eklenecek HTML

        // Şehir seçimi UI Kontrolü
        if (citySelector) {
            if (!isCitySelected) {
                citySelector.classList.remove('hidden');
            } else {
                citySelector.classList.add('hidden');
            }
        }

        document.getElementById('ui-pending-alert')?.remove();
        document.getElementById('ui-phone-success-alert')?.remove();
        document.getElementById('ui-pdf-success-alert')?.remove();

        const insertPhoneSuccessAlert = (referenceElement) => {
            const alertDiv = document.createElement('div');
            alertDiv.id = 'ui-phone-success-alert';
            alertDiv.className = 'w-full bg-green-900/20 border border-green-700/50 text-green-400 text-[10px] md:text-xs text-center py-2 rounded uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-2';
            alertDiv.innerHTML = '<span>✅</span> TELEFON DOĞRULANDI (BOT KONTROLÜ)';
            referenceElement.parentElement.insertBefore(alertDiv, referenceElement);
        };

        const insertPdfSuccessAlert = (referenceElement) => {
            const alertDiv = document.createElement('div');
            alertDiv.id = 'ui-pdf-success-alert';
            alertDiv.className = 'w-full bg-indigo-900/20 border border-indigo-700/50 text-indigo-400 text-[10px] md:text-xs text-center py-2 rounded uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-2';
            alertDiv.innerHTML = '<span>🎓</span> E-DEVLET KİMLİĞİ ONAYLANDI';
            referenceElement.parentElement.insertBefore(alertDiv, referenceElement);
        };

        const insertPendingAlert = (referenceElement) => {
            const alertDiv = document.createElement('div');
            alertDiv.id = 'ui-pending-alert';
            alertDiv.className = 'w-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-[10px] md:text-xs text-center py-3 rounded uppercase tracking-widest font-bold flex items-center justify-center gap-2';
            alertDiv.innerHTML = '<span>⏳</span> KİMLİĞİNİZ YÖNETİCİ ONAYINDA BEKLİYOR';
            referenceElement.parentElement.insertBefore(alertDiv, referenceElement);
        };

        // DURUM 1: Belge yüklendi, Yönetici onayı bekliyor
        if (user.authStage === 'document_pending') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
            
            if (btnPhone && btnPhone.parentElement) {
                insertPhoneSuccessAlert(btnPhone);
                insertPendingAlert(btnPhone);
            }
        } 
        // DURUM 2: Her şey tam, VIP veya PDF onaylandı
        else if (user.authStage === 'pdf_verified') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
            
            if (btnPhone && btnPhone.parentElement) {
                insertPhoneSuccessAlert(btnPhone);
                insertPdfSuccessAlert(btnPhone); 
            }
        } 
        // DURUM 3: Sadece telefon onaylı, PDF yüklemesi bekleniyor
        else if (user.authStage === 'phone_verified') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) {
                btnPdf.classList.remove('hidden');
                insertPhoneSuccessAlert(btnPdf);
            }
        } 
        // DURUM 4: Sadece kayıt oldu, telefon onayı bekleniyor
        else {
            if (btnPhone) btnPhone.classList.remove('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
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

        for (let i = 101; i <= 1000; i++) {
            const btn = document.createElement('button');
            btn.className = 'vip-number-btn bg-slate-800 border border-slate-700 text-gray-400 font-mono text-[10px] md:text-xs py-2 rounded hover:border-kaos hover:text-kaos transition';
            btn.textContent = i;
            
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
