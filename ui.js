/* ==========================================================================
   ME26 AĞI - ARAYÜZ VE GÖRSEL MOTOR (ui.js)
   SaaS Paneli ve Sekme Yönlendirme Uyumlu Sürüm
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

    // 2. YENİ SAAS SEKMELERİ ARASI GEÇİŞ (Lobi, Sandık, Kürsü, Profil)
    switchSaasTab: (targetId) => {
        // Tüm odaları gizle
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('block');
        });
        
        // Hedef odayı aç
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }

        // Sol ve Alt menüdeki butonların renklerini ayarla (Aktif yap)
        document.querySelectorAll('.nav-menu-btn').forEach(btn => {
            btn.classList.remove('active', 'bg-slate-800', 'text-white');
            btn.classList.add('text-gray-400');
        });

        document.querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`).forEach(btn => {
            btn.classList.add('active', 'bg-slate-800', 'text-white');
            btn.classList.remove('text-gray-400');
        });
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

        setTimeout(() => toast.classList.remove('translate-y-10', 'opacity-0'), 10);
        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    },

    // Profili Ekrana Çizme (Hem Sol Menüye Hem Ayarlar Ekranına)
    renderProfile: () => {
        if (!STATE.isLoggedIn()) return;

        const user = STATE.user;
        
        const setEl = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        const isCitySelected = user.city && user.city !== 'Seçilmedi' && user.city !== 'Belirsiz';
        const displayRole = (user.role === 'Belirsiz' || !user.role) ? 'Kimlik Bekleniyor' : user.role;
        const displayPower = user.votePower || '0.0x';
        
        // Ana Profil Ekranı Güncellemeleri
        setEl('ui-user-city', isCitySelected ? user.city : 'TRİBÜN SEÇİLMEDİ');
        setEl('ui-user-role', displayRole);
        setEl('ui-vote-power', displayPower);
        
        // SAAS Menü (Sidebar ve Alt Bar) Güncellemeleri
        setEl('sidebar-user-role', displayRole);
        setEl('sidebar-vote-power', displayPower);

        let userIdText = 'TR-IA-BEKLEYEN';
        if (user.userNo && user.userNo !== 'BEKLEYEN') {
            userIdText = `TR-IA-${user.userNo}`;
        }
        
        setEl('ui-user-id', userIdText);
        setEl('sidebar-user-id', userIdText);
        setEl('mobile-user-id', userIdText);

        const idBadge = document.getElementById('ui-role-badge');
        if (user.userNo && user.userNo !== 'BEKLEYEN') {
            if (user.isVip) {
                if (idBadge) { idBadge.textContent = 'VIP KURUCU'; idBadge.className = 'bg-kaos text-slate-900 border border-kaos px-1.5 py-0.5 rounded text-[9px] font-black shadow-kaos'; }
            } else {
                if (idBadge) { idBadge.textContent = 'ASİL KURUCU'; idBadge.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
            }
        } else {
            if (idBadge) { idBadge.textContent = 'Aday Kurucu'; idBadge.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-bold'; }
        }

        // Görev 1 Kutusunu Kontrol Et
        const citySelectors = document.querySelectorAll('#ui-city-selector-container');
        citySelectors.forEach(el => {
            if (!isCitySelected) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });

        // Paylaşım ve VIP Barı
        const inviteCount = user.inviteCount || 0;
        setEl('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);
        const progressBar = document.getElementById('ui-vip-progress-bar');
        if (progressBar) progressBar.style.width = `${Math.min((inviteCount / 3) * 100, 100)}%`;

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
    },

    // Önergeleri Ekrana Basma
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
