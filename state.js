/* ==========================================================================
   ME26 AĞI - ORTAK AKIL / SORU-CEVAP MOTORU (qa.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Söz Sende bölümündeki soru ve cevapları listelemek
   - Soru detay modalını açmak
   - Cevap göndermek
   - Soru sahibi için çözüm işaretleme
   - Uygunsuz içerik bildirimi
   --------------------------------------------------------------------------
   Güvenlik:
   - Kullanıcı içerikleri ekrana basılmadan önce escape edilir.
   - Inline HTML içine ham başlık, içerik, cevap metni basılmaz.
   - Yetki kontrolü UI tarafında yapılır; asıl güvenlik Supabase RLS ile sağlanmalıdır.
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

// Bazı eski çağrılar için UI globalde de kalsın.
window.UI = UI;

// ------------------------------------------------------
// MODÜL DURUMU
// ------------------------------------------------------
let aktifQaSekme = 'bekleyenler';
let aktifSoruId = null;

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const escapeHtml = (value) => {
    return cleanText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const truncate = (value, limit = 260) => {
    const text = cleanText(value);
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}...`;
};

const formatDate = (dateValue) => {
    if (!dateValue) return 'Tarih Yok';

    try {
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return 'Tarih Yok';

        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        return 'Tarih Yok';
    }
};

const getUser = () => {
    if (typeof STATE.getUser === 'function') return STATE.getUser();
    return STATE.user || {};
};

const aktifKullaniciyiAl = () => {
    if (!STATE.isLoggedIn()) return null;

    const user = getUser();

    if (!user || !user.uid) return null;

    const roleText = cleanText(user.role).toLowerCase();

    let rol = 'İçmimarlık Mezunu';

    if (roleText.includes('öğrenci')) {
        rol = 'İçmimarlık Öğrencisi';
    }

    let dijitalId = 'TR-IA-BEKLEYEN';

    if (user.userNo && user.userNo !== 'BEKLEYEN') {
        dijitalId = `TR-IA-${user.userNo}`;
    }

    return {
        uid: user.uid,
        dijital_id: dijitalId,
        rol
    };
};

const getKitleEtiketi = (hedefKitle) => {
    const hedef = cleanText(hedefKitle);

    if (hedef === 'Sadece İçmimarlık Mezunları') return 'Usta Kalemi';
    if (hedef === 'Sadece İçmimarlık Öğrencileri') return 'Çırak Kalemi';

    return 'Ortak Kürsü';
};

const kullaniciCevapVerebilirMi = (soru, kullanici) => {
    const hedef = cleanText(soru?.hedef_kitle);

    if (hedef === 'Sadece İçmimarlık Mezunları' && kullanici.rol !== 'İçmimarlık Mezunu') {
        return {
            allowed: false,
            message: 'Bu soruya sadece İçmimarlık Mezunları cevap verebilir.'
        };
    }

    if (hedef === 'Sadece İçmimarlık Öğrencileri' && kullanici.rol !== 'İçmimarlık Öğrencisi') {
        return {
            allowed: false,
            message: 'Bu soruya sadece İçmimarlık Öğrencileri cevap verebilir.'
        };
    }

    return {
        allowed: true,
        message: ''
    };
};

const setButtonLoading = (button, loadingText) => {
    if (!button) return '';

    const oldText = button.innerHTML;

    button.innerHTML = loadingText;
    button.disabled = true;

    return oldText;
};

const restoreButton = (button, oldText) => {
    if (!button) return;

    button.innerHTML = oldText;
    button.disabled = false;
};

const emptyState = (message) => {
    return `
        <div class="text-center py-10 border border-dashed border-slate-700 rounded-2xl text-gray-500 text-xs md:text-sm font-bold tracking-widest uppercase bg-black/20">
            ${escapeHtml(message)}
        </div>
    `;
};

// ======================================================
// 1. SEKME DEĞİŞTİRME
// ======================================================
function qaSekmeDegistir(sekme) {
    aktifQaSekme = sekme;

    const btnBekleyenler = $('btn-qa-bekleyenler');
    const btnKutuphane = $('btn-qa-kutuphane');

    const activeClass = 'bg-slate-800 text-white border border-slate-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-inner';
    const passiveClass = 'bg-transparent text-gray-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:text-white';

    if (sekme === 'bekleyenler') {
        if (btnBekleyenler) btnBekleyenler.className = activeClass;
        if (btnKutuphane) btnKutuphane.className = passiveClass;
    } else {
        if (btnKutuphane) btnKutuphane.className = activeClass;
        if (btnBekleyenler) btnBekleyenler.className = passiveClass;
    }

    window.qaSorulariGetir();
}

// ======================================================
// 2. SORULARI LİSTELE
// ======================================================
window.qaSorulariGetir = async function () {
    const listelemeAlani = $('qa-listesi');

    if (!listelemeAlani) return;

    listelemeAlani.innerHTML = emptyState('Meclis kayıtları okunuyor...');

    try {
        const { data, error } = await supabase
            .from('me26_sorular')
            .select('*')
            .order('olusturma_tarihi', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            listelemeAlani.innerHTML = emptyState('Kürsü tamamen boş. Henüz kayıt yok.');
            return;
        }

        const isAuthorized = UI.triggerVerificationGate(true);
        const secilenSekmeCozulduMu = aktifQaSekme === 'kutuphane';

        const filtrelenmisData = data
            .filter((soru) => {
                const soruCozulduMu = soru.cozuldu_mu === true;
                const sikayetSayisi = Number(soru.sikayet_sayisi || 0);

                return soruCozulduMu === secilenSekmeCozulduMu && sikayetSayisi < 10;
            })
            .sort((a, b) => {
                const dateA = a.olusturma_tarihi ? new Date(a.olusturma_tarihi).getTime() : 0;
                const dateB = b.olusturma_tarihi ? new Date(b.olusturma_tarihi).getTime() : 0;

                return dateB - dateA;
            });

        if (filtrelenmisData.length === 0) {
            listelemeAlani.innerHTML = emptyState('Bu sekmede gösterilecek kayıt yok.');
            return;
        }

        listelemeAlani.innerHTML = '';

        filtrelenmisData.forEach((soru) => {
            const soruKarti = createSoruKarti(soru, isAuthorized);
            listelemeAlani.appendChild(soruKarti);
        });
    } catch (error) {
        console.error('QA listeleme hatası:', error);

        listelemeAlani.innerHTML = `
            <div class="bg-red-900/20 border border-red-500/30 text-red-300 p-6 rounded-2xl text-xs font-bold uppercase tracking-widest">
                Sistem hatası. Sorular şu an okunamadı.
            </div>
        `;
    }
};

function createSoruKarti(soru, isAuthorized) {
    const card = document.createElement('div');

    const soruId = cleanText(soru.id);
    const yazarId = isAuthorized ? cleanText(soru.yazar_dijital_id, 'TR-IA-????') : 'TR-IA-****';
    const tarihStr = formatDate(soru.olusturma_tarihi);
    const kitleEtiketi = getKitleEtiketi(soru.hedef_kitle);
    const baslik = cleanText(soru.baslik, 'Başlıksız Soru');
    const icerik = cleanText(soru.icerik, 'İçerik bulunamadı.');
    const cozulduMu = soru.cozuldu_mu === true;

    const blurClass = isAuthorized ? '' : 'blur-sm opacity-50 select-none pointer-events-none';

    const overlay = isAuthorized
        ? ''
        : `
            <div class="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-2xl">
                <button type="button" class="btn-qa-profile bg-kaos text-black px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">
                    Söz Hakkı İçin Sicilini Tamamla
                </button>
            </div>
        `;

    card.className = 'bg-black/40 border border-slate-700 p-6 rounded-2xl relative shadow-md hover:border-slate-500 transition-colors group overflow-hidden';
    card.setAttribute('data-soru-id', soruId);

    card.innerHTML = `
        ${cozulduMu ? '<div class="absolute top-3 right-3 bg-green-900/40 text-green-400 border border-green-700 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest z-10">✓ Çözüldü</div>' : ''}
        ${overlay}
        <div class="${blurClass}">
            <div class="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">
                <span>${escapeHtml(yazarId)}</span>
                <span>•</span>
                <span>${escapeHtml(tarihStr)}</span>
                <span>•</span>
                <span class="text-kaos">${escapeHtml(kitleEtiketi)}</span>
            </div>

            <h3 class="text-lg md:text-xl font-black text-white mb-3 leading-tight">
                ${escapeHtml(baslik)}
            </h3>

            <p class="text-xs md:text-sm text-gray-300 leading-relaxed mb-5">
                ${escapeHtml(truncate(icerik, 320))}
            </p>

            <div class="flex flex-wrap gap-2">
                <button type="button" class="btn-qa-detail bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition" data-soru-id="${escapeHtml(soruId)}">
                    ${isAuthorized ? 'Kürsüye Git' : 'Kilidi Aç'}
                </button>

                ${isAuthorized ? `
                    <button type="button" class="btn-qa-report bg-slate-800 border border-slate-600 text-gray-400 hover:text-red-400 hover:border-red-500 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition" data-target-id="${escapeHtml(soruId)}" data-target-type="soru">
                        Uygunsuz
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    card.querySelector('.btn-qa-detail')?.addEventListener('click', () => {
        if (isAuthorized) {
            window.qaSoruDetayAc(soruId);
        } else {
            UI.switchSaasTab('view-profil');
        }
    });

    card.querySelector('.btn-qa-profile')?.addEventListener('click', () => {
        UI.switchSaasTab('view-profil');
    });

    card.querySelector('.btn-qa-report')?.addEventListener('click', (event) => {
        const btn = event.currentTarget;
        window.qaUygunsuzBildir(btn.dataset.targetId, btn.dataset.targetType);
    });

    return card;
}

// ======================================================
// 3. SORU DETAY MODALI
// ======================================================
window.qaSoruDetayAc = async function (soruId) {
    if (!UI.triggerVerificationGate()) return;

    const kullanici = aktifKullaniciyiAl();

    if (!kullanici) {
        UI.showToast('İşlem yapmak için giriş yapmalısınız.', 'error');
        return;
    }

    try {
        const { data: soru, error: soruError } = await supabase
            .from('me26_sorular')
            .select('*')
            .eq('id', soruId)
            .single();

        if (soruError || !soru) {
            UI.showToast('Soru bulunamadı.', 'error');
            return;
        }

        const { data: hamCevaplar, error: cevaplarError } = await supabase
            .from('me26_cevaplar')
            .select('*')
            .eq('soru_id', soruId)
            .order('olusturma_tarihi', { ascending: true });

        if (cevaplarError) throw cevaplarError;

        const cevaplar = (hamCevaplar || [])
            .filter((cevap) => Number(cevap.sikayet_sayisi || 0) < 10)
            .sort((a, b) => {
                if (a.is_cozum === b.is_cozum) {
                    const dateA = a.olusturma_tarihi ? new Date(a.olusturma_tarihi).getTime() : 0;
                    const dateB = b.olusturma_tarihi ? new Date(b.olusturma_tarihi).getTime() : 0;

                    return dateA - dateB;
                }

                return a.is_cozum ? -1 : 1;
            });

        const mevcutModal = $('dinamik-detay-modal');
        if (mevcutModal) mevcutModal.remove();

        aktifSoruId = soruId;

        const modalDiv = document.createElement('div');
        modalDiv.id = 'dinamik-detay-modal';
        modalDiv.className = 'fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100000] flex flex-col items-center justify-center p-2 sm:p-4';

        const isOwner = kullanici.uid === soru.yazar_uid;
        const cevapYetkisi = kullaniciCevapVerebilirMi(soru, kullanici);
        const cozulduMu = soru.cozuldu_mu === true;

        modalDiv.innerHTML = `
            <div class="bg-slate-900 border border-slate-600 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col">
                <div class="shrink-0 border-b border-slate-800 p-5 md:p-6 relative">
                    <button type="button" id="btn-close-qa-modal" class="absolute top-4 right-4 text-gray-400 hover:text-white transition w-8 h-8 bg-black rounded-full flex items-center justify-center border border-slate-700 shadow-md">
                        ✕
                    </button>

                    <div class="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3 pr-10">
                        Soran: ${escapeHtml(soru.yazar_dijital_id || 'TR-IA-????')}
                        ${cozulduMu ? '<span class="ml-2 text-green-400">Çözüldü</span>' : ''}
                    </div>

                    <h2 class="text-xl md:text-2xl font-black text-white leading-tight pr-10">
                        ${escapeHtml(soru.baslik || 'Başlıksız Soru')}
                    </h2>
                </div>

                <div class="flex-grow overflow-y-auto custom-scrollbar p-5 md:p-6">
                    <div class="bg-black/40 border border-slate-700 rounded-2xl p-5 mb-6">
                        <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(soru.icerik || '')}</p>
                    </div>

                    <h3 class="text-xs font-black uppercase tracking-widest text-white mb-4">
                        <i class="fas fa-comments text-kaos mr-2"></i> Kürsü Kayıtları (${cevaplar.length})
                    </h3>

                    <div id="qa-cevaplar-alani" class="flex flex-col gap-4 mb-6">
                        ${cevaplar.length > 0 ? cevaplar.map((cevap) => createCevapHtml(cevap, soru, isOwner)).join('') : emptyState('Henüz kürsüde söz alan olmadı.')}
                    </div>

                    ${createCevapYazmaAlani(soru, cevapYetkisi, cozulduMu)}
                </div>
            </div>
        `;

        document.body.appendChild(modalDiv);

        $('btn-close-qa-modal')?.addEventListener('click', () => modalDiv.remove());

        modalDiv.querySelector('#btn-submit-answer')?.addEventListener('click', () => {
            window.qaCevapGonder();
        });

        modalDiv.querySelectorAll('.btn-qa-solution').forEach((button) => {
            button.addEventListener('click', () => {
                window.qaCozumIsaretle(button.dataset.cevapId, button.dataset.soruId);
            });
        });

        modalDiv.querySelectorAll('.btn-qa-report-answer').forEach((button) => {
            button.addEventListener('click', () => {
                window.qaUygunsuzBildir(button.dataset.targetId, button.dataset.targetType);
            });
        });
    } catch (error) {
        console.error('QA detay hatası:', error);
        UI.showToast('Soru detayları yüklenemedi.', 'error');
    }
};

function createCevapHtml(cevap, soru, isOwner) {
    const cevapId = escapeHtml(cevap.id);
    const soruId = escapeHtml(soru.id);
    const isSolution = cevap.is_cozum === true;
    const canMarkSolution = isOwner && !soru.cozuldu_mu && !isSolution;

    return `
        <div class="bg-slate-950/60 border ${isSolution ? 'border-green-500/60' : 'border-slate-700'} rounded-2xl p-4 relative">
            ${isSolution ? `
                <div class="mb-3 text-[9px] inline-flex items-center gap-2 bg-green-900/30 text-green-400 border border-green-700 px-2 py-1 rounded uppercase tracking-widest font-black">
                    <i class="fas fa-check-circle"></i> Ustanın El Vermesi · Çözüm
                </div>
            ` : ''}

            <div class="flex flex-wrap items-center gap-2 text-[9px] text-gray-500 font-black uppercase tracking-widest mb-3">
                <span>${escapeHtml(cevap.yazar_dijital_id || 'TR-IA-????')}</span>
                <span>•</span>
                <span>${escapeHtml(formatDate(cevap.olusturma_tarihi))}</span>
            </div>

            <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">${escapeHtml(cevap.icerik || '')}</p>

            <div class="flex flex-wrap gap-2">
                ${canMarkSolution ? `
                    <button type="button" class="btn-qa-solution bg-green-900/30 border border-green-700 text-green-400 hover:bg-green-900/50 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition" data-cevap-id="${cevapId}" data-soru-id="${soruId}">
                        Çözüm Olarak İşaretle
                    </button>
                ` : ''}

                <button type="button" class="btn-qa-report-answer bg-slate-800 border border-slate-700 text-gray-400 hover:text-red-400 hover:border-red-500 px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition" data-target-id="${cevapId}" data-target-type="cevap">
                    Uygunsuz Bildir
                </button>
            </div>
        </div>
    `;
}

function createCevapYazmaAlani(soru, cevapYetkisi, cozulduMu) {
    if (cozulduMu) {
        return `
            <div class="bg-green-900/20 border border-green-500/30 text-green-400 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest">
                Bu konunun çözümü bulunmuş ve arşivlenmiştir. Kürsü kilitlidir.
            </div>
        `;
    }

    if (!cevapYetkisi.allowed) {
        return `
            <div class="bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest">
                ${escapeHtml(cevapYetkisi.message)}
            </div>
        `;
    }

    return `
        <div class="bg-black/40 border border-slate-700 rounded-2xl p-4">
            <label class="block text-[10px] font-black uppercase tracking-widest text-kaos mb-2">
                Kürsüde Söz Al
            </label>

            <textarea id="input-qa-answer" class="w-full bg-black border border-slate-600 text-white p-4 rounded-xl h-32 mb-3 outline-none focus:border-kaos transition custom-scrollbar resize-none text-sm" placeholder="Cevabınızı objektif, mesleki ve çözüm odaklı şekilde yazın..."></textarea>

            <button type="button" id="btn-submit-answer" class="w-full bg-white hover:bg-gray-200 text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition">
                Cevabı Gönder
            </button>
        </div>
    `;
}

// ======================================================
// 4. CEVAP GÖNDER
// ======================================================
window.qaCevapGonder = async function () {
    if (!UI.triggerVerificationGate()) return;

    const kullanici = aktifKullaniciyiAl();

    if (!kullanici) {
        UI.showToast('Cevap verebilmek için giriş yapmalısınız.', 'error');
        return;
    }

    const input = $('input-qa-answer');
    const btn = $('btn-submit-answer');
    const icerik = cleanText(input?.value);

    if (!aktifSoruId) {
        UI.showToast('Soru kimliği bulunamadı.', 'error');
        return;
    }

    if (icerik.length < 20 || icerik.length > 4000) {
        UI.showToast('Cevabınız 20 ile 4000 karakter arasında olmalıdır.', 'error');
        return;
    }

    const eskiMetin = setButtonLoading(btn, '<i class="fas fa-spinner fa-spin"></i> GÖNDERİLİYOR...');

    try {
        const yeniCevap = {
            soru_id: aktifSoruId,
            yazar_uid: kullanici.uid,
            yazar_dijital_id: kullanici.dijital_id,
            icerik,
            is_cozum: false,
            sikayet_sayisi: 0
        };

        const { error } = await supabase
            .from('me26_cevaplar')
            .insert([yeniCevap]);

        if (error) throw error;

        UI.showToast('Cevabınız kürsüye eklendi.', 'success');

        await window.qaSoruDetayAc(aktifSoruId);
    } catch (error) {
        console.error('QA cevap gönderme hatası:', error);
        UI.showToast('Cevap gönderilemedi.', 'error');
        restoreButton(btn, eskiMetin || 'Cevabı Gönder');
    }
};

// ======================================================
// 5. ÇÖZÜM İŞARETLE
// ======================================================
window.qaCozumIsaretle = async function (cevapId, soruId) {
    if (!UI.triggerVerificationGate()) return;

    if (!cevapId || !soruId) {
        UI.showToast('Çözüm kimliği okunamadı.', 'error');
        return;
    }

    if (!confirm('Bu cevabı çözüm olarak işaretlerseniz soru kilitlenecek ve arşivlenecektir. Onaylıyor musunuz?')) {
        return;
    }

    try {
        const { error: cevapError } = await supabase
            .from('me26_cevaplar')
            .update({ is_cozum: true })
            .eq('id', cevapId);

        if (cevapError) throw cevapError;

        const { error: soruError } = await supabase
            .from('me26_sorular')
            .update({ cozuldu_mu: true })
            .eq('id', soruId);

        if (soruError) throw soruError;

        UI.showToast('Çözüm işaretlendi ve konu arşive kaldırıldı.', 'success');

        const modal = $('dinamik-detay-modal');
        if (modal) modal.remove();

        window.qaSorulariGetir();
    } catch (error) {
        console.error('Çözüm işaretleme hatası:', error);
        UI.showToast('Çözüm işaretlenemedi.', 'error');
    }
};

// Eski Türkçe İ içeren çağrılar bozulmasın diye alias bırakıyoruz.
window.qaCozumİsaretle = window.qaCozumIsaretle;

// ======================================================
// 6. UYGUNSUZ BİLDİR
// ======================================================
window.qaUygunsuzBildir = async function (hedefId, hedefTipi) {
    if (!UI.triggerVerificationGate()) return;

    const kullanici = aktifKullaniciyiAl();

    if (!kullanici) {
        UI.showToast('Bildirim için giriş yapmalısınız.', 'error');
        return;
    }

    const temizHedefId = cleanText(hedefId);
    const temizTip = cleanText(hedefTipi);

    if (!temizHedefId || !['soru', 'cevap'].includes(temizTip)) {
        UI.showToast('Bildirim hedefi okunamadı.', 'error');
        return;
    }

    if (!confirm('Bu içeriğin mesleki kurallara uymadığını teyit ediyor musunuz?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('me26_sikayetler')
            .insert([
                {
                    sikayet_eden_uid: kullanici.uid,
                    hedef_id: temizHedefId,
                    hedef_tipi: temizTip
                }
            ]);

        if (error) {
            if (error.code === '23505') {
                UI.showToast('Bu içeriği daha önce bildirdiniz.', 'info');
                return;
            }

            throw error;
        }

        const tablo = temizTip === 'soru' ? 'me26_sorular' : 'me26_cevaplar';

        const { data: mevcutVeri, error: mevcutError } = await supabase
            .from(tablo)
            .select('sikayet_sayisi')
            .eq('id', temizHedefId)
            .single();

        if (mevcutError) throw mevcutError;

        const yeniSayi = Number(mevcutVeri?.sikayet_sayisi || 0) + 1;

        const { error: updateError } = await supabase
            .from(tablo)
            .update({ sikayet_sayisi: yeniSayi })
            .eq('id', temizHedefId);

        if (updateError) throw updateError;

        if (yeniSayi >= 10) {
            UI.showToast('Bu içerik 10 bildirime ulaştığı için görünümden kaldırıldı.', 'warning');

            const modal = $('dinamik-detay-modal');
            if (modal) modal.remove();

            window.qaSorulariGetir();
            return;
        }

        UI.showToast(`Bildiriminiz kaydedildi. (${yeniSayi}/10)`, 'success');
    } catch (error) {
        console.error('QA uygunsuz bildirim hatası:', error);
        UI.showToast('Bildirim işlemi sırasında bir hata oluştu.', 'error');
    }
};

// ======================================================
// 7. QA MOTORUNU BAŞLAT
// ======================================================
function qaMotorunuBaslat() {
    const btnBekleyenler = $('btn-qa-bekleyenler');
    const btnKutuphane = $('btn-qa-kutuphane');

    if (btnBekleyenler) {
        btnBekleyenler.addEventListener('click', () => qaSekmeDegistir('bekleyenler'));
    }

    if (btnKutuphane) {
        btnKutuphane.addEventListener('click', () => qaSekmeDegistir('kutuphane'));
    }

    window.qaSorulariGetir();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', qaMotorunuBaslat);
} else {
    qaMotorunuBaslat();
}
