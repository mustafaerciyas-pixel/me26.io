/* ==========================================================================
   ME26 AĞI - VIP VE PRESTİJ YÖNETİCİSİ (vip.js)
   Davet sayacını tutan ve VIP numaraları dağıtan viral motor.
   ========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

let selectedVipNumber = null;

export const VIP = {
    // 1. KİLİT KONTROL MOTORU (3 kişi davet edildi mi?)
    updateModalState: () => {
        const user = STATE.getUser();
        const lockedState = document.getElementById('vip-locked-state');
        const unlockedState = document.getElementById('vip-unlocked-state');

        if (!lockedState || !unlockedState) return;

        // Adamın davet sayısı, config.js'teki sınırı (3'ü) geçti mi?
        if (user.inviteCount >= ME26_CONFIG.requiredInvitesForVip) {
            lockedState.classList.add('hidden');
            unlockedState.classList.remove('hidden');
            VIP.renderGrid(); // Ekranı aç ve numaraları diz
        } else {
            unlockedState.classList.add('hidden');
            lockedState.classList.remove('hidden'); // Kilitli ekranı göster
        }
    },

    // 2. ALTIN NUMARALARI EKRANA DİZME MOTORU
    renderGrid: () => {
        const grid = document.getElementById('ui-vip-grid');
        const claimBtn = document.getElementById('btn-claim-vip-number');

        if (!grid || grid.children.length > 0) return;

        grid.innerHTML = '';
        selectedVipNumber = null;

        if (claimBtn) claimBtn.disabled = true;

        // Gelecekte bu liste Supabase veritabanından çekilecek (boş olanlar gelecek)
        // Şimdilik sistemin şov yapması için demo numaralar diziyoruz:
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

            // Numaraya tıklandığında boyama ve seçme işlemi
            btn.addEventListener('click', () => {
                document.querySelectorAll('.vip-num-btn').forEach((button) => {
                    button.classList.remove('bg-kaos', 'text-slate-900', 'border-kaos');
                    button.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
                });

                btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
                btn.classList.add('bg-kaos', 'text-slate-900', 'border-kaos');

                selectedVipNumber = num;

                // Numarayı aldıktan sonra "BU NUMARAYI AL" butonunun kilidini aç
                if (claimBtn) claimBtn.disabled = false;
            });

            grid.appendChild(btn);
        });
    },

    // 3. YEDEK KOPYALAMA MOTORU (Bazı eski telefonlarda panoya kopyalama çalışmazsa devreye girer)
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
            console.error('Yedek kopyalama başarısız:', error);
        }

        document.body.removeChild(textArea);
    },

    // 4. PAYLAŞIM VE SAYAÇ MOTORU (Kopyala veya WhatsApp'a basılınca)
    handleShare: async (isWhatsApp = false) => {
        const inviteLink = 'https://me26.org/katil';

        try {
            if (isWhatsApp) {
                const message = encodeURIComponent(`Sadece İçmimarların Girebildiği Dijital Stadyuma Katıl: ${inviteLink}`);
                window.open(`https://wa.me/?text=${message}`, '_blank');
            } else if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(inviteLink);
            } else {
                VIP.fallbackCopy(inviteLink);
            }

            // Paylaşım yapıldı, state.js'deki sayacı 1 artır!
            const currentCount = STATE.incrementInviteCount();

            UI.renderProfile(); // Profil ekranındaki barı (0/3) güncelle
            VIP.updateModalState(); // Modal açıksa kilit durumunu kontrol et

            if (isWhatsApp) {
                UI.showToast("WhatsApp'a yönlendiriliyor...", 'success');
            } else {
                UI.showToast('Paylaşım bağlantısı kopyalandı.', 'success');
            }

            // Adam 3'e ulaştıysa müjdeyi ver!
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

    // 5. NUMARAYI ZİMMETLEME MOTORU ("BU NUMARAYI AL" butonuna basılınca)
    claimNumber: () => {
        if (!selectedVipNumber) {
            UI.showToast('Lütfen önce bir VIP Kurucu No seç.', 'error');
            return;
        }

        // Seçilen numarayı state.js'teki hafıza defterine mühürle
        STATE.setVipNumber(selectedVipNumber);
        UI.closeModal('vip-modal');
        UI.renderProfile(); // Profil kartına adamın yeni numarasını bas

        UI.showToast(`Tebrikler! VIP Kurucu Numaran TR-IA-${selectedVipNumber} olarak kaydedildi.`, 'success');
    }
};
