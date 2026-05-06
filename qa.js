// ============================================================================
// ME26 ORTAK AKIL KÜTÜPHANESİ (Soru - Cevap Modülü Motoru)
// ============================================================================

import { supabase } from './supabase.js';
import { auth } from './config.js'; // Firebase yetkisini içeri alıyoruz
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let aktifQaSekme = 'bekleyenler';
let aktifKullanici = null;
let aktifSoruId = null;

// ==========================================
// 1. BAŞLANGIÇ VE KİMLİK KONTROLÜ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Sekme butonları
    document.getElementById('btn-qa-bekleyenler')?.addEventListener('click', () => qaSekmeDegistir('bekleyenler'));
    document.getElementById('btn-qa-kutuphane')?.addEventListener('click', () => qaSekmeDegistir('kutuphane'));
    
    // Modal açma/kapatma butonları
    document.getElementById('btn-open-qa-modal')?.addEventListener('click', qaModaliAc);
    document.getElementById('btn-close-qa-modal')?.addEventListener('click', qaModaliKapat);
    
    // Gönderme ve AI Butonları
    document.getElementById('btn-submit-qa')?.addEventListener('click', qaSoruGonder);
    document.getElementById('btn-qa-ai-fix')?.addEventListener('click', qaGeminiIleDuzelt);

    // KİMLİK KONTROLÜ (Doğru Sistem: Firebase)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await kullaniciBilgileriniAl(user.uid);
        } else {
            aktifKullanici = null;
        }
        // Kullanıcı durumu netleşince listeyi getir
        qaSorulariGetir();
    });
});

async function kullaniciBilgileriniAl(uid) {
    // Kullanıcının dijital kimliğini (d_kod) ve mesleki durumunu users tablosundan çekiyoruz
    const { data, error } = await supabase
        .from('users')
        .select('id, d_kod, mesleki_durum')
        .eq('id', uid)
        .single();
        
    if (!error && data) {
        aktifKullanici = {
            uid: data.id,
            dijital_id: data.d_kod || 'TR-IA-BİLİNMİYOR',
            rol: data.mesleki_durum || 'Belirsiz'
        };
    }
}

// ==========================================
// 2. ARAYÜZ VE SEKME KONTROLLERİ
// ==========================================
function qaSekmeDegistir(sekme) {
    aktifQaSekme = sekme;
    
    const btnBekleyenler = document.getElementById('btn-qa-bekleyenler');
    const btnKutuphane = document.getElementById('btn-qa-kutuphane');
    
    if (sekme === 'bekleyenler') {
        btnBekleyenler.className = "bg-slate-800 text-white border border-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-inner";
        btnKutuphane.className = "bg-black/50 text-gray-500 border border-slate-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition hover:text-white";
    } else {
        btnKutuphane.className = "bg-slate-800 text-white border border-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-inner";
        btnBekleyenler.className = "bg-black/50 text-gray-500 border border-slate-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition hover:text-white";
    }
    
    qaSorulariGetir();
}

function qaModaliAc() {
    if (!aktifKullanici) return alert("Soru sorabilmek için sisteme giriş yapmalısınız.");
    document.getElementById('qa-modal').style.display = 'flex';
}

function qaModaliKapat() {
    document.getElementById('qa-modal').style.display = 'none';
}

// ==========================================
// 3. SORULARI LİSTELEME
// ==========================================
async function qaSorulariGetir() {
    const listelemeAlani = document.getElementById('qa-listesi');
    listelemeAlani.innerHTML = '<div class="text-center text-gray-500 text-sm py-10 font-bold uppercase tracking-widest animate-pulse">Meclis Kayıtları Okunuyor...</div>';

    const cozulmeDurumu = aktifQaSekme === 'kutuphane';

    const { data, error } = await supabase
        .from('me26_sorular')
        .select('*')
        .eq('cozuldu_mu', cozulmeDurumu)
        .lt('sikayet_sayisi', 10) // 10 şikayet alanları otomatik gizle
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

    data.forEach(soru => {
        // İsimsiz, Liyakat Odaklı Kart Tasarımı
        const tarih = new Date(soru.olusturma_tarihi).toLocaleDateString('tr-TR');
        
        // Hedef kitleye göre renk ve etiket
        let kitleEtiketi = '';
        if(soru.hedef_kitle === 'Sadece İçmimarlar') kitleEtiketi = '<span class="bg-red-900/50 text-red-400 border border-red-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-lock mr-1"></i> Usta Kalemi</span>';
        else if(soru.hedef_kitle === 'Sadece Öğrenciler') kitleEtiketi = '<span class="bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-lock mr-1"></i> Çırak Kalemi</span>';
        else kitleEtiketi = '<span class="bg-blue-900/50 text-blue-400 border border-blue-700 px-2 py-1 rounded text-[9px] uppercase"><i class="fas fa-globe mr-1"></i> Ortak Kürsü</span>';

        const rozet = soru.cozuldu_mu ? '<span class="absolute top-0 right-0 bg-green-500 text-slate-900 text-[9px] font-black px-3 py-1.5 rounded-bl-lg uppercase tracking-widest shadow-md">✓ ÇÖZÜLDÜ</span>' : '';

        const soruKarti = document.createElement('div');
        soruKarti.className = 'bg-black/40 border border-slate-700 p-6 rounded-2xl relative shadow-md hover:border-slate-500 transition-colors group';
        soruKarti.innerHTML = `
            ${rozet}
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-slate-600 text-gray-400 text-xs">
                        <i class="fas fa-user-astronaut"></i>
                    </div>
                    <div>
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">${soru.yazar_dijital_id}</div>
                        <div class="text-[9px] text-gray-500">${tarih}</div>
                    </div>
                </div>
                ${kitleEtiketi}
            </div>
            <h4 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">${soru.baslik}</h4>
            <p class="text-sm text-gray-400 mb-4 font-medium leading-relaxed line-clamp-2">${soru.icerik}</p>
            
            <div class="flex justify-between items-center pt-4 border-t border-slate-700/50 mt-auto">
                <button onclick="qaSoruDetayAc('${soru.id}')" class="text-kaos hover:text-white text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2">
                    Kürsüye Git <i class="fas fa-arrow-right"></i>
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
    if (!aktifKullanici) return alert("Soru sorabilmek için sisteme giriş yapmalısınız.");

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
        yazar_uid: aktifKullanici.uid,
        yazar_dijital_id: aktifKullanici.dijital_id,
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
        
        // Eğer kütüphane sekmesindeyken soru sorduysa, bekleyenlere atalım ki sorusunu görsün
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
        return alert("Gemini AI'ın düzeltebilmesi için lütfen biraz daha fazla detay yazın.");
    }

    const btn = document.getElementById('btn-qa-ai-fix');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Düzeltiliyor...';
    btn.disabled = true;

    try {
        // Şimdilik API entegrasyonu kurulana kadar simülasyon:
        await new Promise(resolve => setTimeout(resolve, 1500));
        alert("Sistem Hazır! Supabase Edge Function (Gemini API) bağlandığında metniniz otomatik olarak profesyonel Türkçeye çevrilecektir.");
        
    } catch (error) {
        alert("Yapay zeka servisine şu an ulaşılamıyor.");
    } finally {
        btn.innerHTML = '<i class="fas fa-magic"></i> Gemini AI ile Düzelt';
        btn.disabled = false;
    }
}

// ==========================================
// 6. SORU DETAYI (CEVAPLAR EKRANI) VE DİNAMİK MODAL YARATIMI
// ==========================================
window.qaSoruDetayAc = async function(soruId) {
    if (!aktifKullanici) return alert("İçeriği okumak için sisteme giriş yapmalısınız.");
    
    // Veritabanından soruyu ve ona ait cevapları çek
    const { data: soru, error: soruError } = await supabase.from('me26_sorular').select('*').eq('id', soruId).single();
    if (soruError) return alert("Soru bulunamadı.");

    const { data: cevaplar, error: cevaplarError } = await supabase
        .from('me26_cevaplar')
        .select('*')
        .eq('soru_id', soruId)
        .lt('sikayet_sayisi', 10)
        .order('is_cozum', { ascending: false }) // Önce çözüm işaretlenen gelsin
        .order('olusturma_tarihi', { ascending: true });

    // Dinamik Soru Detay Modalı Oluştur
    const mevcutModal = document.getElementById('dinamik-detay-modal');
    if(mevcutModal) mevcutModal.remove(); // Varsa eskisini sil

    aktifSoruId = soruId;
    const isOwner = aktifKullanici.uid === soru.yazar_uid; // Soruyu soran kişi mi bakıyor?

    // Cevapları HTML'e dönüştür
    let cevaplarHTML = '';
    if(cevaplar && cevaplar.length > 0) {
        cevaplar.forEach(cevap => {
            const cozumRozeti = cevap.is_cozum ? '<div class="absolute -top-3 -right-3 bg-green-500 text-slate-900 text-[10px] font-black px-3 py-1 rounded shadow-md border border-slate-900 transform rotate-3">USTANIN EL VERMESİ (ÇÖZÜM)</div>' : '';
            
            // Eğer bakan kişi sorunun sahibiyse ve soru henüz çözülmemişse Çözüm İşaretleme butonu çıksın
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
                    <p class="text-sm text-gray-300 font-medium leading-relaxed mb-4">${cevap.icerik}</p>
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

    // Cevap Yazma Alanı (Soru çözülmediyse ve hedef kitleye uyuyorsa gösterilir)
    let cevapYazmaAlani = '';
    
    // Hedef kitle kontrolü (Örn: Soru sadece İçmimarlara sorulduysa, öğrenci cevap yazamaz)
    let cevapYetkisiVar = true;
    if (soru.hedef_kitle === 'Sadece İçmimarlar' && aktifKullanici.rol !== 'İçmimar') cevapYetkisiVar = false;
    if (soru.hedef_kitle === 'Sadece Öğrenciler' && aktifKullanici.rol !== 'Öğrenci') cevapYetkisiVar = false;

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
            cevapYazmaAlani = `<div class="mt-8 text-center text-red-400 bg-red-900/20 p-4 rounded-xl border border-red-900/50 text-[10px] font-bold uppercase tracking-widest">Bu soruya sadece ${soru.hedef_kitle === 'Sadece İçmimarlar' ? 'Mezunlar' : 'Öğrenciler'} cevap verebilir. (Tribün İzleyicisisiniz)</div>`;
        }
    } else {
        cevapYazmaAlani = '<div class="mt-8 text-center text-green-500 bg-green-900/10 p-4 rounded-xl border border-green-900/30 text-[10px] font-bold uppercase tracking-widest">Bu konunun çözümü bulunmuş ve arşivlenmiştir. Kürsü kilitlidir.</div>';
    }

    // Modalı DOM'a Ekle
    const modalDiv = document.createElement('div');
    modalDiv.id = 'dinamik-detay-modal';
    modalDiv.className = 'fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100000] flex flex-col items-center justify-center p-2 sm:p-4';
    modalDiv.innerHTML = `
        <div class="bg-slate-900 border border-slate-600 p-6 sm:p-10 rounded-3xl w-full max-w-3xl relative shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-screen overflow-hidden flex flex-col">
            <button onclick="document.getElementById('dinamik-detay-modal').remove()" class="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-400 hover:text-white transition w-8 h-8 bg-black rounded-full flex items-center justify-center border border-slate-700 shadow-md">✕</button>
            
            <div class="overflow-y-auto custom-scrollbar flex-grow pr-2 pb-4">
                <!-- Soru Başlığı ve Ana İçerik -->
                <div class="mb-8 border-b border-slate-700 pb-6">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="text-[10px] bg-slate-800 text-gray-300 border border-slate-600 px-2 py-1 rounded font-bold uppercase tracking-widest">Soran: ${soru.yazar_dijital_id}</span>
                        ${soru.cozuldu_mu ? '<span class="text-[10px] bg-green-900/50 text-green-400 border border-green-700 px-2 py-1 rounded font-bold uppercase tracking-widest">ÇÖZÜLDÜ</span>' : ''}
                    </div>
                    <h2 class="text-2xl sm:text-3xl font-black text-white mb-4 leading-tight">${soru.baslik}</h2>
                    <p class="text-sm sm:text-base text-gray-300 font-medium leading-relaxed bg-black/30 p-5 rounded-xl border border-slate-800">${soru.icerik}</p>
                </div>

                <!-- Cevaplar Listesi -->
                <h3 class="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2"><i class="fas fa-layer-group text-kaos"></i> Kürsü Kayıtları (${cevaplar ? cevaplar.length : 0})</h3>
                ${cevaplarHTML}

                <!-- Yeni Cevap Alanı -->
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
    const icerik = document.getElementById('input-qa-answer').value.trim();
    if (icerik.length < 20 || icerik.length > 4000) return alert("Cevabınız 20 ile 4000 karakter arasında olmalıdır.");

    const btn = document.getElementById('btn-submit-answer');
    btn.innerText = "GÖNDERİLİYOR...";
    btn.disabled = true;

    const yeniCevap = {
        soru_id: aktifSoruId,
        yazar_uid: aktifKullanici.uid,
        yazar_dijital_id: aktifKullanici.dijital_id,
        icerik: icerik
    };

    const { error } = await supabase.from('me26_cevaplar').insert([yeniCevap]);

    if (error) {
        console.error(error);
        alert("Cevap gönderilemedi.");
        btn.innerText = "Cevabı Gönder";
        btn.disabled = false;
    } else {
        // Ekranı yenilemek için modalı tekrar kendi üstüne açıyoruz
        qaSoruDetayAc(aktifSoruId);
    }
}

// ==========================================
// 8. ÇÖZÜM OLARAK İŞARETLEME (KİLİTLEME)
// ==========================================
window.qaCozumİsaretle = async function(cevapId, soruId) {
    if(!confirm("Bu cevabı çözüm olarak işaretlerseniz soru kilitlenecek ve arşivlenecektir. Onaylıyor musunuz?")) return;

    // 1. Cevabın is_cozum değerini true yap
    await supabase.from('me26_cevaplar').update({ is_cozum: true }).eq('id', cevapId);
    
    // 2. Sorunun cozuldu_mu değerini true yap
    await supabase.from('me26_sorular').update({ cozuldu_mu: true }).eq('id', soruId);

    alert("Mükemmel! Ustanın El Vermesi gerçekleşti ve konu arşive kaldırıldı.");
    
    // Açık olan modalı kapat ve listeyi yenile
    document.getElementById('dinamik-detay-modal').remove();
    qaSorulariGetir();
}

// ==========================================
// 9. TOPLULUK DENETİMİ (UYGUNSUZ BİLDİR / 10 KİŞİ KURALI)
// ==========================================
window.qaUygunsuzBildir = async function(hedefId, hedefTipi) {
    if (!aktifKullanici) return alert("Şikayet edebilmek için sisteme giriş yapmalısınız.");
    if(!confirm("Bu içeriğin mesleki kurallara uymadığını teyit ediyor musunuz? (10 şikayette içerik otomatik silinecektir)")) return;

    // Şikayetler tablosuna ekle. RLS gereği aynı kişi aynı şeyi 2 kere şikayet edemez (Hata döner).
    const { error } = await supabase.from('me26_sikayetler').insert([{
        sikayet_eden_uid: aktifKullanici.uid,
        hedef_id: hedefId,
        hedef_tipi: hedefTipi
    }]);

    if (error) {
        if(error.code === '23505') { // PostgreSQL Unique Constraint Violation
            alert("Bu içeriği zaten daha önce şikayet ettiniz.");
        } else {
            console.error(error);
            alert("Şikayet işlemi sırasında bir hata oluştu.");
        }
        return;
    }

    // Hedef tablodaki (sorular veya cevaplar) sikayet_sayisi kolonunu 1 artır.
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
