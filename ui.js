/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   Kademeli Profilleme ve Otonom Sandık Uyumlu Sürüm
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

        // =========================================================
        // KİMLİK NUMARASI VE ROZET MOTORU
        // =========================================================
        const idBadge = document.getElementById('ui-role-badge');
        const userIdEl = document.getElementById('ui-user-id');
        
        // Eğer kullanıcının bir numarası varsa (VIP veya Standart fark etmez)
        if (user.userNo && user.userNo !== 'BEKLEYEN') {
            if (userIdEl) userIdEl.textContent = `TR-IA-${user.userNo}`;
            
            if (user.isVip) {
                if (idBadge) {
                    idBadge.textContent = 'VIP KURUCU';
                    idBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos';
                }
            } else {
                if (idBadge) {
                    idBadge.textContent = 'ASİL KURUCU';
                    idBadge.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold';
                }
            }
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
        // YETKİ BUTONLARI VE ONAY BEKLEME EKRANI
        // =========================================================
        const btnPhone = document.getElementById('btn-open-phone-modal');
        const btnPdf = document.getElementById('btn-open-pdf-modal');
        const citySelector = document.getElementById('ui-city-selector-container'); 

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

        if (user.authStage === 'document_pending') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
            if (btnPhone && btnPhone.parentElement) {
                insertPhoneSuccessAlert(btnPhone);
                insertPendingAlert(btnPhone);
            }
        } 
        else if (user.authStage === 'pdf_verified') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
            if (btnPhone && btnPhone.parentElement) {
                insertPhoneSuccessAlert(btnPhone);
                insertPdfSuccessAlert(btnPhone); 
            }
        } 
        else if (user.authStage === 'phone_verified') {
            if (btnPhone) btnPhone.classList.add('hidden');
            if (btnPdf) {
                btnPdf.classList.remove('hidden');
                insertPhoneSuccessAlert(btnPdf);
            }
        } 
        else {
            if (btnPhone) btnPhone.classList.remove('hidden');
            if (btnPdf) btnPdf.classList.add('hidden');
        }
    },

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
    },

    // =========================================================
    // İKİLİ EKRAN MOTORU (MECLİS VE GÜNDEM SIRASI)
    // =========================================================
    renderProposals: (onergeler) => {
        // İki farklı kasayı bul (Meclis ve Gündem Sırası)
        const meclisContainer = document.getElementById('proposals-container');
        const gundemContainer = document.getElementById('gundem-container'); 

        if (meclisContainer) meclisContainer.innerHTML = ''; 
        if (gundemContainer) gundemContainer.innerHTML = '';

        let meclisBos = true;
        let gundemBos = true;

        if (!onergeler || onergeler.length === 0) {
            if (meclisContainer) meclisContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Henüz oylama yeterliliği (50 destek) için bekleyen bir önerge yok.</p>';
            if (gundemContainer) gundemContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Gündem sırasında bekleyen önerge bulunmuyor.</p>';
            return;
        }

        onergeler.forEach(onerge => {
            let kitleMetni = 'Herkes (Öğrenci + Mezun)';
            let kitleIkon = 'fa-globe';
            if (onerge.hedef_kitle === 'icmimar') { kitleMetni = 'Sadece İçmimarlık Mezunları'; kitleIkon = 'fa-lock'; }
            if (onerge.hedef_kitle === 'ogrenci') { kitleMetni = 'Sadece İçmimarlık Öğrencileri'; kitleIkon = 'fa-lock'; }

            const destekSayisi = onerge.destek_sayisi || 0;
            const isKotaDoldu = destekSayisi >= 50;

            if (isKotaDoldu) {
                // ====================================================
                // KOTASI DOLANLAR GÜNDEM SIRASINA GİDER (YUKARI LOCA)
                // ====================================================
                gundemBos = false;
                if (gundemContainer) {
                    const div = document.createElement('div');
                    // Yukarıdaki tasarım: Altında mavi çizgi yok, Destekle butonu yok, sadece yeşil şerit var
                    div.className = 'bg-black/40 border border-slate-600 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg';
                    
                    div.innerHTML = `
                        <div class="absolute left-0 bottom-0 h-1 bg-green-500 w-full shadow-[0_0_10px_#22c55e]"></div>
                        
                        <div class="flex-grow z-10 pr-4">
                            <div class="flex items-center gap-3 mb-3 flex-wrap">
                                <span class="text-[10px] bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 font-bold uppercase tracking-widest whitespace-nowrap"><i class="fas ${kitleIkon} text-gray-400 mr-1"></i> ${kitleMetni}</span>
                                <span class="text-[10px] text-green-400 font-bold uppercase tracking-widest whitespace-nowrap">Süre: ${onerge.sure} Hafta</span>
                            </div>
                            <h4 class="text-base md:text-lg font-black text-white leading-tight">${onerge.baslik}</h4>
                        </div>
                        
                        <div class="flex flex-col md:items-end shrink-0 z-10 mt-4 md:mt-0">
                            <div class="text-center md:text-right whitespace-nowrap bg-slate-900/80 px-5 py-3 rounded-xl border border-green-900/50 w-full">
                                <div class="text-sm font-black text-green-400 mb-1">✅ ${destekSayisi}/50 Destek</div>
                                <div class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">SALI 20:26'YI BEKLİYOR</div>
                            </div>
                        </div>
                    `;
                    gundemContainer.appendChild(div);
                }
            } else {
                // ====================================================
                // 50'NİN ALTINDAKİLER MECLİSTE KALIR (AŞAĞI LOCA)
                // ====================================================
                meclisBos = false;
                if (meclisContainer) {
                    const yuzde = Math.min((destekSayisi / 50) * 100, 100);
                    const div = document.createElement('div');
                    div.className = 'bg-black/40 border border-slate-600 p-5 md:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-500 transition relative overflow-hidden';
                    
                    div.innerHTML = `
                        <div class="absolute left-0 bottom-0 h-1 bg-kaos transition-all duration-1000 shadow-[0_0_10px_currentColor]" style="width: ${yuzde}%"></div>
                        
                        <div class="flex-grow z-10 w-full md:w-auto pr-4">
                            <div class="flex items-center gap-3 mb-3 flex-wrap">
                                <span class="text-[10px] bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 font-bold uppercase tracking-widest whitespace-nowrap"><i class="fas ${kitleIkon} text-gray-400 mr-1"></i> ${kitleMetni}</span>
                                <span class="text-[10px] text-kaos font-bold uppercase tracking-widest whitespace-nowrap">Süre: ${onerge.sure} Hafta</span>
                            </div>
                            <h4 class="text-base md:text-lg font-black text-white mb-2 leading-tight">${onerge.baslik}</h4>
                            <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-3 md:mb-0">${onerge.sorun}</p>
                        </div>
                        
                        <div class="flex flex-col md:items-end w-full md:w-auto shrink-0 z-10 gap-3 mt-4 md:mt-0">
                            <div class="text-center md:text-right whitespace-nowrap bg-slate-900/80 px-5 py-3 rounded-xl border border-slate-700 w-full">
                                <div class="text-sm font-black text-green-400 mb-1">✅ ${destekSayisi} / 50 Destek</div>
                                <div class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Hedef Kotası</div>
                            </div>
                            <button data-id="${onerge.id}" class="btn-destekle w-full bg-slate-800 hover:bg-slate-700 border border-slate-500 px-5 py-3.5 rounded-xl text-white font-black text-[11px] transition uppercase tracking-widest flex justify-center items-center gap-2 shadow-md">
                                <i class="fas fa-arrow-up text-kaos"></i> DESTEKLE
                            </button>
                        </div>
                    `;
                    meclisContainer.appendChild(div);
                }
            }
        });

        if (meclisBos && meclisContainer) meclisContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Henüz oylama yeterliliği (50 destek) için bekleyen bir önerge yok.</p>';
        if (gundemBos && gundemContainer) gundemContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Gündem sırasında bekleyen önerge bulunmuyor.</p>';
    }
};
