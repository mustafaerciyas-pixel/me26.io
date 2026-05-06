// ============================================================================
// ME26 ORTAK AKIL KÜTÜPHANESİ (Soru - Cevap Modülü Motoru)
// ============================================================================

import { supabase } from './supabase.js';
import { auth } from './config.js'; 
import { STATE } from './state.js'; 
import { UI } from './ui.js'; // GÜVENLİK KAPISI İÇİN UI IMPORT EDİLDİ

let aktifQaSekme = 'bekleyenler';
let aktifSoruId = null;

// ==========================================
// 1. BAŞLANGIÇ VE KONTROLLER (Kurşun Geçirmez Sürüm)
// ==========================================
function qaMotorunuBaslat() {
    document.getElementById('btn-qa-bekleyenler')?.addEventListener('click', () => qaSekmeDegistir('bekleyenler'));
    document.getElementById('btn-qa-kutuphane')?.addEventListener('click', () => qaSekmeDegistir('kutuphane'));
    document.getElementById('btn-open-qa-modal')?.addEventListener('click', qaModaliAc);
    document.getElementById('btn-close-qa-modal')?.addEventListener('click', qaModaliKapat);
    document.getElementById('btn-submit-qa')?.addEventListener('click', qaSoruGonder);
    document.getElementById('btn-qa-ai-fix')?.addEventListener('click', qaGeminiIleDuzelt);
    qaSorulariGetir();
}

// Sayfa ne kadar hızlı yüklenirse yüklensin tuşları %100 yakalar
if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', qaMotorunuBaslat); 
} else { 
    qaMotorunuBaslat(); 
}

function aktifKullaniciyiAl() {
    const ekrandakiId = document.getElementById('ui-user-id')?.innerText;
    const ekrandakiRol = document.getElementById('ui-user-role')?.innerText;

    if (!ekrandakiId || ekrandakiId === 'TR-IA-???') return null;

    let rol = 'İçmimar';
    if(ekrandakiRol && ekrandakiRol.toLowerCase().includes('öğrenci')) rol = 'Öğrenci';

    return {
        uid: auth.currentUser ? auth.currentUser.uid : 'GIZLI-UID',
        dijital_id: ekrandakiId,
        rol: rol
    };
}

// ==========================================
// 2. ARAYÜZ VE SEKME KONTROLLERİ
// ==========================================
function qaSekmeDegistir(sekme) {
    aktifQaSekme = sekme;
    
    const btnBekleyenler = document.getElementById('btn-qa-bekleyenler');
    const btnKutuphane = document.getElementById('btn-qa-kutuphane');
    
    if (sekme === 'bekleyenler') {
        btnBekleyenler.className = "bg-slate-800 text-white border border-slate-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-inner";
        btnKutuphane.className = "bg-transparent text-gray-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:text-white";
    } else {
        btnKutuphane.className = "bg-slate-800 text-white border border-slate-600 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition shadow-inner";
        btnBekleyenler.className = "bg-transparent text-gray-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition hover:text-white";
    }
    
    qaSorulariGetir();
}

function qaModaliAc() {
    // GÜVENLİK DUVARI BOUNCER KONTROLÜ
    if (!UI.triggerVerificationGate()) return;
    
    const modal = document.getElementById('qa-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function qaModaliKapat() {
    const modal = document.getElementById('qa-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ==========================================
// 3. SORULARI LİSTELEME (BUZLU CAM)
// ==========================================
async function qaSorulariGetir() {
    const listelemeAlani = document.getElementById('qa-listesi');
    if(!listelemeAlani) return;

    listelemeAlani.innerHTML = '<div class="text-center text-gray-500 text-sm py-10 font-bold uppercase tracking-widest animate-pulse">Meclis Kayıtları Okunuyor...</div>';

    const cozulmeDurumu = aktifQaSekme === 'kutuphane';

    const { data, error } = await supabase
        .from('me26_sorular')
        .select('*')
        .eq('cozuldu_mu', cozulmeDurumu)
        .lt('sikayet_sayisi', 10)
        .order('olusturma_tarihi', { ascending: false });

    if (error) {
        listelemeAlani.innerHTML = '<div class="text-center text-red-500 text-sm py-10 font-bold uppercase tracking-widest">Kayıtlar çekilirken bir hata oluştu.</div>';
        return;
    }

    if (data.length === 0) {
        listelemeAlani.innerHTML = '<div class="text-center text-gray-500 text-sm py-10 font-bold uppercase tracking-widest">Burada henüz bir kayıt yok.</div>';
        return;
    }

    listelemeAlani.innerHTML = ''; 

    // YETKİ KONTROLÜ (Sessiz mod: true/false)
    const isAuthorized = UI.triggerVerificationGate(true);

    data.forEach(soru => {
        const tarih = new Date(soru.olusturma_tarihi).toLocaleDateString('tr-TR');
        
        let kitleEtiketi = '';
        if(soru.hedef_kitle === 'Sadece İçmimarlar') kitleEtiketi = '<span class="bg-red-900/50 text-red-400 border border-red-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-lock mr-1"></i> Usta Kalemi</span>';
        else if(soru.hedef_kitle === 'Sadece Öğrenciler') kitleEtiketi = '<span class="bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-lock mr-1"></i> Çırak Kalemi</span>';
        else kitleEtiketi = '<span class="bg-blue-900/50 text-blue-400 border border-blue-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-globe mr-1"></i> Ortak Kürsü</span>';

        const rozet = soru.cozuldu_mu ? '<span class="absolute top-0 right-0 bg-green-500 text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-bl-lg uppercase tracking-widest shadow-md">✓ ÇÖZÜLDÜ</span>' : '';

        // Buzlu Cam Efektleri ve Kilit
        const blurClass = isAuthorized ? '' : 'blur-sm opacity-50 select-none pointer-events-none';
        const yazarId = isAuthorized ? soru.yazar_dijital_id : 'TR-IA-****';
        const overlay = isAuthorized ? '' : `
            <div class="absolute inset-0 z-20 flex items-center justify-center cursor-pointer mt-12 rounded-2xl" onclick="UI.triggerVerificationGate()">
                <div class="bg-black/80 px-4 py-2 rounded-full border border-slate-600 shadow-xl flex items-center gap-2">
                    <i class="fas fa-lock text-kaos"></i> <span class="text-[10px] font-black text-white uppercase tracking-widest">Söz Hakkı Yok</span>
                </div>
            </div>
        `;

        const soruKarti = document.createElement('div');
        soruKarti.className = 'bg-black/40 border border-slate-700 p-6 rounded-2xl relative shadow-md hover:border-slate-500 transition-colors group';
        soruKarti.innerHTML = `
            ${rozet}
            ${overlay}
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-slate-600 text-gray-400 text-xs ${blurClass}">
                        <i class="fas fa-user-astronaut"></i>
                    </div>
                    <div class="${blurClass}">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${yazarId}</div>
                        <div class="text-[9px] text-gray-500">${tarih}</div>
                    </div>
                </div>
                ${kitleEtiketi}
            </div>
            <h4 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">${soru.baslik}</h4>
            <p class="text-sm text-gray-400 mb-4 font-medium leading-relaxed line-clamp-2 ${blurClass}">${soru.icerik}</p>
            
            <div class="flex justify-between items-center pt-4 border-t border-slate-700/50 mt-auto relative z-10">
                <button onclick="${isAuthorized ? `qaSoruDetayAc('${soru.id}')` : 'UI.triggerVerificationGate()'}" class="text-kaos hover:text-white text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2">
                    ${isAuthorized ? 'Kürsüye Git <i class="fas fa-arrow-right"></i>' : '<i class="fas fa-lock"></i> KİLİDİ AÇ'}
                </button>
                <button onclick="qaUygunsuzBildir('${soru.id}', 'soru')" class="text-gray-600 hover:text-red-500 text-[10px] font-bold uppercase tracking-widest transition" title="Topluluk Denetimi (10 Şikayet)">
                    <i class="fas fa-flag"></i> Uygunsuz
                </button>
            </div>
        `;
        listelemeAlani.appendChild(soruKarti);
    });
}

// ==========================================
// 4. YENİ SORU GÖNDERME
// ==========================================
async function qaSoruGonder() {
    if (!UI.triggerVerificationGate()) return; // GÜVENLİK DUVARI KONTROLÜ
    
    const kullanici = aktifKullaniciyiAl();
    const kitle = document.getElementById('input-qa-audience').value;
    const baslik = document.getElementById('input-qa-title').value.trim();
    const icerik = document.getElementById('input-qa-content').value.trim();
    const onay = document.getElementById('input-qa-responsibility').checked;

    if (!onay) return alert("Sorumluluk beyanını onaylamanız gerekmektedir.");
    if (baslik.length < 15 || baslik.length > 150) return alert("Başlık 15 ile 150 karakter arasında olmalıdır.");
    if (icerik.length < 50 || icerik.length > 3000) return alert("İçerik 50 ile 3000 karakter arasında olmalıdır.");

    const btn = document.getElementById('btn-submit-qa');
    btn.innerText = "GÖNDERİLİYOR...";
    btn.disabled = true;

    const yeniSoru = {
        yazar_uid: kullanici.uid,
        yazar_dijital_id: kullanici.dijital_id,
        hedef_kitle: kitle,
        baslik: baslik,
        icerik: icerik
    };

    const { error } = await supabase.from('me26_sorular').insert([yeniSoru]);

    if (error) {
        console.error(error);
        alert("Soru gönderilemedi. Lütfen tekrar deneyin.");
    } else {
        document.getElementById('input-qa-title').value = '';
        document.getElementById('input-qa-content').value = '';
        document.getElementById('input-qa-responsibility').checked = false;
        qaModaliKapat();
        
        if(aktifQaSekme === 'kutuphane') qaSekmeDegistir('bekleyenler');
        else qaSorulariGetir(); 
    }

    btn.innerText = "KÜRSÜYE GÖNDER";
    btn.disabled = false;
}

// ==========================================
// 5. GEMINI AI (MECLİS KALEMİ) BAĞLANTISI
// ==========================================
async function qaGeminiIleDuzelt() {
    const icerikKutusu = document.getElementById('input-qa-content');
    const metin = icerikKutusu.value.trim();

    if(metin.length < 20) {
        return alert("Meclis Kalemi'nin (AI) düzeltebilmesi için lütfen biraz daha fazla detay yazın.");
    }

    const btn = document.getElementById('btn-qa-ai-fix');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Düzeltiliyor...';
    btn.disabled = true;

    try {
        const API_KEY = "AIzaSyCxXEW4ipF_NEPY3NhFC3MrG2nHEYGK6Zc"; 
        
        const prompt = "Sen uzman bir içmimarsın ve ME26 adlı profesyonel bir stadyumda 'Meclis Kalemi' görevindesin. Aşağıdaki metni bir içmimarın meslektaşlarına veya öğrencilere yazabileceği profesyonel, kurumsal ve hatasız bir Türkçeye çevir. Argo, düşük cümle ve yazım hatalarını düzelt. Anlamını asla değiştirme ve ek bilgi ekleme. Yalnızca düzeltilmiş metni ver:\n\n" + metin;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            const duzeltilmisMetin = data.candidates[0].content.parts[0].text.trim();
            icerikKutusu.value = duzeltilmisMetin;
        } else {
            throw new Error("API'den beklenen yanıt gelmedi.");
        }
        
    } catch (error) {
        console.error("Gemini Hatası:", error);
        alert("Meclis Kalemi şu an meşgul. Lütfen tekrar deneyin.");
    } finally {
        btn.innerHTML = '<i class="fas fa-magic"></i> Meclis Kalemi (AI) ile Düzelt';
        btn.disabled = false;
    }
}

// ==========================================
// 6. SORU DETAYI VE DİNAMİK MODAL
// ==========================================
window.qaSoruDetayAc = async function(soruId) {
    if (!UI.triggerVerificationGate()) return; // GÜVENLİK DUVARI
    
    const kullanici = aktifKullaniciyiAl();
    
    const { data: soru, error: soruError } = await supabase.from('me26_sorular').select('*').eq('id', soruId).single();
    if (soruError) return alert("Soru bulunamadı.");

    const { data: cevaplar, error: cevaplarError } = await supabase
        .from('me26_cevaplar')
        .select('*')
        .eq('soru_id', soruId)
        .lt('sikayet_sayisi', 10)
        .order('is_cozum', { ascending: false })
        .order('olusturma_tarihi', { ascending: true });

    const mevcutModal = document.getElementById('dinamik-detay-modal');
    if(mevcutModal) mevcutModal.remove();

    aktifSoruId = soruId;
    const isOwner = kullanici.uid === soru.yazar_uid; 

    let cevaplarHTML = '';
    if(cevaplar && cevaplar.length > 0) {
        cevaplar.forEach(cevap => {
            const cozumRozeti = cevap.is_cozum ? '<div class="absolute -top-3 -right-3 bg-green-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded shadow-md border border-slate-900 transform rotate-3">USTANIN EL VERMESİ (ÇÖZÜM)</div>' : '';
            
            const cozumButonu = (isOwner && !soru.cozuldu_mu && !cevap.is_cozum) 
                ? `<button onclick="qaCozumİsaretle('${cevap.id}', '${soru.id}')" class="text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-slate-900 text-[10px] font-bold px-3 py-1 rounded transition">Çözüm Olarak İşaretle</button>` 
                : '';

            cevaplarHTML += `
                <div class="bg-black/60 border ${cevap.is_cozum ? 'border-green-500/50' : 'border-slate-700'} p-5 rounded-xl relative mt-4">
                    ${cozumRozeti}
                    <div class="flex justify-between items-start mb-3">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest"><i class="fas fa-comment-dots mr-1 text-slate-600"></i> ${cevap.yazar_dijital_id}</div>
                        <div class="text-[9px] text-gray-500">${new Date(cevap.olusturma_tarihi).toLocaleDateString('tr-TR')}</div>
                    </div>
                    <p class="text-sm text-gray-300 font-medium leading-relaxed mb-4 whitespace-pre-wrap">${cevap.icerik}</p>
                    <div class="flex justify-between items-center border-t border-slate-700/50 pt-3">
                        ${cozumButonu}
                        <button onclick="qaUygunsuzBildir('${cevap.id}', 'cevap')" class="text-gray-600 hover:text-red-500 text-[9px] font-bold uppercase tracking-widest transition ml-auto">Uygunsuz Bildir</button>
                    </div>
                </div>
            `;
        });
    } else {
        cevaplarHTML = '<div class="text-center text-gray-500 text-xs py-8 font-bold uppercase tracking-widest border border-dashed border-slate-700 rounded-xl mt-4">Henüz kürsüde söz alan olmadı.</div>';
    }

    let cevapYetkisiVar = true;
    let yetkisizlikMesaji = '';

    if (soru.hedef_kitle === 'Sadece İçmimarlar' && kullanici.rol !== 'İçmimar') {
        cevapYetkisiVar = false;
        yetkisizlikMesaji = 'Bu soruya sadece Mezunlar cevap verebilir. (Tribün İzleyicisisiniz)';
    }
    if (soru.hedef_kitle === 'Sadece Öğrenciler' && kullanici.rol !== 'Öğrenci') {
        cevapYetkisiVar = false;
        yetkisizlikMesaji = 'Bu soruya sadece Öğrenciler cevap verebilir. (Tribün İzleyicisisiniz)';
    }

    let cevapYazmaAlani = '';
    if (!soru.cozuldu_mu) {
        if (cevapYetkisiVar) {
            cevapYazmaAlani = `
                <div class="mt-8 border-t border-slate-700 pt-6">
                    <label class="block text-[10px] font-bold text-kaos uppercase tracking-widest mb-2 flex items-center gap-2"><i class="fas fa-pen-nib"></i> Kürsüde Söz Al</label>
                    <textarea id="input-qa-answer" placeholder="Çözümünüzü veya fikrinizi detaylıca belirtin (Min 20 Karakter)..." class="w-full bg-black border border-slate-600 text-white p-4 rounded-xl outline-none text-sm font-medium h-24 resize-none custom-scrollbar focus:border-kaos transition mb-3"></textarea>
                    <button onclick="qaCevapGonder()" id="btn-submit-answer" class="w-full bg-slate-800 text-white hover:text-kaos hover:border-kaos border border-slate-600 font-black py-3 rounded-xl uppercase tracking-widest transition shadow-md text-xs">Cevabı Gönder</button>
                </div>
            `;
        } else {
            cevapYazmaAlani = `<div class="mt-8 text-center text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-900/50 text-[10px] font-bold uppercase tracking-widest">${yetkisizlikMesaji}</div>`;
        }
    } else {
        cevapYazmaAlani = '<div class="mt-8 text-center text-green-500 bg-green-900/10 p-4 rounded-xl border border-green-900/30 text-[10px] font-bold uppercase tracking-widest">Bu konunun çözümü bulunmuş ve arşivlenmiştir. Kürsü kilitlidir.</div>';
    }

    const modalDiv = document.createElement('div');
    modalDiv.id = 'dinamik-detay-modal';
    modalDiv.className = 'fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100000] flex flex-col items-center justify-center p-2 sm:p-4';
    modalDiv.innerHTML = `
        <div class="bg-slate-900 border border-slate-600 p-6 sm:p-10 rounded-3xl w-full max-w-3xl relative shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-hidden flex flex-col">
            <button onclick="document.getElementById('dinamik-detay-modal').remove()" class="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-400 hover:text-white transition w-8 h-8 bg-black rounded-full flex items-center justify-center border border-slate-700 shadow-md z-10">✕</button>
            
            <div class="overflow-y-auto custom-scrollbar flex-grow pr-2 pb-4">
                <div class="mb-8 border-b border-slate-700 pb-6 mt-4">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-[10px] bg-slate-800 text-gray-300 border border-slate-600 px-2 py-1 rounded font-bold uppercase tracking-widest">Soran: ${soru.yazar_dijital_id}</span>
                        ${soru.cozuldu_mu ? '<span class="text-[10px] bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 rounded font-bold uppercase tracking-widest">ÇÖZÜLDÜ</span>' : ''}
                    </div>
                    <h2 class="text-xl sm:text-2xl font-black text-white mb-4 leading-tight">${soru.baslik}</h2>
                    <p class="text-sm sm:text-base text-gray-300 font-medium leading-relaxed bg-black/30 p-5 rounded-xl border border-slate-800 whitespace-pre-wrap">${soru.icerik}</p>
                </div>

                <h3 class="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-layer-group text-kaos"></i> Kürsü Kayıtları (${cevaplar ? cevaplar.length : 0})</h3>
                ${cevaplarHTML}
                ${cevapYazmaAlani}
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);
}

// ==========================================
// 7. CEVAP GÖNDERME
// ==========================================
window.qaCevapGonder = async function() {
    if (!UI.triggerVerificationGate()) return; // GÜVENLİK DUVARI
    const kullanici = aktifKullaniciyiAl();

    const icerik = document.getElementById('input-qa-answer').value.trim();
    if (icerik.length < 20 || icerik.length > 4000) return alert("Cevabınız 20 ile 4000 karakter arasında olmalıdır.");

    const btn = document.getElementById('btn-submit-answer');
    btn.innerText = "GÖNDERİLİYOR...";
    btn.disabled = true;

    const yeniCevap = {
        soru_id: aktifSoruId,
        yazar_uid: kullanici.uid,
        yazar_dijital_id: kullanici.dijital_id,
        icerik: icerik
    };

    const { error } = await supabase.from('me26_cevaplar').insert([yeniCevap]);

    if (error) {
        console.error(error);
        alert("Cevap gönderilemedi.");
        btn.innerText = "Cevabı Gönder";
        btn.disabled = false;
    } else {
        qaSoruDetayAc(aktifSoruId);
    }
}

// ==========================================
// 8. ÇÖZÜM OLARAK İŞARETLEME (KİLİTLEME)
// ==========================================
window.qaCozumİsaretle = async function(cevapId, soruId) {
    if (!UI.triggerVerificationGate()) return; // GÜVENLİK DUVARI
    if(!confirm("Bu cevabı çözüm olarak işaretlerseniz soru kilitlenecek ve arşivlenecektir. Onaylıyor musunuz?")) return;

    await supabase.from('me26_cevaplar').update({ is_cozum: true }).eq('id', cevapId);
    await supabase.from('me26_sorular').update({ cozuldu_mu: true }).eq('id', soruId);

    alert("Mükemmel! Ustanın El Vermesi gerçekleşti ve konu arşive kaldırıldı.");
    
    document.getElementById('dinamik-detay-modal').remove();
    qaSorulariGetir();
}

// ==========================================
// 9. TOPLULUK DENETİMİ
// ==========================================
window.qaUygunsuzBildir = async function(hedefId, hedefTipi) {
    if (!UI.triggerVerificationGate()) return; // GÜVENLİK DUVARI
    const kullanici = aktifKullaniciyiAl();
    
    if(!confirm("Bu içeriğin mesleki kurallara uymadığını teyit ediyor musunuz? (10 şikayette içerik otomatik silinecektir)")) return;

    const { error } = await supabase.from('me26_sikayetler').insert([{
        sikayet_eden_uid: kullanici.uid,
        hedef_id: hedefId,
        hedef_tipi: hedefTipi
    }]);

    if (error) {
        if(error.code === '23505') { 
            alert("Bu içeriği zaten daha önce şikayet ettiniz.");
        } else {
            alert("Şikayet işlemi sırasında bir hata oluştu.");
        }
        return;
    }

    const tablo = hedefTipi === 'soru' ? 'me26_sorular' : 'me26_cevaplar';
    const { data: mevcutVeri } = await supabase.from(tablo).select('sikayet_sayisi').eq('id', hedefId).single();
    
    if(mevcutVeri) {
        const yeniSayi = mevcutVeri.sikayet_sayisi + 1;
        await supabase.from(tablo).update({ sikayet_sayisi: yeniSayi }).eq('id', hedefId);
        
        if(yeniSayi >= 10) {
            alert("Topluluk gücü! Bu içerik 10 şikayete ulaştığı için sistemden otonom olarak kaldırıldı.");
            if(document.getElementById('dinamik-detay-modal')) document.getElementById('dinamik-detay-modal').remove();
            qaSorulariGetir();
        } else {
            alert(`Şikayetiniz kaydedildi. (${yeniSayi}/10)`);
        }
    }
}
