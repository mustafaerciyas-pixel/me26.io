/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   Akıllı Profil ve Terfi Motoru Entegre Edilmiş Sürüm
   ========================================================================== */

import { STATE } from './state.js';

export const UI = {
    // 1. ANA EKRAN GEÇİŞİ (DIŞ KAPI <-> İÇ PANEL)
    showView: (viewId) => {
        const landing = document.getElementById('landing-view');
        const saas = document.getElementById('saas-view');
        
        if (landing) landing.classList.add('hidden');
        if (saas) { saas.classList.add('hidden'); saas.classList.remove('flex'); }

        if (viewId === 'landing') {
            if (landing) landing.classList.remove('hidden');
        } else if (viewId === 'saas') {
            if (saas) {
                saas.classList.remove('hidden');
                saas.classList.add('flex');
            }
        }
    },

    // 2. SAAS SEKMELERİ ARASI GEÇİŞ
    switchSaasTab: (targetId) => {
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('block');
        });
        
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }

        document.querySelectorAll('.nav-menu-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
            btn.classList.add('text-gray-400');
        });

        document.querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`).forEach(btn => {
            btn.classList.add('active', 'bg-slate-800', 'text-white');
            btn.classList.remove('text-gray-400');
        });
    },

    // 3. PENCERELER (MODALLAR)
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

    // 4. BİLDİRİM (TOAST) MESAJLARI
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

        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // 5. AKILLI PROFİL MOTORU
    renderProfile: () => {
        if (!STATE.isLoggedIn()) return;

        const user = STATE.user;
        const setEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

        // --- TEMEL BİLGİLER ---
        const isCitySelected = user.city && user.city !== 'Seçilmedi' && user.city !== 'Belirsiz';
        const displayRole = (user.role === 'Belirsiz' || !user.role) ? 'Kimlik Bekleniyor' : user.role;
        const displayPower = user.votePower || '0.0x';
        
        setEl('ui-user-city', isCitySelected ? user.city : 'TRİBÜN SEÇİLMEDİ');
        setEl('ui-user-role', displayRole);
        setEl('ui-vote-power', displayPower);
        setEl('sidebar-user-role', displayRole);
        setEl('sidebar-vote-power', displayPower);

        let userIdText = 'TR-IA-BEKLEYEN';
        const numaraAlinmisMi = user.userNo && user.userNo !== 'BEKLEYEN';
        if (numaraAlinmisMi) userIdText = `TR-IA-${user.userNo}`;
        
        setEl('ui-user-id', userIdText);
        setEl('sidebar-user-id', userIdText);
        setEl('mobile-user-id', userIdText);

        const idBadge = document.getElementById('ui-role-badge');
        if (numaraAlinmisMi) {
            if (user.isVip) {
                if (idBadge) { idBadge.textContent = 'VIP KURUCU'; idBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos'; }
            } else {
                if (idBadge) { idBadge.textContent = 'ASİL KURUCU'; idBadge.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
            }
        } else {
            if (idBadge) { idBadge.textContent = 'Aday Kurucu'; idBadge.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
        }

        // --- SAĞ PANEL (AĞI BÜYÜT & VIP) MANTIĞI ---
        const inviteCount = user.inviteCount || 0;
        setEl('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);
        const progressBar = document.getElementById('ui-vip-progress-bar');
        if (progressBar) progressBar.style.width = `${Math.min((inviteCount / 3) * 100, 100)}%`;

        const btnVipModal = document.getElementById('btn-open-vip-modal');
        const btnStandartNum = document.getElementById('btn-standart-numara');
        const vipStatus = document.getElementById('ui-vip-status');

        if (numaraAlinmisMi) {
            // Numara alındıysa butonları yok et, sadece "Ağı Büyüt" kalsın
            if (btnVipModal) btnVipModal.classList.add('hidden');
            if (btnStandartNum) btnStandartNum.classList.add('hidden');
            if (vipStatus) {
                vipStatus.textContent = 'SİSTEM ELÇİSİ';
                vipStatus.className = 'text-[9px] text-slate-900 font-black bg-kaos px-2 py-1 rounded border border-kaos shadow-kaos';
            }
        } else {
            // Numara alınmadıysa butonlar görünsün
            if (btnVipModal) btnVipModal.classList.remove('hidden');
            if (btnStandartNum) btnStandartNum.classList.remove('hidden');
            if (vipStatus) {
                if (inviteCount >= 3) {
                    vipStatus.textContent = 'KİLİT AÇILDI';
                    vipStatus.className = 'text-[9px] text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-700';
                } else {
                    vipStatus.textContent = 'KİLİTLİ';
                    vipStatus.className = 'text-[9px] text-gray-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700';
                }
            }
        }

        // --- SOL PANEL (GÖREVLER VE TERFİ) MANTIĞI ---
        const btnPhone = document.getElementById('btn-open-phone-modal');
        const btnPdf = document.getElementById('btn-open-pdf-modal');
        const taskContainer = btnPhone ? btnPhone.parentElement : null;

        // Eski dinamik rozetleri temizle (Sayfa yenilendiğinde üst üste binmesin)
        document.querySelectorAll('.dynamic-task-badge').forEach(el => el.remove());

        const addBadge = (html, extraClass = '') => {
            if (!taskContainer) return;
            const badge = document.createElement('div');
            badge.className = `dynamic-task-badge w-full py-3 rounded-lg text-[10px] md:text-xs text-center uppercase tracking-widest font-bold flex items-center justify-center gap-2 mb-2 border ${extraClass}`;
            badge.innerHTML = html;
            taskContainer.insertBefore(badge, taskContainer.firstChild);
        };

        // Telefon Görevi
        if (user.hasPhone) {
            if (btnPhone) btnPhone.classList.add('hidden');
            addBadge('<span>✅</span> TELEFON DOĞRULANDI (BOT KONTROLÜ)', 'bg-green-900/20 border-green-700/50 text-green-400');
        } else {
            if (btnPhone) btnPhone.classList.remove('hidden');
        }

        // E-Devlet Görevi ve Mezuniyet Terfisi
        if (user.authStage === 'pdf_verified') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('<span>🎓</span> E-DEVLET ONAYLI (1.0x TAM YETKİ)', 'bg-indigo-900/20 border-indigo-700/50 text-indigo-400');
            
            // Eğer Öğrenciyse "Unvan Güncelle" butonunu çıkar
            if (user.role && user.role.toLowerCase().includes('öğrenci')) {
                const terfiBtn = document.createElement('button');
                terfiBtn.className = 'dynamic-task-badge w-full bg-kaos text-slate-900 hover:opacity-90 font-black py-3 rounded-lg text-[11px] uppercase tracking-widest transition shadow-md flex items-center justify-center gap-2 mt-2';
                terfiBtn.innerHTML = '<i class="fas fa-graduation-cap text-lg"></i> Mezun Oldun Mu? Unvanını Güncelle';
                terfiBtn.onclick = () => UI.openModal('pdf-modal');
                if (taskContainer) taskContainer.appendChild(terfiBtn);
            }

        } else if (user.authStage === 'document_pending') {
            if (btnPdf) btnPdf.classList.add('hidden');
            addBadge('<span>⏳</span> YÖNETİCİ ONAYI BEKLENİYOR', 'bg-yellow-900/20 border-yellow-700/50 text-yellow-500');
        } else {
            if (btnPdf) btnPdf.classList.remove('hidden');
        }

        // Şehir (Tribün) Görevi
        const citySelectors = document.querySelectorAll('#ui-city-selector-container');
        citySelectors.forEach(el => {
            if (!isCitySelected) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
    },

    // 6. ÖNERGELERİ EKRANA BASMA
    renderProposals: (onergeler) => {
        const meclisContainer = document.getElementById('proposals-container');
        const gundemContainer = document.getElementById('gundem-container'); 

        if (meclisContainer) meclisContainer.innerHTML = ''; 
        if (gundemContainer) gundemContainer.innerHTML = '';

        if (!onergeler || onergeler.length === 0) {
            if (meclisContainer) meclisContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Bekleyen önerge yok.</p>';
            if (gundemContainer) gundemContainer.innerHTML = '<p class="text-center text-sm text-gray-500 font-medium py-8 border border-dashed border-slate-700 rounded-xl">Sırada önerge yok.</p>';
            return;
        }

        onergeler.forEach(onerge => {
            const isKotaDoldu = (onerge.destek_sayisi || 0) >= 50;
            const container = isKotaDoldu ? gundemContainer : meclisContainer;
            if(!container) return;

            const yuzde = Math.min(((onerge.destek_sayisi || 0) / 50) * 100, 100);
            const div = document.createElement('div');
            div.className = 'bg-black/40 border border-slate-600 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-lg mb-3';
            
            div.innerHTML = `
                <div class="absolute left-0 bottom-0 h-1 ${isKotaDoldu ? 'bg-green-500' : 'bg-kaos'}" style="width: ${yuzde}%"></div>
                <div class="flex-grow z-10 w-full pr-4">
                    <h4 class="text-base font-black text-white mb-2 leading-tight">${onerge.baslik}</h4>
                    ${!isKotaDoldu ? `<p class="text-xs text-gray-400 line-clamp-2">${onerge.sorun}</p>` : ''}
                </div>
                <div class="flex flex-col md:items-end w-full md:w-auto shrink-0 z-10 gap-2">
                    <div class="text-center md:text-right bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 w-full">
                        <div class="text-sm font-black ${isKotaDoldu ? 'text-green-400' : 'text-kaos'}">✅ ${onerge.destek_sayisi || 0}/50</div>
                    </div>
                    ${!isKotaDoldu ? `<button data-id="${onerge.id}" class="btn-destekle w-full bg-slate-800 border border-slate-500 px-4 py-2 rounded-xl text-white font-black text-[11px] transition uppercase flex justify-center items-center gap-2"><i class="fas fa-arrow-up text-kaos"></i> DESTEKLE</button>` : ''}
                </div>
            `;
            container.appendChild(div);
        });
    }
};
