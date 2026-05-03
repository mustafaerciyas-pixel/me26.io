/* ==========================================================================
   ME26 AĞI - VIP VE PRESTİJ YÖNETİCİSİ (js/vip.js)
   (DİREKT YAYIN / MVP SÜRÜMÜ)
   ========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

let selectedVipNumber = null;

export const VIP = {

    // 1. MODAL DURUMUNU GÜNCELLE (Kilitli / Açık)
    updateModalState: () => {
        const user = STATE.getUser();
        const lockedState = document.getElementById('vip-locked-state');
        const unlockedState = document.getElementById('vip-unlocked-state');
        
        if (!lockedState || !unlockedState) return;

        // Paylaşım sayısı (inviteCount) konfigürasyondaki hedefe ulaştıysa kilidi aç
        if (user.inviteCount >= ME26_CONFIG.requiredInvitesForVip) {
            lockedState.classList.add('hidden');
            unlockedState.classList.remove('hidden');
            VIP.renderGrid();
        } else {
            unlockedState.classList.add('hidden');
            lockedState.classList.remove('hidden');
        }
    },

    // 2. VIP NUMARALARI EKRANA ÇİZ (Erken Erişim Örnekleri)
    renderGrid: () => {
        const grid = document.getElementById('ui-vip-grid');
        const claimBtn = document.getElementById('btn-claim-vip-number');
        
        if (!grid || grid.children.length > 0) return; // Zaten çizildiyse tekrar basma
        
        grid.innerHTML = '';
        selectedVipNumber = null;
        if (claimBtn) claimBtn.disabled = true; // Numara seçilene kadar onay butonunu kilitle
        
        // MVP sürümü için prestijli numara havuzu
        const sampleNumbers = [101, 102, 111, 200, 222, 500, 777, 999, 1000, 1071, 1453, 1923, 2026, 3000, 4444, 5000];
        
        sampleNumbers.forEach(num => {
            const btn = document.createElement('button');
            btn.className = "vip-num-btn bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-mono text-sm font-black hover:border-kaos hover:text-kaos transition-all";
            btn.textContent = `#${num}`;
            
            btn.addEventListener('click', () => {
                // Diğer butonlardan seçili halini kaldır
                document.querySelectorAll('.vip-num-btn').forEach(b => {
                    b.classList.remove('bg-kaos', 'text-slate-900', 'border-kaos');
                    b.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
                });
                
                // Tıklanan butona aktif (seçili) stilini ver
                btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
                btn.classList.add('bg-kaos', 'text-slate-900', 'border-kaos');
                
                selectedVipNumber = num;
                if (claimBtn) claimBtn.disabled = false; // Numara seçilince butonu aktif et
            });
            
            grid.appendChild(btn);
        });
    },

    // 3. PANİĞE KARŞI YEDEK KOPYALAMA SİSTEMİ (FALLBACK)
    fallbackCopy: (text) => {
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
    },

    // 4. PAYLAŞIM VE İLERLEME YÖNETİCİSİ (Dürüst "Paylaşım" diliyle)
    handleShare: async (isWhatsApp = false) => {
        const inviteLink = "https://me26.org/katil"; 
        
        try {
            if (isWhatsApp) {
                window.open(`https://wa.me/?text=ME26 dijital stadyumu'na sen de katıl: ${inviteLink}`, '_blank');
            } else {
                if (!navigator.clipboard) {
                    VIP.fallbackCopy(inviteLink);
                } else {
                    await navigator.clipboard.writeText(inviteLink);
                }
            }
            
            // Paylaşım sayısını artır (state içinde inviteCount olarak tutulmaya devam ediyor)
            const currentCount = STATE.incrementInviteCount();
            UI.renderProfile();
            VIP.updateModalState(); 
            
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
            VIP.fallbackCopy(inviteLink);
            UI.showToast("Bağlantı kopyalandı (Yedek Sistem).", "success");
        }
    },

    // 5. VIP NUMARAYI TESCİL ET (MVP - Yerel Hafıza)
    claimNumber: () => {
        if (!selectedVipNumber) return; 
        
        // Not: Gerçek veritabanı (Firebase/Supabase) bağlandığında çakışma kontrolü buraya gelecek.
        // Örn: const isTaken = await checkDb(selectedVipNumber); if(isTaken) return error;

        STATE.setVipNumber(selectedVipNumber);
        UI.closeModal('vip-modal');
        UI.renderProfile();
        UI.showToast(`Tebrikler! VIP Kurucu Numaranız #${selectedVipNumber} olarak tescillendi.`, "success");
    }
};
