/* ==========================================================================
   ME26 AĞI - CANLI STADYUM MOTORU (stadium.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Supabase Realtime Presence ile çevrimiçi tribün görünümü
   - Canlı sahne / söz isteme akışı
   - Chat alanı HTML'de varsa güvenli canlı mesajlaşma
   - HTML'de eksik id varsa sayfayı kırmadan sessizce çalışmak
   --------------------------------------------------------------------------
   Güvenlik:
   - Kullanıcıdan gelen metinler innerHTML ile basılmaz.
   - Chat alanı yoksa chat fonksiyonları devre dışı kalır.
   - Kürsü alanı backend kesin kilidi değildir; temsilî canlı sahne deneyimidir.
   ========================================================================== */

import { supabase } from './supabase.js';
import { STATE } from './state.js';
import { UI } from './ui.js';

// ------------------------------------------------------
// ŞEHİR LİSTESİ
// ------------------------------------------------------
const SEHIRLER = [
    'Adana',
    'Adıyaman',
    'Afyonkarahisar',
    'Ağrı',
    'Amasya',
    'Ankara',
    'Antalya',
    'Artvin',
    'Aydın',
    'Balıkesir',
    'Bilecik',
    'Bingöl',
    'Bitlis',
    'Bolu',
    'Burdur',
    'Bursa',
    'Çanakkale',
    'Çankırı',
    'Çorum',
    'Denizli',
    'Diyarbakır',
    'Edirne',
    'Elazığ',
    'Erzincan',
    'Erzurum',
    'Eskişehir',
    'Gaziantep',
    'Giresun',
    'Gümüşhane',
    'Hakkari',
    'Hatay',
    'Isparta',
    'Mersin',
    'İstanbul',
    'İzmir',
    'Kars',
    'Kastamonu',
    'Kayseri',
    'Kırklareli',
    'Kırşehir',
    'Kocaeli',
    'Konya',
    'Kütahya',
    'Malatya',
    'Manisa',
    'Kahramanmaraş',
    'Mardin',
    'Muğla',
    'Muş',
    'Nevşehir',
    'Niğde',
    'Ordu',
    'Rize',
    'Sakarya',
    'Samsun',
    'Siirt',
    'Sinop',
    'Sivas',
    'Tekirdağ',
    'Tokat',
    'Trabzon',
    'Tunceli',
    'Şanlıurfa',
    'Uşak',
    'Van',
    'Yozgat',
    'Zonguldak',
    'Aksaray',
    'Bayburt',
    'Karaman',
    'Kırıkkale',
    'Batman',
    'Şırnak',
    'Bartın',
    'Ardahan',
    'Iğdır',
    'Yalova',
    'Karabük',
    'Kilis',
    'Osmaniye',
    'Düzce',
    'Yurtdışı'
];

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
};

const slugifyCity = (city) => {
    return cleanText(city, 'Belirsiz')
        .replace(/\s+/g, '-')
        .replace(/[^\p{L}\p{N}\-]/gu, '');
};

const getUser = () => {
    if (typeof STATE.getUser === 'function') return STATE.getUser();
    return STATE.user || {};
};

const isStudentRole = (role) => {
    return cleanText(role).toLowerCase().includes('öğrenci');
};

const getCurrentUserIdentity = () => {
    const user = getUser();

    if (!STATE.isLoggedIn() || !user || !user.uid) {
        return {
            uid: `TR-IA-ZİYARETÇİ-${Math.floor(Math.random() * 100000)}`,
            role: 'Ziyaretçi',
            city: 'Belirsiz',
            isLoggedIn: false
        };
    }

    const uid =
        user.userNo && user.userNo !== 'BEKLEYEN'
            ? `TR-IA-${user.userNo}`
            : `TR-IA-ADAY-${String(user.uid).slice(0, 6).toUpperCase()}`;

    const role = isStudentRole(user.role)
        ? 'İçmimarlık Öğrencisi'
        : 'İçmimarlık Mezunu';

    const city =
        user.city &&
        user.city !== 'Seçilmedi' &&
        user.city !== 'TRİBÜN SEÇİLMEDİ'
            ? user.city
            : 'Belirsiz';

    return {
        uid,
        role,
        city,
        isLoggedIn: true
    };
};

const createEl = (tag, className = '', text = '') => {
    const el = document.createElement(tag);

    if (className) el.className = className;
    if (text) el.textContent = text;

    return el;
};

const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
};

const removeChildren = (el) => {
    if (!el) return;

    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};

const safeChannelSend = async (channel, payload) => {
    if (!channel) {
        throw new Error('missing_realtime_channel');
    }

    return await channel.send(payload);
};

const trimMessage = (message) => {
    return cleanText(message)
        .replace(/\s+/g, ' ')
        .slice(0, 120);
};

const normalizePresenceState = (presenceState) => {
    const list = [];

    if (!presenceState || typeof presenceState !== 'object') {
        return list;
    }

    Object.keys(presenceState).forEach((key) => {
        const records = presenceState[key];

        if (Array.isArray(records) && records.length > 0) {
            list.push(records[0]);
        }
    });

    return list;
};

// ======================================================
// STADYUM MOTORU
// ======================================================
export const STADYUM = {
    kanal: null,
    sahnedekiKisi: null,
    sonMesajZamani: 0,
    chatCooldownTimer: null,
    hasStarted: false,

    // --------------------------------------------------
    // 1. TRİBÜNLERİ ÇİZ
    // --------------------------------------------------
    ciz: function () {
        const container = $('stadyum-tribunler');

        if (!container) return;

        removeChildren(container);

        SEHIRLER.forEach((sehir) => {
            const safeId = slugifyCity(sehir);
            const card = createEl(
                'div',
                'bg-black/40 border border-slate-800 rounded-xl p-3 min-h-[92px] transition shadow-inner',
                ''
            );

            card.id = `tribun-${safeId}`;

            const header = createEl('div', 'flex items-center justify-between mb-3 gap-2', '');

            const title = createEl(
                'div',
                'text-[10px] md:text-xs font-black text-white uppercase tracking-widest truncate',
                sehir
            );

            const count = createEl(
                'div',
                'text-[10px] font-mono font-black text-kaos bg-slate-900 border border-slate-700 px-2 py-1 rounded min-w-[28px] text-center',
                ''
            );

            count.id = `sayac-${safeId}`;

            header.appendChild(title);
            header.appendChild(count);

            const seats = createEl(
                'div',
                'flex flex-wrap gap-1.5 min-h-[28px]',
                ''
            );

            seats.id = `koltuklar-${safeId}`;

            card.appendChild(header);
            card.appendChild(seats);

            container.appendChild(card);
        });

        const unknownCard = createEl(
            'div',
            'bg-black/30 border border-dashed border-slate-800 rounded-xl p-3 min-h-[92px] transition shadow-inner opacity-80',
            ''
        );

        unknownCard.id = 'tribun-Belirsiz';

        const unknownHeader = createEl('div', 'flex items-center justify-between mb-3 gap-2', '');
        const unknownTitle = createEl('div', 'text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest truncate', 'Kayıtsız Alan');
        const unknownCount = createEl('div', 'text-[10px] font-mono font-black text-gray-400 bg-slate-900 border border-slate-700 px-2 py-1 rounded min-w-[28px] text-center', '');

        unknownCount.id = 'sayac-Belirsiz';

        const unknownSeats = createEl('div', 'flex flex-wrap gap-1.5 min-h-[28px]', '');
        unknownSeats.id = 'koltuklar-Belirsiz';

        unknownHeader.appendChild(unknownTitle);
        unknownHeader.appendChild(unknownCount);
        unknownCard.appendChild(unknownHeader);
        unknownCard.appendChild(unknownSeats);

        container.appendChild(unknownCard);

        this.ensureOptionalStageElements();
        this.bindLocalEvents();
    },

    // --------------------------------------------------
    // 2. EKSİK AMA GEREKLİ OPSİYONEL SAHNE ELEMANLARI
    // --------------------------------------------------
    ensureOptionalStageElements: function () {
        const stage = $('stadyum-merkez-saha');
        const avatar = $('sahne-avatar');
        const btnSoz = $('btn-soz-iste');

        if (!stage) return;

        if (!$('saha-dalgalar')) {
            const waves = createEl(
                'div',
                'absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none',
                ''
            );

            waves.id = 'saha-dalgalar';

            const circle1 = createEl('div', 'absolute inset-8 rounded-full border border-kaos/20 animate-ping', '');
            const circle2 = createEl('div', 'absolute inset-14 rounded-full border border-kaos/10 animate-pulse', '');

            waves.appendChild(circle1);
            waves.appendChild(circle2);

            stage.insertBefore(waves, stage.firstChild);
        }

        if (!$('sahne-kisi-rol') && avatar && avatar.parentElement) {
            const role = createEl(
                'div',
                'text-[9px] font-bold text-gray-600 tracking-widest uppercase transition-colors',
                'Kimse Konuşmuyor'
            );

            role.id = 'sahne-kisi-rol';

            avatar.parentElement.appendChild(role);
        }

        if (!$('btn-kursuyu-birak') && btnSoz && btnSoz.parentElement) {
            const leaveBtn = createEl(
                'button',
                'hidden bg-red-900/40 border border-red-700 hover:bg-red-900/60 text-red-300 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition shadow-md items-center gap-1.5',
                'Kürsüden İn'
            );

            leaveBtn.type = 'button';
            leaveBtn.id = 'btn-kursuyu-birak';

            btnSoz.parentElement.appendChild(leaveBtn);
        }
    },

    // --------------------------------------------------
    // 3. LOKAL EVENTLER
    // --------------------------------------------------
    bindLocalEvents: function () {
        const btnSoz = $('btn-soz-iste');
        const btnIn = $('btn-kursuyu-birak');
        const btnChat = $('btn-chat-gonder');
        const inputChat = $('input-chat-mesaj');

        if (btnSoz && !btnSoz.dataset.bound) {
            btnSoz.dataset.bound = '1';
            btnSoz.addEventListener('click', () => this.sozIste());
        }

        if (btnIn && !btnIn.dataset.bound) {
            btnIn.dataset.bound = '1';
            btnIn.addEventListener('click', () => this.kursudenIn());
        }

        if (btnChat && !btnChat.dataset.bound) {
            btnChat.dataset.bound = '1';
            btnChat.addEventListener('click', () => this.mesajGonder());
        }

        if (inputChat && !inputChat.dataset.bound) {
            inputChat.dataset.bound = '1';
            inputChat.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.mesajGonder();
                }
            });
        }
    },

    // --------------------------------------------------
    // 4. CHAT MESAJI GÖNDER
    // Chat HTML'de yoksa devre dışı kalır.
    // --------------------------------------------------
    mesajGonder: async function () {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Tribüne seslenmek için giriş yapmalısınız.', 'error');
            return;
        }

        const inputEl = $('input-chat-mesaj');
        const btnEl = $('btn-chat-gonder');

        if (!inputEl) {
            UI.showToast('Canlı tribün sohbeti henüz aktif değil.', 'info');
            return;
        }

        const mesaj = trimMessage(inputEl.value);

        if (!mesaj) return;

        if (mesaj.length > 120) {
            UI.showToast('Mesaj 120 karakterden uzun olamaz.', 'error');
            return;
        }

        const now = Date.now();

        if (this.sonMesajZamani && now - this.sonMesajZamani < 60000) {
            const kalan = Math.ceil((60000 - (now - this.sonMesajZamani)) / 1000);
            UI.showToast(`Tribüne tekrar seslenmek için ${kalan} saniye bekleyin.`, 'error');
            return;
        }

        if (btnEl) btnEl.disabled = true;

        try {
            // Backend'de kufur_kontrol RPC varsa kullanılır.
            // RPC yoksa bağlantı hatasına düşer ve mesaj gönderilmez.
            const { data: uygunsuzMu, error } = await supabase.rpc('kufur_kontrol', {
                metin: mesaj
            });

            if (error) {
                throw error;
            }

            if (uygunsuzMu) {
                UI.showToast('Mesajınız topluluk kurallarına aykırı bulundu ve gönderilmedi.', 'error');
                if (btnEl) btnEl.disabled = false;
                return;
            }

            const identity = getCurrentUserIdentity();

            const payloadData = {
                uid: identity.uid,
                role: identity.role,
                mesaj,
                time: new Date().toISOString()
            };

            await safeChannelSend(this.kanal, {
                type: 'broadcast',
                event: 'chat_mesaji',
                payload: payloadData
            });

            this.mesajiEkranaBas(payloadData);

            inputEl.value = '';
            this.sonMesajZamani = now;
            this.cooldownBaslat();
        } catch (error) {
            console.error('Stadyum chat hatası:', error);
            UI.showToast('Mesaj güvenlik kontrolünden geçirilemedi. Lütfen tekrar deneyin.', 'error');

            if (btnEl) btnEl.disabled = false;
        }
    },

    // --------------------------------------------------
    // 5. CHAT COOLDOWN
    // --------------------------------------------------
    cooldownBaslat: function () {
        const overlay = $('chat-cooldown-overlay');
        const timerEl = $('chat-cooldown-timer');
        const inputEl = $('input-chat-mesaj');
        const btnEl = $('btn-chat-gonder');

        if (inputEl) inputEl.disabled = true;
        if (btnEl) btnEl.disabled = true;

        if (!overlay || !timerEl) {
            setTimeout(() => {
                if (inputEl) inputEl.disabled = false;
                if (btnEl) btnEl.disabled = false;
            }, 60000);

            return;
        }

        overlay.classList.remove('hidden');

        let kalan = 60;
        timerEl.textContent = String(kalan);

        if (this.chatCooldownTimer) {
            clearInterval(this.chatCooldownTimer);
        }

        this.chatCooldownTimer = setInterval(() => {
            kalan -= 1;
            timerEl.textContent = String(kalan);

            if (kalan <= 0) {
                clearInterval(this.chatCooldownTimer);
                this.chatCooldownTimer = null;

                overlay.classList.add('hidden');

                if (inputEl) inputEl.disabled = false;
                if (btnEl) btnEl.disabled = false;
            }
        }, 1000);
    },

    // --------------------------------------------------
    // 6. CHAT MESAJINI EKRANA BAS
    // --------------------------------------------------
    mesajiEkranaBas: function (data) {
        const container = $('stadyum-chat-messages');

        if (!container || !data) return;

        const placeholder = container.querySelector('.animate-pulse');
        if (placeholder) placeholder.remove();

        const msgDiv = createEl(
            'div',
            'bg-black/80 border border-slate-700 p-2.5 rounded-xl text-white shadow-md animate-slideUpFade flex items-start gap-2 shrink-0 transition-all',
            ''
        );

        const idSpan = createEl(
            'span',
            'text-kaos font-mono font-black text-[10px] shrink-0',
            cleanText(data.uid, 'TR-IA-????')
        );

        const msgSpan = createEl(
            'span',
            'text-[11px] text-gray-200 leading-relaxed',
            cleanText(data.mesaj)
        );

        msgDiv.appendChild(idSpan);
        msgDiv.appendChild(msgSpan);

        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;

        setTimeout(() => {
            msgDiv.classList.add('message-fade-out');

            setTimeout(() => {
                msgDiv.remove();
            }, 1500);
        }, 15000);
    },

    // --------------------------------------------------
    // 7. SAHNEYİ GÜNCELLE
    // --------------------------------------------------
    sahneyiGuncelle: function (kisiData) {
        this.sahnedekiKisi = kisiData || null;

        const waves = $('saha-dalgalar');
        const avatar = $('sahne-avatar');
        const micIcon = $('sahne-mic-icon');
        const nameEl = $('sahne-kisi-isim');
        const roleEl = $('sahne-kisi-rol');
        const btnSoz = $('btn-soz-iste');
        const btnIn = $('btn-kursuyu-birak');

        const identity = getCurrentUserIdentity();
        const myUserId = identity.isLoggedIn ? identity.uid : null;

        if (kisiData) {
            if (waves) {
                waves.classList.remove('opacity-0');
                waves.classList.add('opacity-100');
            }

            if (avatar) {
                avatar.classList.add('border-green-500', 'bg-green-900/20');
                avatar.classList.remove('border-slate-700', 'bg-slate-900');
            }

            if (micIcon) {
                micIcon.classList.remove('fa-microphone-slash', 'text-gray-600');
                micIcon.classList.add('fa-microphone', 'text-green-500');
            }

            if (nameEl) {
                nameEl.textContent = cleanText(kisiData.uid, 'TR-IA-????');
                nameEl.classList.add('text-white');
                nameEl.classList.remove('text-gray-500');
            }

            if (roleEl) {
                roleEl.textContent = cleanText(kisiData.role, 'Söz Sahibi');
                roleEl.classList.add('text-green-400');
                roleEl.classList.remove('text-gray-600');
            }

            if (myUserId && myUserId === kisiData.uid) {
                if (btnSoz) btnSoz.classList.add('hidden');

                if (btnIn) {
                    btnIn.classList.remove('hidden');
                    btnIn.classList.add('inline-flex');
                }
            } else {
                if (btnSoz) {
                    btnSoz.classList.remove('hidden');
                    btnSoz.classList.add('opacity-50', 'cursor-not-allowed');
                    btnSoz.textContent = 'Saha Dolu';
                    btnSoz.disabled = true;
                }

                if (btnIn) {
                    btnIn.classList.add('hidden');
                    btnIn.classList.remove('inline-flex');
                }
            }

            return;
        }

        if (waves) {
            waves.classList.add('opacity-0');
            waves.classList.remove('opacity-100');
        }

        if (avatar) {
            avatar.classList.remove('border-green-500', 'bg-green-900/20');
            avatar.classList.add('border-slate-700', 'bg-slate-900');
        }

        if (micIcon) {
            micIcon.classList.add('fa-microphone-slash', 'text-gray-600');
            micIcon.classList.remove('fa-microphone', 'text-green-500');
        }

        if (nameEl) {
            nameEl.textContent = 'Saha Boş';
            nameEl.classList.remove('text-white');
            nameEl.classList.add('text-gray-500');
        }

        if (roleEl) {
            roleEl.textContent = 'Kimse Konuşmuyor';
            roleEl.classList.remove('text-green-400');
            roleEl.classList.add('text-gray-600');
        }

        if (btnSoz) {
            btnSoz.classList.remove('hidden', 'opacity-50', 'cursor-not-allowed');
            btnSoz.textContent = 'Söz İste';
            btnSoz.disabled = false;
        }

        if (btnIn) {
            btnIn.classList.add('hidden');
            btnIn.classList.remove('inline-flex');
        }
    },

    // --------------------------------------------------
    // 8. SÖZ İSTE
    // --------------------------------------------------
    sozIste: async function () {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Söz istemek için giriş yapmalısınız.', 'error');
            return;
        }

        if (this.sahnedekiKisi) {
            UI.showToast('Şu an meclis kürsüsü dolu. Lütfen sıranızı bekleyin.', 'error');
            return;
        }

        const identity = getCurrentUserIdentity();

        if (!identity.isLoggedIn) {
            UI.showToast('Söz istemek için giriş yapmalısınız.', 'error');
            return;
        }

        const kisi = {
            uid: identity.uid,
            role: identity.role,
            city: identity.city
        };

        try {
            await safeChannelSend(this.kanal, {
                type: 'broadcast',
                event: 'sahne_hareketi',
                payload: {
                    action: 'cikti',
                    kisi
                }
            });

            this.sahneyiGuncelle(kisi);

            UI.showToast('Sahneye çıktınız. Sesli yayın modülü ilerleyen aşamada aktif olacak.', 'success');
        } catch (error) {
            console.error('Söz isteme hatası:', error);
            UI.showToast('Sahneye çıkılamadı. Bağlantınızı kontrol edin.', 'error');
        }
    },

    // --------------------------------------------------
    // 9. KÜRSÜDEN İN
    // --------------------------------------------------
    kursudenIn: async function () {
        try {
            await safeChannelSend(this.kanal, {
                type: 'broadcast',
                event: 'sahne_hareketi',
                payload: {
                    action: 'indi',
                    kisi: null
                }
            });

            this.sahneyiGuncelle(null);

            UI.showToast('Kürsüden ayrıldınız.', 'info');
        } catch (error) {
            console.error('Kürsüden inme hatası:', error);
            UI.showToast('Kürsüden çıkış iletilemedi.', 'error');
        }
    },

    // --------------------------------------------------
    // 10. PRESENCE GÜNCELLE
    // --------------------------------------------------
    guncelle: function (presenceState) {
        const records = normalizePresenceState(presenceState);

        let totalOnline = 0;
        let mezunOnline = 0;
        let ogrenciOnline = 0;

        const sehirSayimlari = {};

        SEHIRLER.forEach((sehir) => {
            sehirSayimlari[sehir] = {
                mezun: 0,
                ogrenci: 0,
                koltuklar: []
            };
        });

        sehirSayimlari.Belirsiz = {
            mezun: 0,
            ogrenci: 0,
            koltuklar: []
        };

        records.forEach((kisi) => {
            totalOnline += 1;

            const role = cleanText(kisi.role, 'Belirsiz');
            const cityRaw = cleanText(kisi.city, 'Belirsiz');
            const city = sehirSayimlari[cityRaw] ? cityRaw : 'Belirsiz';
            const isStudent = isStudentRole(role);
            const seatType = isStudent ? 'ogrenci' : 'mezun';

            if (isStudent) ogrenciOnline += 1;
            else mezunOnline += 1;

            sehirSayimlari[city].koltuklar.push(seatType);

            if (isStudent) sehirSayimlari[city].ogrenci += 1;
            else sehirSayimlari[city].mezun += 1;
        });

        setText('stat-total-online', totalOnline.toLocaleString('tr-TR'));
        setText('stat-mezun-online', mezunOnline.toLocaleString('tr-TR'));
        setText('stat-ogrenci-online', ogrenciOnline.toLocaleString('tr-TR'));

        let liderSehir = 'Bekleniyor';
        let maxKisi = 0;

        Object.keys(sehirSayimlari).forEach((sehir) => {
            const toplam =
                sehirSayimlari[sehir].mezun +
                sehirSayimlari[sehir].ogrenci;

            if (toplam > maxKisi) {
                maxKisi = toplam;
                liderSehir = sehir;
            }
        });

        setText(
            'stat-lider-tribun',
            maxKisi > 0 ? `${liderSehir} (${maxKisi})` : 'Boş'
        );

        Object.keys(sehirSayimlari).forEach((sehir) => {
            const safeSehir = slugifyCity(sehir);
            const koltukContainer = $(`koltuklar-${safeSehir}`);
            const sayacEl = $(`sayac-${safeSehir}`);
            const tribunKutusu = $(`tribun-${safeSehir}`);
            const data = sehirSayimlari[sehir];

            if (!koltukContainer || !sayacEl) return;

            removeChildren(koltukContainer);

            data.koltuklar.slice(0, 60).forEach((tip) => {
                const dot = createEl(
                    'span',
                    tip === 'mezun'
                        ? 'w-2.5 h-2.5 rounded-full bg-kaos shadow-kaos inline-block'
                        : 'w-2.5 h-2.5 rounded-full bg-white shadow-md inline-block',
                    ''
                );

                dot.title = tip === 'mezun' ? 'Mezun' : 'Öğrenci';

                koltukContainer.appendChild(dot);
            });

            if (data.koltuklar.length > 60) {
                const more = createEl(
                    'span',
                    'text-[9px] text-gray-400 font-mono ml-1',
                    `+${data.koltuklar.length - 60}`
                );

                koltukContainer.appendChild(more);
            }

            sayacEl.textContent =
                data.koltuklar.length > 0
                    ? String(data.koltuklar.length)
                    : '';

            if (tribunKutusu) {
                if (data.koltuklar.length > 0) {
                    tribunKutusu.classList.add('border-slate-500', 'bg-black/60');
                    tribunKutusu.classList.remove('border-slate-800', 'bg-black/40');
                } else {
                    tribunKutusu.classList.remove('border-slate-500', 'bg-black/60');
                    tribunKutusu.classList.add('border-slate-800', 'bg-black/40');
                }
            }
        });
    },

    // --------------------------------------------------
    // 11. BAŞLAT
    // --------------------------------------------------
    baslat: async function () {
        this.ciz();

        const identity = getCurrentUserIdentity();

        try {
            if (this.kanal) {
                try {
                    await this.kanal.untrack();
                } catch (error) {
                    console.warn('Eski stadyum presence temizlenemedi:', error);
                }

                try {
                    supabase.removeChannel(this.kanal);
                } catch (error) {
                    console.warn('Eski stadyum kanalı kapatılamadı:', error);
                }

                this.kanal = null;
            }

            this.kanal = supabase.channel('me26_stadyum', {
                config: {
                    presence: {
                        key: identity.uid
                    }
                }
            });

            this.kanal
                .on('broadcast', { event: 'sahne_hareketi' }, (payload) => {
                    const data = payload?.payload || {};

                    if (data.action === 'cikti') {
                        this.sahneyiGuncelle(data.kisi || null);
                    }

                    if (data.action === 'indi') {
                        this.sahneyiGuncelle(null);
                    }
                })
                .on('broadcast', { event: 'chat_mesaji' }, (payload) => {
                    this.mesajiEkranaBas(payload?.payload || {});
                })
                .on('presence', { event: 'sync' }, () => {
                    const state = this.kanal.presenceState();
                    this.guncelle(state);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await this.kanal.track({
                            user_id: identity.uid,
                            role: identity.role,
                            city: identity.city,
                            online_at: new Date().toISOString()
                        });

                        this.hasStarted = true;
                    }

                    if (status === 'CHANNEL_ERROR') {
                        UI.showToast('Canlı Stadyum bağlantısı kurulamadı.', 'error');
                    }
                });
        } catch (error) {
            console.error('Stadyum başlatma hatası:', error);
            UI.showToast('Canlı Stadyum şu an başlatılamadı.', 'error');
        }
    },

    // --------------------------------------------------
    // 12. TEMİZLE
    // --------------------------------------------------
    temizle: async function () {
        if (this.chatCooldownTimer) {
            clearInterval(this.chatCooldownTimer);
            this.chatCooldownTimer = null;
        }

        if (!this.kanal) return;

        try {
            await this.kanal.untrack();
        } catch (error) {
            console.warn('Stadyum untrack hatası:', error);
        }

        try {
            supabase.removeChannel(this.kanal);
        } catch (error) {
            console.warn('Stadyum kanal kapatma hatası:', error);
        }

        this.kanal = null;
        this.hasStarted = false;
    }
};

// ------------------------------------------------------
// SAYFADAN ÇIKARKEN KANALI TEMİZLE
// ------------------------------------------------------
window.addEventListener('beforeunload', () => {
    if (STADYUM.kanal) {
        try {
            STADYUM.kanal.untrack();
            supabase.removeChannel(STADYUM.kanal);
        } catch (error) {
            console.warn('Stadyum çıkış temizliği başarısız:', error);
        }
    }
});
