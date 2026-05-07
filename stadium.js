/* ==========================================================================
   ME26 AĞI - CANLI STADYUM MOTORU (stadium.js)
   Supabase Realtime Presence, Broadcast Kürsü ve Otonom Chat Altyapısı
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

// DİKKAT: Yasaklı kelimeler listesi güvenlik sebebiyle Supabase (Backend) üzerine taşınmıştır.

export const STADYUM = {
    kanal: null,
    sahnedekiKisi: null, 
    sonMesajZamani: null,
    chatCooldownTimer: null,
    heartbeatTimer: null,

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

        // Kürsü Dinleyicileri
        const btnSoz = document.getElementById('btn-soz-iste');
        const btnIn = document.getElementById('btn-kursuyu-birak');
        if(btnSoz) btnSoz.addEventListener('click', () => this.sozIste());
        if(btnIn) btnIn.addEventListener('click', () => this.kursudenIn());

        // Chat Dinleyicileri
        const btnChat = document.getElementById('btn-chat-gonder');
        const inputChat = document.getElementById('input-chat-mesaj');
        
        if (btnChat) btnChat.addEventListener('click', () => this.mesajGonder());
        if (inputChat) {
            inputChat.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.mesajGonder();
            });
        }
    },

    // Tribün Akışı: Mesaj Gönderme
    mesajGonder: async function() {
        if (!STATE.isLoggedIn()) return UI.showToast("Tribüne seslenmek için giriş yapmalısın.", "error");

        const inputEl = document.getElementById('input-chat-mesaj');
        const btnEl = document.getElementById('btn-chat-gonder');
        if (!inputEl) return;

        let mesaj = inputEl.value.trim();
        if (!mesaj) return;
        if (mesaj.length > 80) return UI.showToast("Mesaj 80 karakterden uzun olamaz. Lütfen kısaltın.", "error");

        // Zaman Sınırı Kontrolü (60 Saniye)
        const suAn = new Date().getTime();
        if (this.sonMesajZamani && (suAn - this.sonMesajZamani) < 60000) {
            return UI.showToast("Tribüne tekrar seslenmek için 60 saniye beklemelisin.", "error");
        }

        // Butonu geçici kilitle (Çift tıklamayı önlemek için)
        if(btnEl) btnEl.disabled = true;

        // AHLAK POLİSİ (SUPABASE BACKEND KONTROLÜ)
        try {
            const { data: kufurluMu, error } = await supabase.rpc('kufur_kontrol', { metin: mesaj });
            
            if (error) {
                if(btnEl) btnEl.disabled = false;
                return UI.showToast("Güvenlik kontrolü yapılamadı, lütfen tekrar deneyin.", "error");
            }

            if (kufurluMu) {
                if(btnEl) btnEl.disabled = false;
                return UI.showToast("SİSTEM UYARISI: Mesajınız ME26 Anayasasına aykırı. Gönderim reddedildi.", "error");
            }

        } catch (err) {
            if(btnEl) btnEl.disabled = false;
            return UI.showToast("Bağlantı hatası.", "error");
        }

        // Kontrolden geçtiyse telsizle yayınla
        let myUserId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' ? `TR-IA-${STATE.user.userNo}` : `TR-IA-ADAY`;
        const payloadData = { uid: myUserId, mesaj: mesaj };

        try {
            await this.kanal.send({
                type: 'broadcast',
                event: 'chat_mesaji',
                payload: payloadData
            });

            this.mesajiEkranaBas(payloadData);

            inputEl.value = '';
            this.sonMesajZamani = suAn;
            this.cooldownBaslat();

        } catch (error) {
            if(btnEl) btnEl.disabled = false;
            UI.showToast("Mesaj iletilemedi, bağlantı hatası.", "error");
        }
    },

    cooldownBaslat: function() {
        const overlay = document.getElementById('chat-cooldown-overlay');
        const timerEl = document.getElementById('chat-cooldown-timer');
        const inputEl = document.getElementById('input-chat-mesaj');
        const btnEl = document.getElementById('btn-chat-gonder');

        if (!overlay || !timerEl) return;

        overlay.classList.remove('hidden');
        if(inputEl) inputEl.disabled = true;
        if(btnEl) btnEl.disabled = true;

        let kalan = 60;
        timerEl.innerText = kalan;

        if (this.chatCooldownTimer) clearInterval(this.chatCooldownTimer);

        this.chatCooldownTimer = setInterval(() => {
            kalan--;
            timerEl.innerText = kalan;
            if (kalan <= 0) {
                clearInterval(this.chatCooldownTimer);
                overlay.classList.add('hidden');
                if(inputEl) inputEl.disabled = false;
                if(btnEl) btnEl.disabled = false;
            }
        }, 1000);
    },

    mesajiEkranaBas: function(data) {
        const container = document.getElementById('stadyum-chat-messages');
        if (!container) return;

        const placeholder = container.querySelector('.animate-pulse');
        if (placeholder) placeholder.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = 'bg-black/80 border border-slate-700 p-2.5 rounded-xl text-white shadow-md animate-slideUpFade flex items-start gap-2 shrink-0 transition-all';
        msgDiv.innerHTML = `<span class="text-kaos font-black whitespace-nowrap text-[10px] mt-0.5">${data.uid}:</span> <span class="font-medium text-gray-300 break-words leading-relaxed text-xs">${data.mesaj}</span>`;
        
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            msgDiv.classList.add('message-fade-out');
            setTimeout(() => msgDiv.remove(), 1500); 
        }, 15000);
    },

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
            if(dalgalar) { dalgalar.classList.remove('opacity-0'); dalgalar.classList.add('opacity-100'); }
            if(avatar) { avatar.classList.add('border-green-500', 'bg-green-900/20'); avatar.classList.remove('border-slate-700', 'bg-slate-900'); }
            if(micIcon) { micIcon.classList.remove('fa-microphone-slash', 'text-gray-600'); micIcon.classList.add('fa-microphone', 'text-green-500'); }
            
            if(isim) { isim.innerText = kisiData.uid; isim.classList.add('text-white'); isim.classList.remove('text-gray-500'); }
            if(rol) { rol.innerText = kisiData.role; rol.classList.add('text-green-400'); rol.classList.remove('text-gray-600'); }

            if (myUserId === kisiData.uid) {
                if(btnSoz) btnSoz.classList.add('hidden');
                if(btnIn) btnIn.classList.remove('hidden');
            } else {
                if(btnSoz) { btnSoz.classList.add('opacity-50', 'cursor-not-allowed'); btnSoz.innerHTML = '<i class="fas fa-lock"></i> Saha Dolu'; }
                if(btnIn) btnIn.classList.add('hidden');
            }
        } else {
            if(dalgalar) { dalgalar.classList.add('opacity-0'); dalgalar.classList.remove('opacity-100'); }
            if(avatar) { avatar.classList.remove('border-green-500', 'bg-green-900/20'); avatar.classList.add('border-slate-700', 'bg-slate-900'); }
            if(micIcon) { micIcon.classList.add('fa-microphone-slash', 'text-gray-600'); micIcon.classList.remove('fa-microphone', 'text-green-500'); }
            
            if(isim) { isim.innerText = "Saha Boş"; isim.classList.remove('text-white'); isim.classList.add('text-gray-500'); }
            if(rol) { rol.innerText = "Kimse Konuşmuyor"; rol.classList.remove('text-green-400'); rol.classList.add('text-gray-600'); }

            if(btnSoz) { btnSoz.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed'); btnSoz.innerHTML = '<i class="fas fa-hand-paper text-kaos"></i> Söz İste'; }
            if(btnIn) btnIn.classList.add('hidden');
        }
    },

    sozIste: async function() {
        if(!STATE.isLoggedIn()) return UI.showToast("Söz istemek için giriş yapmalısın.", "error");
        if(this.sahnedekiKisi) return UI.showToast("Şu an meclis kürsüsü dolu. Lütfen sıranızı bekleyin.", "error");
        
        let myUserId = STATE.user.userNo && STATE.user.userNo !== 'BEKLEYEN' ? `TR-IA-${STATE.user.userNo}` : `TR-IA-ADAY`;
        let myRole = STATE.user.role && STATE.user.role.toLowerCase().includes('öğrenci') ? 'İçmimarlık Öğrencisi' : 'İçmimarlık Mezunu';

        await this.kanal.send({
            type: 'broadcast',
            event: 'sahne_hareketi',
            payload: { action: 'cikti', kisi: { uid: myUserId, role: myRole } }
        });

        this.sahneyiGuncelle({ uid: myUserId, role: myRole });
        UI.showToast("Sahneye çıktınız! (WebRTC Ses Modülü ilerleyen aşamada aktif olacak)", "success");
    },

    kursudenIn: async function() {
        await this.kanal.send({
            type: 'broadcast',
            event: 'sahne_hareketi',
            payload: { action: 'indi', kisi: null }
        });
        this.sahneyiGuncelle(null);
        UI.showToast("Kürsüden ayrıldınız.", "info");
    },

    guncelle: function(presenceState) {
        let totalOnline = 0; let mezunOnline = 0; let ogrenciOnline = 0;
        let sehirSayimlari = {};
        SEHIRLER.forEach(s => sehirSayimlari[s] = { mezun: 0, ogrenci: 0, koltuklar: [] });
        sehirSayimlari["Belirsiz"] = { mezun: 0, ogrenci: 0, koltuklar: [] };

        for (const key in presenceState) {
            const userInstances = presenceState[key];
            const freshInstances = (userInstances || []).filter(kisi => {
                if (!kisi.last_seen_at) return true;
                const seenTime = new Date(kisi.last_seen_at).getTime();
                return Number.isFinite(seenTime) && (Date.now() - seenTime < 120000);
            });
            if (freshInstances.length > 0) {
                const kisi = freshInstances[freshInstances.length - 1];
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

        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
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
            .on('broadcast', { event: 'sahne_hareketi' }, (payload) => {
                if (payload.payload.action === 'cikti') {
                    this.sahneyiGuncelle(payload.payload.kisi);
                } else if (payload.payload.action === 'indi') {
                    this.sahneyiGuncelle(null);
                }
            })
            .on('broadcast', { event: 'chat_mesaji' }, (payload) => {
                this.mesajiEkranaBas(payload.payload);
            })
            .on('presence', { event: 'sync' }, () => {
                const state = this.kanal.presenceState();
                this.guncelle(state);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const buildPresencePayload = () => ({
                        user_id: myUserId,
                        role: myRole,
                        city: myCity,
                        online_at: new Date().toISOString(),
                        last_seen_at: new Date().toISOString()
                    });

                    await this.kanal.track(buildPresencePayload());

                    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
                    this.heartbeatTimer = setInterval(() => {
                        this.kanal?.track(buildPresencePayload());
                    }, 30000);
                }
            });
    }
};

window.addEventListener('beforeunload', () => {
    if (STADYUM.heartbeatTimer) clearInterval(STADYUM.heartbeatTimer); if (STADYUM.kanal) { STADYUM.kanal.untrack(); supabase.removeChannel(STADYUM.kanal); }
});


document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && STADYUM.kanal) {
        STADYUM.kanal.track({ last_seen_at: new Date().toISOString(), status: 'background' });
    }
});
