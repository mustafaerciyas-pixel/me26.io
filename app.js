/* ==========================================================================
   ME26.IO - OTONOM DAO SİSTEMİ | MERKEZİ MOTOR (app.js)
   Tüm sayfalarda çalışır, Kaos Motoru kimlik sormadan HERKESE vurur!
   ========================================================================== */

// 1. SUPABASE BAĞLANTISI (Kendi Key'in)
const supabaseUrl = 'https://ukmkojfntsmueikjcrvz.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbWtvamZudHNtdWVpa2pjcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDkxOTIsImV4cCI6MjA5MzEyNTE5Mn0.qekCT-bHdmq7_31KDyFLzY33rA-jFJOqhK7gGg3ptVw';

let supabaseClient = null;
try { 
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey); 
} catch (err) { 
    console.error("Veritabanı başlatılamadı:", err); 
}

let pendingGoogleUser = { email: '' };

/* =====================================================================
   DİJİTAL DİRENİŞ MOTORU: KALICI KAOS RENKLERİ (KİMLİK SORMADAN HERKESE)
   ===================================================================== */
window.kaosRenginiBas = function() {
    // KİMLİK KONTROLÜNÜ KALDIRDIK! Siteye giren herkes bu iğrençliği yaşayacak.
    
    // Üyeye/Ziyaretçiye daha önce bir iğrenç renk atandı mı? Atanmadıysa yeni seç ve hafızaya kazı.
    let aktifKaosRengi = localStorage.getItem('me26_kaos_rengi');
    if (!aktifKaosRengi) {
        const kaosRenkleri = [
            '#FF007F', '#7FFF00', '#00FFFF', '#FF00FF', '#FFFF00',
            '#FF4500', '#8A2BE2', '#00FF00', '#FF1493', '#1E90FF'
        ];
        aktifKaosRengi = kaosRenkleri[Math.floor(Math.random() * kaosRenkleri.length)];
        localStorage.setItem('me26_kaos_rengi', aktifKaosRengi);
    }

    // Renkleri ZORLA uygula (Hangi sayfada olursa olsun)
    const bodyEmanet = document.body;
    if(bodyEmanet) {
        bodyEmanet.classList.remove('bg-zemin', 'bg-slate-900', 'bg-transparent');
        bodyEmanet.setAttribute('style', `background-color: ${aktifKaosRengi} !important;`);
    }
    
    const nav = document.getElementById('ana-nav') || document.querySelector('nav');
    const footer = document.getElementById('ana-footer') || document.querySelector('footer');
    
    if(nav) { 
        nav.classList.remove('bg-zemin'); 
        nav.setAttribute('style', `background-color: ${aktifKaosRengi} !important;`); 
    }
    if(footer) { 
        footer.classList.remove('bg-[#050810]'); 
        footer.setAttribute('style', `background-color: ${aktifKaosRengi} !important;`); 
    }
}

/* =====================================================================
   SİSTEM BAŞLATICI (SAYFA YÜKLENDİĞİNDE)
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Sayfa yüklenir yüklenmez, HERKESE Kaos rengini kafasına vur!
    window.kaosRenginiBas();

    // Ana sayfa elementlerini seç
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
    const lobbyView = document.getElementById('lobby-view');

    // 2. Ana Sayfadaysa ve Zaten Giriş Yapmışsa Sandığı Aç
    if (landingView && dashboardView && localStorage.getItem('me26_user_id') && localStorage.getItem('me26_user_name')) {
        landingView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('flex');
        
        const dashIsim = document.getElementById('dash-isim');
        const dashId = document.getElementById('dash-id-main');
        if(dashIsim) dashIsim.innerText = localStorage.getItem('me26_user_name').toLocaleUpperCase('tr-TR');
        if(dashId) dashId.innerText = localStorage.getItem('me26_user_id');
        
        let savedRef = localStorage.getItem('me26_ref_link');
        if(!savedRef) {
            savedRef = Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem('me26_ref_link', savedRef);
        }
        const davetLinki = document.getElementById('davet-linki');
        if(davetLinki) davetLinki.innerText = "me26.com/davet/REF-" + savedRef;
        
        canliSandigiBaslat();
        kullaniciTeklifleriniGetir();
    }

    // 3. Supabase Google Auth Dinleyicisi
    if(supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                const user = session.user;
                const googleEmail = user.email;
                const googleIsim = user.user_metadata.full_name || "";

                const { data, error } = await supabaseClient.from('uyeler').select('id, isim').eq('email', googleEmail).single();

                // Eğer adamın kaydı varsa direkt içeri al
                if (data) {
                    localStorage.setItem('me26_user_id', data.id);
                    localStorage.setItem('me26_user_name', data.isim);
                    
                    // Sadece ana sayfadaysak animasyon çalışsın, alt sayfadaysa sessizce girsin
                    if(document.getElementById('terminal-view')) {
                        runTerminalAnimation(data.id, data.isim, "Kimlik Doğrulandı. Ağa Bağlanılıyor...");
                    } else {
                        window.kaosRenginiBas();
                    }
                } 
                // Kaydı yoksa e-devlet lobisine yönlendir (Sadece ana sayfadaysa)
                else if(lobbyView && landingView) {
                    pendingGoogleUser.email = googleEmail;
                    document.getElementById('lobby-isim').value = googleIsim;

                    landingView.classList.add('hidden');
                    lobbyView.classList.remove('hidden');
                    lobbyView.classList.add('flex');
                    window.scrollTo(0,0);
                }
            }
        });
    }
});

/* =====================================================================
   GOOGLE GİRİŞİ, KAYIT VE ÇIKIŞ İŞLEMLERİ
   ===================================================================== */
window.googleIleGiris = async function() {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
    } catch (err) { 
        alert("Google bağlantısı kurulamadı. Lütfen tekrar deneyin."); 
    }
};

window.profiliKasayaYaz = async function() {
    const btnSubmit = document.getElementById('btn-lobby-kaydet');
    
    const isim = document.getElementById('lobby-isim').value.trim();
    const telInput = document.getElementById('lobby-telefon').value.trim().replace(/[^0-9]/g, '');
    const tcInput = document.getElementById('lobby-tc').value.trim().replace(/[^0-9]/g, '');
    let durum = document.getElementById('lobby-durum').value;
    const edevletBarkod = document.getElementById('lobby-edevlet').value.trim().toUpperCase();
    const genelOnay = document.getElementById('kvkk-genel-onay').checked;

    if (!isim) { alert("EKSİK BİLGİ: Lütfen adınızı ve soyadınızı girin."); return; }
    if (telInput.length !== 9) { alert("EKSİK BİLGİ: Lütfen telefon numaranızı 9 hane olarak girin."); return; }
    if (tcInput.length !== 11) { alert("EKSİK BİLGİ: Lütfen T.C. Kimlik numaranızı tam 11 hane olarak girin."); return; }
    if (!durum) { alert("EKSİK BİLGİ: Lütfen ağdaki statünüzü seçin."); return; }
    if (durum === "Diğer") {
        const digerAciklama = document.getElementById('lobby-diger-aciklama').value.trim();
        if(!digerAciklama) { alert("EKSİK BİLGİ: Lütfen mesleğinizi yazın."); return; }
        durum = "Diğer: " + digerAciklama;
    }
    if (!edevletBarkod) { alert("GÜVENLİK: e-Devlet barkod numarası güvenlik için zorunludur."); return; }
    if (!genelOnay) { alert("ONAY GEREKLİ: Aydınlatma metnini kabul etmelisiniz."); return; }

    btnSubmit.innerText = "ŞİFRELENİYOR...";
    btnSubmit.disabled = true;

    try {
        const tamTelefon = "05" + telInput;
        const { data, error } = await supabaseClient.from('uyeler').insert([{ 
            isim: isim, 
            email: pendingGoogleUser.email, 
            telefon: tamTelefon, 
            tc_kimlik: tcInput,
            durum: durum, 
            edevlet_barkod: edevletBarkod,
            liyakat_puani: 10
        }]).select();

        if (error) throw error;
        
        const uretilenID = data[0].id;
        localStorage.setItem('me26_user_id', uretilenID);
        localStorage.setItem('me26_user_name', isim);
        
        document.getElementById('lobby-view').classList.add('hidden');
        document.getElementById('lobby-view').classList.remove('flex');
        
        runTerminalAnimation(uretilenID, isim, "Profil Tamamlandı. Lider Onayı Bekleniyor.");
    } catch (err) {
        console.error("Kayıt Hatası:", err);
        if(err.code === '23505' || (err.message && err.message.toLowerCase().includes('duplicate'))) {
            alert("REDDEDİLDİ: Bu Telefon, T.C. Kimlik veya Barkod zaten sisteme kayıtlı.");
        } else {
            alert("Kayıt sırasında sunucu bağlantı hatası oluştu. Lütfen tekrar deneyin.");
        }
        btnSubmit.innerText = "PROFİLİ TAMAMLA VE İÇERİ GİR";
        btnSubmit.disabled = false;
    }
};

window.cikisYap = async function() {
    if(supabaseClient) await supabaseClient.auth.signOut();
    localStorage.removeItem('me26_user_id');
    localStorage.removeItem('me26_user_name');
    localStorage.removeItem('me26_ref_link');
    localStorage.removeItem('me26_kaos_rengi'); // Çıkış yapınca rengi de sıfırla ki bir dahakine yeni renk gelsin!
    document.documentElement.classList.remove('is-logged-in');
    
    // Ana sayfaya yönlendir
    if (window.location.pathname !== '/') {
        window.location.href = '/';
    } else {
        location.reload();
    }
};

/* =====================================================================
   TERMİNAL ANİMASYONU VE SANDIK KURULUMU
   ===================================================================== */
function runTerminalAnimation(globalSmartID, uyeAd, durumMesaji) {
    const topBanner = document.getElementById('top-banner-sayac');
    const landingView = document.getElementById('landing-view');
    const terminalView = document.getElementById('terminal-view');
    const dashboardView = document.getElementById('dashboard-view');
    
    if(!terminalView || !dashboardView) return; 

    if(topBanner) topBanner.classList.add('hidden'); 
    if(landingView) landingView.classList.add('hidden');
    
    terminalView.classList.remove('hidden');
    terminalView.classList.add('flex');
    window.scrollTo(0, 0);

    const terminalContent = document.getElementById('terminal-content');
    const messages = [
        "BAŞLATILIYOR: Şifreli ME26 Bağlantısı...",
        "Güvenlik duvarı aşıldı. Kriptografik tünel açılıyor.",
        `[SİSTEM] ${durumMesaji}`,
        `KÜRESEL ID BELİRLENDİ: ${globalSmartID}`,
        "Ortak akıl oylama sistemine bağlanılıyor..."
    ];

    let delay = 0;
    terminalContent.innerHTML = '';
    messages.forEach((msg) => {
        setTimeout(() => {
            const p = document.createElement('div');
            p.className = 'terminal-text mb-1';
            p.innerHTML = `<span class="text-slate-600 mr-2">[ME26]</span> ${msg}`;
            terminalContent.appendChild(p);
        }, delay);
        delay += 700; 
    });

    setTimeout(() => {
        terminalView.classList.remove('flex', 'hidden');
        terminalView.classList.add('hidden');
        
        document.documentElement.classList.add('is-logged-in'); 
        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('flex');
        
        document.getElementById('dash-isim').innerText = uyeAd.toLocaleUpperCase('tr-TR');
        document.getElementById('dash-id-main').innerText = globalSmartID;
        
        let savedRef = localStorage.getItem('me26_ref_link');
        if(!savedRef) {
            savedRef = Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem('me26_ref_link', savedRef);
        }
        document.getElementById('davet-linki').innerText = "me26.com/davet/REF-" + savedRef;
        
        if(topBanner) topBanner.classList.remove('hidden'); 
        window.scrollTo(0, 0); 

        canliSandigiBaslat();
        kullaniciTeklifleriniGetir();
        
    }, delay + 800);
}

/* =====================================================================
   CANLI OYLAMA (SANDIK) VE TEKLİF SİSTEMİ
   ===================================================================== */
const ANKET_KODU = 'sari_tema_ilk_oylama';

async function canliOylariHesapla() {
    if (!supabaseClient) return;
    const evetOran = document.getElementById('oran-evet');
    const hayirOran = document.getElementById('oran-hayir');
    if(!evetOran || !hayirOran) return;

    try {
        const { data, error } = await supabaseClient.from('oylar').select('tercih, kullanilan_oy_gucu').eq('anket_kodu', ANKET_KODU);
        if (error) throw error;
        let evet = 0, hayir = 0;
        data.forEach(oy => {
            if (oy.tercih === 'EVET') evet += parseFloat(oy.kullanilan_oy_gucu);
            if (oy.tercih === 'HAYIR') hayir += parseFloat(oy.kullanilan_oy_gucu);
        });
        const toplam = evet + hayir;
        evetOran.innerText = toplam > 0 ? `%${Math.round((evet / toplam) * 100).toString().padStart(2, '0')}` : '%--';
        hayirOran.innerText = toplam > 0 ? `%${Math.round((hayir / toplam) * 100).toString().padStart(2, '0')}` : '%--';
    } catch (err) {}
}

function canliSandigiBaslat() {
    canliOylariHesapla(); 
    if(supabaseClient) {
        supabaseClient.channel('oylar_kanali').on('postgres_changes', { event: '*', schema: 'public', table: 'oylar' }, payload => { canliOylariHesapla(); }).subscribe();
    }
}

window.oyKullan = async function(tercih) {
    const globalId = localStorage.getItem('me26_user_id');
    if (!globalId) { alert("Hata: Kimlik bulunamadı."); return; }
    try {
        const { error } = await supabaseClient.from('oylar').upsert({ 
            uye_id: globalId, anket_kodu: ANKET_KODU, tercih: tercih, kullanilan_oy_gucu: 1.0 
        }, { onConflict: 'uye_id,anket_kodu' });
        if (error) throw error;
        
        const overlay = document.getElementById('cetvel-overlay');
        const msg = document.getElementById('cetvel-mesaj');
        const tercihMetni = tercih === 'EVET' ? '<span class="text-yellow-500">EVET</span>' : '<span class="text-gray-400">HAYIR</span>';
        if(msg && overlay) {
            msg.innerHTML = `OYUNUZ AĞA İŞLENDİ: ${tercihMetni}<br><span class="text-xs text-gray-400 mt-2 block font-normal leading-relaxed">Fikrinizi istediğiniz zaman değiştirebilirsiniz.</span>`;
            overlay.classList.add('active');
            setTimeout(() => { overlay.classList.remove('active'); }, 3500);
        } else {
            alert(`OYUNUZ AĞA İŞLENDİ: ${tercih}`);
        }
    } catch (err) { alert("Hata yaşandı. Lütfen tekrar deneyin."); }
};

async function kullaniciTeklifleriniGetir() {
    const globalId = localStorage.getItem('me26_user_id');
    const listeBekleyen = document.getElementById('liste-bekleyen');
    const listeOnaylanan = document.getElementById('liste-onaylanan');
    
    if (!globalId || !supabaseClient || !listeBekleyen || !listeOnaylanan) return;
    try {
        const { data, error } = await supabaseClient.from('anketler').select('baslik, durum').eq('olusturan_id', globalId).order('olusturulma_tarihi', { ascending: false });
        if (error) throw error;
        listeBekleyen.innerHTML = ''; listeOnaylanan.innerHTML = '';
        let bekleyenSayisi = 0, onaylananSayisi = 0;
        data.forEach(teklif => {
            const div = document.createElement('div');
            div.className = 'bg-black border border-slate-800 p-3 rounded text-gray-300 text-xs leading-relaxed font-semibold';
            div.innerText = teklif.baslik;
            if (teklif.durum === 'beklemede') { listeBekleyen.appendChild(div); bekleyenSayisi++; } 
            else if (teklif.durum === 'aktif') { listeOnaylanan.appendChild(div); onaylananSayisi++; }
        });
        if (bekleyenSayisi === 0) listeBekleyen.innerHTML = '<div class="text-[11px] opacity-50 italic">Henüz beklemede olan bir teklifiniz yok.</div>';
        if (onaylananSayisi === 0) listeOnaylanan.innerHTML = '<div class="text-[11px] opacity-50 italic">Henüz ağa açılan bir teklifiniz yok.</div>';
    } catch (err) {}
}

window.teklifGonder = async function() {
    const baslik = document.getElementById('teklif-baslik').value.trim();
    const aciklama = document.getElementById('teklif-aciklama').value.trim();
    const globalId = localStorage.getItem('me26_user_id');

    if(!baslik || !aciklama) { alert("EKSİK BİLGİ: Lütfen başlık ve gerekçe alanlarını doldurun."); return; }
    const anketKodu = 'teklif_' + Date.now();

    try {
        const { error } = await supabaseClient.from('anketler').insert([{
            anket_kodu: anketKodu, olusturan_id: globalId, baslik: baslik, aciklama: aciklama, durum: 'beklemede'
        }]);
        if (error) throw error;
        window.teklifModalKapat();
        kullaniciTeklifleriniGetir();
        
        setTimeout(() => {
            const overlay = document.getElementById('cetvel-overlay');
            const msg = document.getElementById('cetvel-mesaj');
            if(msg && overlay) {
               msg.innerHTML = `TEKLİF AĞA İŞLENDİ<br><span class="text-xs text-gray-400 mt-2 block font-normal leading-relaxed">Güvenlik onayı için Liderler Masası'na iletildi.</span>`;
               overlay.classList.add('active');
               setTimeout(() => { overlay.classList.remove('active'); }, 4000);
            } else { alert("Teklif başarıyla sunuldu."); }
        }, 300);
    } catch (err) { alert("Hata oluştu. Lütfen tekrar deneyin."); }
}

/* =====================================================================
   GERİ SAYIM SAYACI
   ===================================================================== */
const hedefTarih = new Date("May 26, 2026 20:26:00").getTime();
setInterval(function() {
    const simdi = new Date().getTime();
    const fark = hedefTarih - simdi;
    const gerisayimKutusuDis = document.getElementById("top-banner-sayac");
    const gerisayimKutusuIc = document.getElementById("gerisayim-sayaci-ic");
    
    if (fark <= 0) {
        if(gerisayimKutusuDis) {
            gerisayimKutusuDis.innerHTML = "DÜNYA İÇMİMARLAR GÜNÜ KUTLU OLSUN! AĞ AKTİF EDİLDİ.";
            gerisayimKutusuDis.className = "fixed top-0 left-0 w-full bg-kaos text-white font-black text-center py-2 text-xs md:text-sm tracking-widest uppercase z-50 shadow-kaos border-b border-kaos animate-pulse";
        }
        if(gerisayimKutusuIc) {
            gerisayimKutusuIc.innerHTML = "SİSTEM AKTİF! OYUNUZU KULLANIN";
            gerisayimKutusuIc.className = "absolute top-4 right-4 bg-kaos text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest animate-pulse shadow-kaos";
        }
    } else {
        const gun = Math.floor(fark / (1000 * 60 * 60 * 24));
        const saat = Math.floor((fark % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const dakika = Math.floor((fark % (1000 * 60 * 60)) / (1000 * 60));
        const saniye = Math.floor((fark % (1000 * 60)) / 1000);
        
        if(gerisayimKutusuDis) gerisayimKutusuDis.innerHTML = `DÜNYA İÇMİMARLAR GÜNÜ BÜYÜK AÇILIŞINA: <span class="text-black font-black bg-white/20 px-2 py-0.5 rounded ml-1">${gun} GÜN ${saat} SAAT ${dakika} DAKİKA ${saniye} SANİYE</span>`;
        if(gerisayimKutusuIc) gerisayimKutusuIc.innerHTML = `SİSTEMİN AÇILMASINA: ${gun}G ${saat}S ${dakika}D ${saniye}SN`;
    }
}, 1000);

/* =====================================================================
   YARDIMCI FONKSİYONLAR (MODALLAR VE KOPYALAMA)
   ===================================================================== */
window.mobilMenuAc = function() {
    const menu = document.getElementById('mobile-menu');
    if(menu) menu.classList.remove('menu-closed');
};
window.mobilMenuKapat = function() {
    const menu = document.getElementById('mobile-menu');
    if(menu) menu.classList.add('menu-closed');
};
window.teklifModalAc = function() {
    const popup = document.getElementById('teklif-popup');
    const icerik = document.getElementById('teklif-content');
    if(popup && icerik) {
        popup.classList.remove('hidden');
        setTimeout(() => { popup.classList.remove('opacity-0'); icerik.classList.remove('scale-95'); }, 10);
    }
};
window.teklifModalKapat = function() {
    const popup = document.getElementById('teklif-popup');
    const icerik = document.getElementById('teklif-content');
    if(popup && icerik) {
        popup.classList.add('opacity-0'); icerik.classList.add('scale-95');
        setTimeout(() => { popup.classList.add('hidden'); }, 300);
    }
};
window.popUpiAc = function() {
    const popup = document.getElementById('onay-popup');
    const icerik = document.getElementById('popup-content');
    if(popup && icerik) {
        popup.classList.remove('hidden');
        setTimeout(() => { popup.classList.remove('opacity-0'); icerik.classList.remove('scale-95'); }, 10);
    }
};
window.popUpiKapatVeOnayla = function() {
    const popup = document.getElementById('onay-popup');
    const icerik = document.getElementById('popup-content');
    const onayKutusu = document.getElementById('kvkk-genel-onay');
    if(onayKutusu) onayKutusu.checked = true;
    if(popup && icerik) {
        popup.classList.add('opacity-0'); icerik.classList.add('scale-95');
        setTimeout(() => { popup.classList.add('hidden'); }, 300);
    }
};
window.kopyalaLink = function() {
    const link = document.getElementById('davet-linki').innerText;
    navigator.clipboard.writeText(link);
    alert("Davet linki kopyalandı!");
};
window.whatsappPaylas = function() {
    const link = document.getElementById('davet-linki').innerText;
    window.open(`https://api.whatsapp.com/send?text=İçmimarlar otonom ağına katıl: ${link}`, '_blank');
};
window.digerAlanKontrol = function() {
    const secim = document.getElementById('lobby-durum').value;
    const digerKutu = document.getElementById('diger-kutu');
    if(secim === "Diğer" && digerKutu) {
        digerKutu.classList.remove('hidden');
    } else if(digerKutu) {
        digerKutu.classList.add('hidden');
    }
};