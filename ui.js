/* ==========================================================================
   ME26 AĞI - ARAYÜZ (UI) VE DOM YÖNETİCİSİ (ui.js)
   ========================================================================== */

import { STATE } from './state.js';
import { ME26_CONFIG } from './config.js';

// DOM Seçici Yardımcısı
const getEl = (id) => document.getElementById(id);

export const UI = {
    
    // 1. Ekran Bildirimleri (Toast)
    showToast: (message, type = 'success') => {
        const container = getEl('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        
        // Başarı veya Hata renkleri
        const bgColor = type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90';
        const borderColor = type === 'success' ? 'border-green-400' : 'border-red-400';
        const icon = type === 'success' ? '✅' : '❌';

        toast.className = `${bgColor} border ${borderColor} text-white px-5 py-3 rounded-xl shadow-lg font-bold text-sm flex items-center gap-3 toast-in backdrop-blur-md z-[99999]`;
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

        container.appendChild(toast);

        // 3 saniye sonra kaybolma animasyonu
        setTimeout(() => {
            toast.classList.remove('toast-in');
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 500); // Animasyon bitmesini bekle
        }, 3000);
    },

    // 2. Modalları Aç
    openModal: (id) => {
        const modal = getEl(id);
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    },

    // 3. Modalları Kapat
    closeModal: (id) => {
        const modal = getEl(id);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    // 4. Mobil Menüyü Aç/Kapat
    toggleMobileMenu: (forceShow = false) => {
        const menu = getEl('mobile-menu');
        if (!menu) return;
        if (forceShow) {
            menu.classList.remove('-translate-x-full');
        } else {
            menu.classList.add('-translate-x-full');
        }
    },

    // 5. Sağ Profil Çekmecesini Aç/Kapat
    toggleProfileDrawer: (forceShow = false) => {
        const drawer = getEl('profile-drawer');
        if (!drawer) return;
        if (forceShow) {
            drawer.classList.remove('translate-x-full');
        } else {
            drawer.classList.add('translate-x-full');
        }
    },

    // 6. SPA Sayfa Geçişi (Giriş Ekranı <-> Oylama Ekranı)
    showView: (viewName) => {
        const landing = getEl('landing-view');
        const voting = getEl('voting-view');
        const stickyCta = getEl('sticky-cta');
        
        if (viewName === 'landing') {
            if (landing) { landing.classList.remove('hidden'); landing.classList.add('flex'); }
            if (voting) { voting.classList.add('hidden'); voting.classList.remove('flex'); }
            if (stickyCta) stickyCta.classList.remove('hidden');
        } else if (viewName === 'voting') {
            if (landing) { landing.classList.add('hidden'); landing.classList.remove('flex'); }
            if (voting) { voting.classList.remove('hidden'); voting.classList.add('flex'); }
            if (stickyCta) stickyCta.classList.add('hidden');
        }
    },

    // 7. Profil ve Arayüzü Kullanıcı Verisine Göre Güncelle (Canlı Veri Render)
    renderProfile: () => {
        const user = STATE.getUser();

        // A. Kimlik Kartı Metinleri
        const idEl = getEl('ui-user-id');
        const roleEl = getEl('ui-user-role');
        const cityEl = getEl('ui-user-city');
        const powerEl = getEl('ui-vote-power');
        const badgeEl = getEl('ui-role-badge');
        
        if (idEl) idEl.textContent = `TR-IA-${user.userNo !== "BEKLEYEN" ? user.userNo : "???"}`;
        if (roleEl) roleEl.textContent = user.role;
        if (cityEl) cityEl.textContent = user.city;
        if (powerEl) powerEl.textContent = user.votePower;

        // B. Yetki Rozeti (Badge)
        if (badgeEl) {
            if (STATE.isFullyVerified()) {
                badgeEl.textContent = 'Tam Yetkili';
                badgeEl.className = 'bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded text-[8px]';
            } else if (STATE.isPhoneVerified()) {
                badgeEl.textContent = 'Telefon Onaylı';
                badgeEl.className = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px]';
            } else {
                badgeEl.textContent = 'Onay Bekliyor';
                badgeEl.className = 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px]';
            }
        }

        // C. VIP İlerleme Barı
        const vipStatusEl = getEl('ui-vip-status');
        const vipProgressEl = getEl('ui-vip-progress-bar');
        const vipCountEl = getEl('ui-vip-invite-count');
        
        const required = ME26_CONFIG.requiredInvitesForVip || 3;
        const currentCount = Math.min(user.inviteCount, required);
        const progressPercent = (currentCount / required) * 100;

        if (vipProgressEl) vipProgressEl.style.width = `${progressPercent}%`;
        if (vipCountEl) vipCountEl.textContent = `${currentCount} / ${required} Paylaşım`;

        if (vipStatusEl) {
            if (user.isVip) {
                vipStatusEl.textContent = 'AKTİF';
                vipStatusEl.className = 'text-[9px] text-black font-bold bg-kaos px-2 py-1 rounded border border-kaos uppercase';
            } else if (currentCount >= required) {
                vipStatusEl.textContent = 'AÇILDI';
                vipStatusEl.className = 'text-[9px] text-green-400 font-bold bg-green-500/20 px-2 py-1 rounded border border-green-500/30 uppercase';
            } else {
                vipStatusEl.textContent = 'KİLİTLİ';
                vipStatusEl.className = 'text-[9px] text-kaos font-bold bg-kaos/10 px-2 py-1 rounded border border-kaos/30 uppercase';
            }
        }

        // D. Dinamik Buton Metinleri (Kullanıcı giriş yaptıysa "Profili Aç" yazar)
        const btnHero = getEl('btn-login-hero');
        const btnSticky = getEl('btn-login-sticky');
        const btnDesktop = getEl('btn-desktop-nav-action');
        const btnMobile = getEl('btn-mobile-nav-action');

        const loginText = STATE.isLoggedIn() ? 'PROFİLİ AÇ' : '1 TIKLA KATIL';
        
        if (btnHero) btnHero.textContent = loginText;
        if (btnSticky) btnSticky.textContent = loginText;
        if (btnDesktop) btnDesktop.textContent = loginText;
        if (btnMobile) btnMobile.textContent = loginText;
        
        // E. Belge Yükleme Butonu Görünürlüğü (Sadece giriş yapıp tam yetkili olmayanlara göster)
        const pdfBtn = getEl('btn-open-pdf-modal');
        if (pdfBtn) {
            if (STATE.isLoggedIn() && !STATE.isFullyVerified()) {
                pdfBtn.classList.remove('hidden');
            } else {
                pdfBtn.classList.add('hidden');
            }
        }
    }
};
