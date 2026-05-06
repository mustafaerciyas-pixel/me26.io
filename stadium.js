/* ==========================================================================
   ME26 AĞI - CANLI STADYUM MOTORU (stadyum.js)
   Supabase Realtime Presence (Eşzamanlı Varlık) Altyapısı
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js';

// Türkiye'nin 81 İli + Yurtdışı (Grid için)
const SEHIRLER = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
    "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
    "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
    "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
    "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
    "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
    "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
    "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye",
    "Düzce", "Yurtdışı"
];

let stadyumKanal = null;

// ==========================================
// 1. STADYUM HTML İSKELETİNİ (81 İL) ÇİZME
// ==========================================
function stadyumArayuzunuHazirla() {
    const container = document.getElementById('stadyum-tribunler');
    if (!container) return;

    let html = '';
    SEHIRLER.forEach(sehir => {
        const idSehir = sehir.replace(/\s+/g, '-');
        html += `
            <div id="tribun-${idSehir}" class="bg-black/40 border border-slate-800 rounded-xl p-3 flex flex-col h-24 relative overflow-hidden transition-colors duration-500">
                <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1 z-10">${sehir}</div>
                <div class="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar content-start flex-grow z-10" id="koltuklar-${idSehir}">
                    <!-- Noktalar (Koltuklar) buraya JS ile basılacak -->
                </div>
                <div class="absolute bottom-0 right-0 text-[40px] opacity-[0.03] font-black pointer-events-none z-0"><i class="fas fa-users"></i></div>
                <div class="absolute bottom-1 right-2 text-[10px] font-black text-gray-600 z-10" id="sayac-${idSehir}"></div>
            </div>
        `;
    });
    
    // Eğer şehri belirsiz veya seçmemiş olanlar varsa onları da "Misafir / Bekleme" tribününe alalım
    html += `
        <div id="tribun-Belirsiz" class="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-3 flex flex-col h-24 relative overflow-hidden">
            <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700/50 pb-1 z-10">Kayıtsız Alan</div>
            <div class="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar content-start flex-grow z-10" id="koltuklar-Belirsiz"></div>
            <div class="absolute bottom-1 right-2 text-[10px] font-black text-gray-600 z-10" id="sayac-Belirsiz"></div>
        </div>
    `;

    container.innerHTML = html;
}

// ==========================================
// 2. EŞZAMANLI VARLIK (PRESENCE) GÜNCELLEMESİ
// ==========================================
function stadyumuGuncelle(presenceState) {
    let totalOnline = 0;
    let mezunOnline = 0;
    let ogrenciOnline = 0;
    
    // Her şehir için anlık sayaç tutucu
    let sehirSayimlari = {};
    SEHIRLER.forEach(s => sehirSayimlari[s] = { mezun: 0, ogrenci: 0, koltuklar: [] });
    sehirSayimlari["Belirsiz"] = { mezun: 0, ogrenci: 0, koltuklar: [] };

    // Supabase'den gelen anlık kullanıcı paketini çöz
    for (const key in presenceState) {
        const userInstances = presenceState[key];
        
        // Bir kişi birden fazla sekme açmış olabilir, sadece ilkini sayıyoruz (tek koltuk)
        if (userInstances && userInstances.length > 0) {
            const kisi = userInstances[0];
            totalOnline++;
            
            const rol = kisi.role || 'Belirsiz';
            const sehir = kisi.city || 'Belirsiz';
            
            const isMezun = rol.includes('Mezunu');
            if (isMezun) mezunOnline++;
            else ogrenciOnline++;

            // Kullanıcıyı ilgili şehrin tribününe oturt
            if (sehirSayimlari[sehir]) {
                sehirSayimlari[sehir].koltuklar.push(isMezun ? 'mezun' : 'ogrenci');
                if (isMezun) sehirSayimlari[sehir].mezun++;
                else sehirSayimlari[sehir].ogrenci++;
            }
        }
    }

    // --- A. SKOR TABELASINI GÜNCELLE ---
    const elTotal = document.getElementById('stat-total-online');
    const elMezun = document.getElementById('stat-mezun-online');
    const elOgrenci = document.getElementById('stat-ogrenci-online');
    const elLider = document.getElementById('stat-lider-tribun');

    if (elTotal) elTotal.innerText = totalOnline.toLocaleString();
    if (elMezun) elMezun.innerText = mezunOnline.toLocaleString();
    if (elOgrenci) elOgrenci.innerText = ogrenciOnline.toLocaleString();

    // Lider tribünü bul (En kalabalık olan)
    let liderSehir = "Bekleniyor";
    let maxKisi = 0;
    SEHIRLER.forEach(sehir => {
        const toplam = sehirSayimlari[sehir].mezun + sehirSayimlari[sehir].ogrenci;
        if (toplam > maxKisi) {
            maxKisi = toplam;
            liderSehir = sehir;
        }
    });
    if (elLider) elLider.innerText = maxKisi > 0 ? `${liderSehir} (${maxKisi})` : 'Boş';

    // --- B. TRİBÜNLERE IŞIKLARI (KOLTUKLARI) YERLEŞTİR ---
    Object.keys(sehirSayimlari).forEach(sehir => {
        const safeSehir = sehir.replace(/\s+/g, '-');
        const koltukContainer = document.getElementById(`koltuklar-${safeSehir}`);
        const sayacEl = document.getElementById(`sayac-${safeSehir}`);
        const data = sehirSayimlari[sehir];

        if (koltukContainer && sayacEl) {
            let noktalarHtml = '';
            
            // Sarı ve Mavi noktaları bas
            data.koltuklar.forEach(tip => {
                if (tip === 'mezun') {
                    // Mezunlar KAOS rengi (Sarı)
                    noktalarHtml += `<div class="w-2.5 h-2.5 rounded-full bg-kaos shadow-[0_0_8px_#F6C104] animate-pulse"></div>`;
                } else {
                    // Öğrenciler MAVİ renk
                    noktalarHtml += `<div class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6] animate-pulse"></div>`;
                }
            });
            
            koltukContainer.innerHTML = noktalarHtml;
            sayacEl.innerText = data.koltuklar.length > 0 ? data.koltuklar.length : '';
            
            // Eğer tribünde biri varsa kutuyu aydınlat, boşsa karart
            const tribunKutusu = document.getElementById(`tribun-${safeSehir}`);
            if(tribunKutusu) {
                if (data.koltuklar.length > 0) {
                    tribunKutusu.classList.add('border-slate-500', 'bg-black/60');
                    tribunKutusu.classList.remove('border-slate-800', 'bg-black/40');
                } else {
                    tribunKutusu.classList.remove('border-slate-500', 'bg-black/60');
                    tribunKutusu.classList.add('border-slate-800', 'bg-black/40');
                }
            }
        }
    });
}

// ==========================================
// 3. MOTORU ÇALIŞTIRMA (SUPABASE BAĞLANTISI)
// ==========================================
export async function baslatStadyum() {
    console.log("🏟️ Canlı Stadyum Motoru Başlatılıyor...");
    stadyumArayuzunuHazirla();

    // Sisteme giren kişinin kimliğini ve şehrini belirliyoruz
    // Eğer kullanıcı giriş yapmamışsa rastgele bir ziyaretçi kimliği veriyoruz
    let myUserId = 'TR-IA-ZİYARETÇİ-' + Math.floor(Math.random() * 100000);
    let myRole = 'Belirsiz'; 
    let myCity = 'Belirsiz';

    // Gerçek kullanıcıysa bilgileri state hafızasından çekiyoruz
    if (STATE.isLoggedIn() && STATE.user) {
        myUserId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' ? `TR-IA-${STATE.user.userNo}` : `TR-IA-ADAY-${Math.floor(Math.random()*1000)}`;
        myRole = STATE.user.role && STATE.user.role.toLowerCase().includes('öğrenci') ? 'İçmimarlık Öğrencisi' : 'İçmimarlık Mezunu';
        myCity = STATE.user.city && STATE.user.city !== 'Seçilmedi' ? STATE.user.city : 'Belirsiz';
    }

    // Supabase üzerinde 'me26_stadyum' adında bir canlı yayın kanalı açıyoruz
    stadyumKanal = supabase.channel('me26_stadyum', {
        config: {
            presence: {
                key: myUserId,
            },
        },
    });

    // 1. Kanalı dinle: Biri girdiğinde veya çıktığında bu kod çalışır
    stadyumKanal
        .on('presence', { event: 'sync' }, () => {
            const state = stadyumKanal.presenceState();
            stadyumuGuncelle(state);
        })
        // 2. Kanala abone ol ve kendi kimliğini içeriye fırlat
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await stadyumKanal.track({
                    user_id: myUserId,
                    role: myRole,
                    city: myCity,
                    online_at: new Date().toISOString()
                });
            }
        });
}

// Güvenlik: Kullanıcı sayfayı kapattığında koltuktan otomatik düşmesi için
window.addEventListener('beforeunload', () => {
    if (stadyumKanal) {
        stadyumKanal.untrack();
        supabase.removeChannel(stadyumKanal);
    }
});

// Arayüz yüklendiğinde stadyumu 2 saniyelik bir gecikmeyle başlatıyoruz ki veriler tam otursun.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
         setTimeout(baslatStadyum, 2000); 
    });
} else {
    setTimeout(baslatStadyum, 2000);
}
