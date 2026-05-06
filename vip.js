/* ==========================================================================
   ME26 AĞI - VIP KURUCU NUMARA YÖNETİCİSİ (vip.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Önemli canlı kural:
   - me26.org kullanılmaz. Tek resmi adres: https://me26.io
   - Paylaşım butonuna basmak davet sayısını artırmaz.
   - Davet sayısı yalnızca veritabanındaki gerçek kayıt sayısından gelmelidir.
   - VIP numara seçimi sadece frontend/localStorage ile kesinleştirilemez.
   ========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB } from './supabase.js';

let selectedVipNumber = null;

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const cleanText = (value) => {
    return String(value || '').trim();
};

const getUser = () => {
    if (typeof STATE.getUser === 'function') return STATE.getUser();
    return STATE.user || {};
};

const getInviteCode = (user) => {
    const code =
        cleanText(user?.davetKodu) ||
        cleanText(user?.userNo && user.userNo !== 'BEKLEYEN' ? `TR-IA-${user.userNo}` : '') ||
        cleanText(user?.uid);

    return code || 'ME26';
};

const getInviteLink = () => {
    const user = getUser();
    const ref = encodeURIComponent(getInviteCode(user));

    // /katil kullanmıyoruz. GitHub Pages veya statik hostingte 404 riski doğurur.
    // Ana sayfa query parametresi daha güvenli: https://me26.io/?ref=...
    return `https://me26.io/?ref=${ref}`;
};

const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea');

    textArea.value = text;
    textArea.setAttribute('readonly', 'readonly');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';

    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
    } catch (error) {
        console.error('Yedek kopyalama başarısız:', error);
    }

    document.body.removeChild(textArea);
};

const setClaimButtonState = (enabled) => {
    const claimBtn = $('btn-claim-vip-number');

    if (!claimBtn) return;

    claimBtn.disabled = !enabled;
    claimBtn.classList.toggle('opacity-50', !enabled);
    claimBtn.classList.toggle('cursor-not-allowed', !enabled);
};

const clearVipSelection = () => {
    selectedVipNumber = null;

    document.querySelectorAll('.vip-num-btn').forEach((button) => {
        button.classList.remove('bg-kaos', 'text-slate-900', 'border-kaos', 'shadow-kaos');
        button.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
    });

    setClaimButtonState(false);
};

const getSampleVipNumbers = () => {
    const min = Number(ME26_CONFIG.vipMin || 101);
    const max = Number(ME26_CONFIG.vipMax || 5000);

    const preferred = [
        101,
        102,
        111,
        200,
        222,
        500,
        777,
        999,
        1000,
        1071,
        1453,
        1923,
        2026,
        3000,
        4444,
        5000
    ];

    return preferred.filter((num) => num >= min && num <= max);
};

const userCanOpenVip = () => {
    const user = getUser();
    const inviteCount = Number(user?.inviteCount || 0);
    const required = Number(ME26_CONFIG.requiredInvitesForVip || 3);

    return inviteCount >= required;
};

const userAlreadyHasNumber = () => {
    const user = getUser();

    return Boolean(user?.userNo && user.userNo !== 'BEKLEYEN');
};

// ======================================================
// VIP MOTORU
// ======================================================
export const VIP = {
    // --------------------------------------------------
    // 1. KİLİT DURUMU
    // --------------------------------------------------
    updateModalState: () => {
        const lockedState = $('vip-locked-state');
        const unlockedState = $('vip-unlocked-state');
        const user = getUser();

        if (!lockedState || !unlockedState) return;

        if (userAlreadyHasNumber()) {
            lockedState.classList.remove('hidden');
            lockedState.classList.add('flex');

            unlockedState.classList.add('hidden');
            unlockedState.classList.remove('flex');

            lockedState.innerHTML = `
                <i class="fas fa-check-circle text-6xl text-kaos mb-6"></i>
                <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-widest mb-4">
                    Kurucu Numaran Atandı
                </h2>
                <p class="text-sm text-gray-400 max-w-md leading-relaxed">
                    Mevcut kurucu numaran: <span class="text-kaos font-black">TR-IA-${cleanText(user.userNo)}</span>.
                    Aynı hesap için ikinci VIP numara seçimi yapılamaz.
                </p>
            `;

            return;
        }

        if (userCanOpenVip()) {
            lockedState.classList.add('hidden');
            lockedState.classList.remove('flex');

            unlockedState.classList.remove('hidden');
            unlockedState.classList.add('flex');

            VIP.renderGrid();

            return;
        }

        const inviteCount = Number(user?.inviteCount || 0);
        const required = Number(ME26_CONFIG.requiredInvitesForVip || 3);
        const kalan = Math.max(required - inviteCount, 0);

        unlockedState.classList.add('hidden');
        unlockedState.classList.remove('flex');

        lockedState.classList.remove('hidden');
        lockedState.classList.add('flex');

        lockedState.innerHTML = `
            <i class="fas fa-lock text-6xl text-slate-700 mb-6"></i>
            <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-widest mb-4">
                VIP EKRANI <span class="text-red-500">KİLİTLİ</span>
            </h2>
            <p class="text-sm text-gray-400 max-w-md leading-relaxed">
                Kendi kurucu numaranı seçebilmek için davet bağlantınla en az
                <span class="text-kaos font-black">${required}</span> gerçek meslektaş kaydı gerekir.
                Şu an <span class="text-white font-black">${inviteCount}</span> kayıt görünüyor.
                Kalan: <span class="text-kaos font-black">${kalan}</span>.
            </p>
        `;
    },

    // --------------------------------------------------
    // 2. VIP NUMARA IZGARASI
    // --------------------------------------------------
    renderGrid: () => {
        const grid = $('ui-vip-grid');

        if (!grid) return;

        grid.innerHTML = '';

        clearVipSelection();

        const numbers = getSampleVipNumbers();

        if (numbers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'col-span-full text-center text-gray-500 text-xs uppercase tracking-widest py-8';
            empty.textContent = 'Şu an seçilebilir VIP numara bulunmuyor.';
            grid.appendChild(empty);
            return;
        }

        numbers.forEach((num) => {
            const btn = document.createElement('button');

            btn.type = 'button';
            btn.className = 'vip-num-btn bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-mono text-sm font-black hover:border-kaos hover:text-kaos transition-all';
            btn.textContent = `#${num}`;
            btn.setAttribute('data-vip-number', String(num));

            btn.addEventListener('click', () => {
                clearVipSelection();

                btn.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
                btn.classList.add('bg-kaos', 'text-slate-900', 'border-kaos', 'shadow-kaos');

                selectedVipNumber = num;

                setClaimButtonState(true);
            });

            grid.appendChild(btn);
        });
    },

    // --------------------------------------------------
    // 3. PAYLAŞIM MOTORU
    // --------------------------------------------------
    handleShare: async (isWhatsApp = false) => {
        const inviteLink = getInviteLink();
        const messageText = `ME26 Ağı açılıyor. İçmimarlık Mezunları ve İçmimarlık Öğrencileri için belge kontrollü, aidatsız ve başkansız dijital meclise katıl: ${inviteLink}`;

        try {
            if (isWhatsApp) {
                const message = encodeURIComponent(messageText);
                window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');

                UI.showToast("WhatsApp paylaşım ekranı açıldı.", 'success');
                return;
            }

            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(inviteLink);
            } else {
                fallbackCopy(inviteLink);
            }

            UI.showToast('Davet bağlantısı kopyalandı.', 'success');
        } catch (error) {
            console.error('Paylaşım hatası:', error);

            fallbackCopy(inviteLink);

            UI.showToast('Davet bağlantısı kopyalandı.', 'success');
        } finally {
            // CANLI GÜVENLİK:
            // Burada davet sayısı artırılmıyor.
            // Davet sayısı sadece gerçek kayıt veritabanına düştüğünde artmalıdır.
            UI.renderProfile();
            VIP.updateModalState();
        }
    },

    // --------------------------------------------------
    // 4. VIP NUMARA REZERVASYONU
    // --------------------------------------------------
    claimNumber: async () => {
        const user = getUser();

        if (!STATE.isLoggedIn()) {
            UI.showToast('VIP numara seçmek için giriş yapmalısınız.', 'error');
            return;
        }

        if (!user || !user.uid) {
            UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
            return;
        }

        if (userAlreadyHasNumber()) {
            UI.showToast('Bu hesap için kurucu numara zaten atanmış.', 'info');
            UI.closeModal('vip-modal');
            UI.renderProfile();
            return;
        }

        if (!userCanOpenVip()) {
            UI.showToast('VIP numara seçimi için gerekli gerçek davet sayısına henüz ulaşılmadı.', 'error');
            VIP.updateModalState();
            return;
        }

        if (!selectedVipNumber) {
            UI.showToast('Lütfen önce bir VIP Kurucu No seçin.', 'error');
            return;
        }

        const claimBtn = $('btn-claim-vip-number');
        const oldText = claimBtn ? claimBtn.innerHTML : '';

        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> REZERVE EDİLİYOR...';
        }

        try {
            // CANLI GÜVENLİK:
            // VIP numara localStorage ile kesinleştirilmez.
            // Veritabanında benzersiz şekilde kilitlenmelidir.
            // Bunun için supabase.js içinde DB.vipNumaraAl(uid, number) fonksiyonu olmalı.
            if (typeof DB.vipNumaraAl !== 'function') {
                throw new Error('vip_backend_missing');
            }

            const finalNumber = await DB.vipNumaraAl(user.uid, selectedVipNumber);

            STATE.setVipNumber(finalNumber || selectedVipNumber);

            UI.closeModal('vip-modal');
            UI.renderProfile();

            UI.showToast(`Tebrikler! VIP Kurucu Numaran TR-IA-${finalNumber || selectedVipNumber} olarak kaydedildi.`, 'success');
        } catch (error) {
            console.error('VIP numara rezervasyon hatası:', error);

            if (error.message === 'vip_backend_missing') {
                UI.showToast(
                    'VIP numara rezervasyonu canlı veritabanı kilidine bağlanmadan açılamaz. Bu güvenlik için bilinçli olarak durduruldu.',
                    'error'
                );
            } else if (error.message === 'vip_number_taken') {
                UI.showToast('Bu VIP numara az önce başka biri tarafından alındı. Lütfen başka bir numara seçin.', 'error');
                VIP.renderGrid();
            } else {
                UI.showToast('VIP numara rezerve edilemedi. Lütfen tekrar deneyin.', 'error');
            }

            if (claimBtn) {
                claimBtn.innerHTML = oldText || 'SEÇİLİ NUMARAYI REZERVE ET';
                claimBtn.disabled = false;
            }
        }
    }
};
