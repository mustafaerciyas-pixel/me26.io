/* ==========================================================================
   ME26 AĞI - CANLI STADYUM MOTORU (stadium.js)
   Supabase Realtime Presence ve Broadcast Altyapısı
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

const SEHIRLER = [
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin", "Aydın", "Balıkesir",
    "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli",
    "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari",
    "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
    "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş", "Nevşehir",
    "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdağ", "Tokat",
    "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman",
    "Kırıkkale", "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye",
    "Düzce", "Yurtdışı"
];

export const STADYUM = {
    kanal: null,
    sahnedekiKisi: null, // O an mikrofonu elinde tutan kişi

    ciz: function() {
        const container = document.getElementById('stadyum-tribunler');
        if (!container) return;

        let html = '';
        SEHIRLER.forEach(sehir => {
            const idSehir = sehir.replace(/\s+/g, '-');
            html += `
                <div id="tribun-${idSehir}" class="bg-black/40 border border-slate-800 rounded-xl p-3 flex flex-col h-24 relative overflow-hidden transition-colors duration-500">
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1 z-10">${sehir}</div>
                    <div class="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar content-start flex-grow z-10" id="koltuklar-${idSehir}"></div>
                    <div class="absolute bottom-0 right-0 text-[40px] opacity-[0.03] font-black pointer-events-none z-0"><i class="fas fa-users"></i></div>
                    <div class="absolute bottom-1 right-2 text-[10px] font-black text-gray-600 z-10" id="sayac-${idSehir}"></div>
                </div>
            `;
        });
        
        html += `
            <div id="tribun-Belirsiz" class="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-3 flex flex-col h-24 relative overflow-hidden">
                <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-slate-700/50 pb-1 z-10">Kayıtsız Alan</div>
                <div class="flex flex-wrap gap-1.5 overflow-y-auto custom-scrollbar content-start flex-grow z-10" id="koltuklar-Belirsiz"></div>
                <div class="absolute bottom-1 right-2 text-[10px] font-black text-gray-600 z-10" id="sayac-Belirsiz"></div>
            </div>
        `;
        container.innerHTML = html;

        // Buton Dinleyicilerini Bağla
        const btnSoz = document.getElementById('btn-soz-iste');
        const btnIn = document.getElementById('btn-kursuyu-birak');
        if(btnSoz) btnSoz.addEventListener('click', () => this.sozIste());
        if(btnIn) btnIn.addEventListener('click', () => this.kursudenIn());
    },

    // Arayüzde Sahneyi (Mikrofon Alanını) Yönetme Modülü
    sahneyiGuncelle: function(kisiData) {
        this.sahnedekiKisi = kisiData;
        const dalgalar = document.getElementById('saha-dalgalar');
        const avatar = document.getElementById('sahne-avatar');
        const micIcon = document.getElementById('sahne-mic-icon');
        const isim = document.getElementById('sahne-kisi-isim');
        const rol = document.getElementById('sahne-kisi-rol');
        const btnSoz = document.getElementById('btn-soz-iste');
        const btnIn = document.getElementById('btn-kursuyu-birak');

        let myUserId = STATE.user?.userNo ? `TR-IA-${STATE.user.userNo}` : null;
        if(!STATE.isLoggedIn()) myUserId = null;

        if (kisiData) {
            // Sahnede biri var, mikrofon açık, yeşil dalgalar aktif!
            if(dalgalar) { dalgalar.classList.remove('opacity-0'); dalgalar.classList.add('opacity-100'); }
            if(avatar) { avatar.classList.add('border-green-500', 'bg-green-900/20'); avatar.classList.remove('border-slate-700', 'bg-slate-900'); }
            if(micIcon) { micIcon.classList.remove('fa-microphone-slash', 'text-gray-600'); micIcon.classList.add('fa-microphone', 'text-green-500'); }
            
            if(isim) { isim.innerText = kisiData.uid; isim.classList.add('text-white'); isim.classList.remove('text-gray-500'); }
            if(rol) { rol.innerText = kisiData.role; rol.classList.add('text-green-400'); rol.classList.remove('text-gray-600'); }

            // Eğer sahnedeki KENDİSİYSE inme butonunu göster
            if (myUserId === kisiData.uid) {
                if(btnSoz) btnSoz.classList.add('hidden');
                if(btnIn) btnIn.classList.remove('hidden');
            } else {
                // Sahne başkası tarafından doluysa, diğerleri söz isteyemez (Şimdilik)
                if(btnSoz) { btnSoz.classList.add('opacity-50', 'cursor-not-allowed'); btnSoz.innerHTML = '<i class="fas fa-lock"></i> Saha Dolu'; }
                if(btnIn) btnIn.classList.add('hidden');
            }
        } else {
            // Saha Boş, sessizlik hakim.
            if(dalgalar) { dalgalar.classList.add('opacity-0'); dalgalar.classList.remove('opacity-100'); }
            if(avatar) { avatar.classList.remove('border-green-500', 'bg-green-900/20'); avatar.classList.add('border-slate-700', 'bg-slate-900'); }
            if(micIcon) { micIcon.classList.add('fa-microphone-slash', 'text-gray-600'); micIcon.classList.remove('fa-microphone', 'text-green-500'); }
            
            if(isim) { isim.innerText = "Saha Boş"; isim.classList.remove('text-white'); isim.classList.add('text-gray-500'); }
            if(rol) { rol.innerText = "Kimse Konuşmuyor"; rol.classList.remove('text-green-400'); rol.classList.add('text-gray-600'); }

            // Saha boşken tekrar "Söz İste" açılır
            if(btnSoz) { btnSoz.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed'); btnSoz.innerHTML = '<i class="fas fa-hand-paper text-kaos"></i> Söz İste'; }
            if(btnIn) btnIn.classList.add('hidden');
        }
    },

    // Broadcast (Telsiz Yayını) Gönderme: El Kaldırıp Sahaya Çıkma
    sozIste: async function() {
        if(!STATE.isLoggedIn()) return UI.showToast("Söz istemek için giriş yapmalısın.", "error");
        if(this.sahnedekiKisi) return UI.showToast("Şu an meclis kürsüsü dolu. Lütfen sıranızı bekleyin.", "error");
        
        let myUserId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' ? `TR-IA-${STATE.user.userNo}` : `TR-IA-ADAY`;
        let myRole = STATE.user.role && STATE.user.role.toLowerCase().includes('öğrenci') ? 'İçmimarlık Öğrencisi' : 'İçmimarlık Mezunu';

        // 81 ildeki herkese anlık olarak "Ben sahneye çıktım" sinyali atarız.
        await this.kanal.send({
            type: 'broadcast',
            event: 'sahne_hareketi',
            payload: { action: 'cikti', kisi: { uid: myUserId, role: myRole } }
        });

        // Kendi ekranımızı anında güncelleriz
        this.sahneyiGuncelle({ uid: myUserId, role: myRole });
        UI.showToast("Sahneye çıktınız! (WebRTC Ses Modülü ilerleyen aşamada aktif olacak)", "success");
    },

    // Broadcast (Telsiz Yayını) Gönderme: Sahneden İnme
    kursudenIn: async function() {
        await this.kanal.send({
            type: 'broadcast',
            event: 'sahne_hareketi',
            payload: { action: 'indi', kisi: null }
        });
        this.sahneyiGuncelle(null);
        UI.showToast("Kürsüden ayrıldınız.", "info");
    },

    // Eşzamanlı Varlık (Tribün Işıkları) Güncellemesi
    guncelle: function(presenceState) {
        let totalOnline = 0; let mezunOnline = 0; let ogrenciOnline = 0;
        let sehirSayimlari = {};
        SEHIRLER.forEach(s => sehirSayimlari[s] = { mezun: 0, ogrenci: 0, koltuklar: [] });
        sehirSayimlari["Belirsiz"] = { mezun: 0, ogrenci: 0, koltuklar: [] };

        for (const key in presenceState) {
            const userInstances = presenceState[key];
            if (userInstances && userInstances.length > 0) {
                const kisi = userInstances[0];
                totalOnline++;
                const rol = kisi.role || 'Belirsiz';
                const sehir = kisi.city || 'Belirsiz';
                const isMezun = rol.includes('Mezunu') || rol.includes('Mezun');
                
                if (isMezun) mezunOnline++; else ogrenciOnline++;

                if (sehirSayimlari[sehir]) {
                    sehirSayimlari[sehir].koltuklar.push(isMezun ? 'mezun' : 'ogrenci');
                    if (isMezun) sehirSayimlari[sehir].mezun++; else sehirSayimlari[sehir].ogrenci++;
                }
            }
        }

        const elTotal = document.getElementById('stat-total-online');
        const elMezun = document.getElementById('stat-mezun-online');
        const elOgrenci = document.getElementById('stat-ogrenci-online');
        const elLider = document.getElementById('stat-lider-tribun');

        if (elTotal) elTotal.innerText = totalOnline.toLocaleString();
        if (elMezun) elMezun.innerText = mezunOnline.toLocaleString();
        if (elOgrenci) elOgrenci.innerText = ogrenciOnline.toLocaleString();

        let liderSehir = "Bekleniyor"; let maxKisi = 0;
        SEHIRLER.forEach(sehir => {
            const toplam = sehirSayimlari[sehir].mezun + sehirSayimlari[sehir].ogrenci;
            if (toplam > maxKisi) { maxKisi = toplam; liderSehir = sehir; }
        });
        if (elLider) elLider.innerText = maxKisi > 0 ? `${liderSehir} (${maxKisi})` : 'Boş';

        Object.keys(sehirSayimlari).forEach(sehir => {
            const safeSehir = sehir.replace(/\s+/g, '-');
            const koltukContainer = document.getElementById(`koltuklar-${safeSehir}`);
            const sayacEl = document.getElementById(`sayac-${safeSehir}`);
            const data = sehirSayimlari[sehir];

            if (koltukContainer && sayacEl) {
                let noktalarHtml = '';
                data.koltuklar.forEach(tip => {
                    if (tip === 'mezun') noktalarHtml += `<div class="w-2.5 h-2.5 rounded-full bg-kaos shadow-[0_0_8px_#F6C104] animate-pulse"></div>`;
                    else noktalarHtml += `<div class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3B82F6] animate-pulse"></div>`;
                });
                
                koltukContainer.innerHTML = noktalarHtml;
                sayacEl.innerText = data.koltuklar.length > 0 ? data.koltuklar.length : '';
                
                const tribunKutusu = document.getElementById(`tribun-${safeSehir}`);
                if(tribunKutusu) {
                    if (data.koltuklar.length > 0) { tribunKutusu.classList.add('border-slate-500', 'bg-black/60'); tribunKutusu.classList.remove('border-slate-800', 'bg-black/40'); }
                    else { tribunKutusu.classList.remove('border-slate-500', 'bg-black/60'); tribunKutusu.classList.add('border-slate-800', 'bg-black/40'); }
                }
            }
        });
    },

    baslat: async function() {
        this.ciz();

        let myUserId = 'TR-IA-ZİYARETÇİ-' + Math.floor(Math.random() * 100000);
        let myRole = 'Belirsiz'; let myCity = 'Belirsiz';

        if (STATE.isLoggedIn() && STATE.user) {
            myUserId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' ? `TR-IA-${STATE.user.userNo}` : `TR-IA-ADAY-${Math.floor(Math.random()*1000)}`;
            myRole = STATE.user.role && STATE.user.role.toLowerCase().includes('öğrenci') ? 'İçmimarlık Öğrencisi' : 'İçmimarlık Mezunu';
            myCity = STATE.user.city && STATE.user.city !== 'Seçilmedi' ? STATE.user.city : 'Belirsiz';
        }

        if (this.kanal) {
            await this.kanal.untrack();
            supabase.removeChannel(this.kanal);
            this.kanal = null;
        }

        this.kanal = supabase.channel('me26_stadyum', {
            config: { presence: { key: myUserId } },
        });

        this.kanal
            // 1. Telsiz Frekansı Dinleyicisi (Birisi sahneye çıkarsa veya inerse haber al)
            .on('broadcast', { event: 'sahne_hareketi' }, (payload) => {
                if (payload.payload.action === 'cikti') {
                    this.sahneyiGuncelle(payload.payload.kisi);
                } else if (payload.payload.action === 'indi') {
                    this.sahneyiGuncelle(null);
                }
            })
            // 2. Varlık (Presence) Dinleyicisi (Tribün Işıkları)
            .on('presence', { event: 'sync' }, () => {
                const state = this.kanal.presenceState();
                this.guncelle(state);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await this.kanal.track({ user_id: myUserId, role: myRole, city: myCity, online_at: new Date().toISOString() });
                }
            });
    }
};

window.addEventListener('beforeunload', () => {
    if (STADYUM.kanal) { STADYUM.kanal.untrack(); supabase.removeChannel(STADYUM.kanal); }
});
