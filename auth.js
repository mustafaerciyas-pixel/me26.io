// ============================================================================
// ME26 SİSTEMİ - KİMLİK DOĞRULAMA, SMS VE BELGE DEŞİFRE MOTORU (auth.js)
// ============================================================================

import { auth } from './config.js';
import { supabase } from './supabase.js'; 
import { signInWithPopup, GoogleAuthProvider, signOut, RecaptchaVerifier, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let confirmationResult = null;
let me26Recaptcha = null; 

export async function googleIleGiris() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const gizliPaket = {
            uid: user.uid, g_isim: user.displayName || 'İsimsiz', mail: user.email, foto: user.photoURL || '',
            m_durum: 'Belirsiz', sehir: null, d_kod: 'ME26-TR-' + Math.random().toString(36).substring(2, 6).toUpperCase(), ref: null 
        };

        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });
        if (error) { alert("Giriş veritabanı hatası!"); return null; }
        return data; 
    } catch (error) { alert("Google giriş hatası!"); return null; }
}

export async function sistemdenCikis() {
    try { await signOut(auth); window.location.reload(); } catch (error) { console.error(error); }
}

export async function gercekSmsGonder(phoneNumber) {
    try {
        if (!me26Recaptcha) {
            if (!document.getElementById('izole-recaptcha-odasi')) {
                const div = document.createElement('div');
                div.id = 'izole-recaptcha-odasi';
                document.body.appendChild(div);
            }
            me26Recaptcha = new RecaptchaVerifier(auth, 'izole-recaptcha-odasi', { 
                'size': 'invisible' 
            });
        }

        let formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+90' + phoneNumber.replace(/^0/, '');
        confirmationResult = await linkWithPhoneNumber(auth.currentUser, formattedPhone, me26Recaptcha);
        return true;

    } catch (error) {
        console.error("SMS Hatası Detayı:", error);
        throw error; 
    }
}

export async function gercekSmsDogrula(code, uid, phoneValue) {
    try {
        await confirmationResult.confirm(code);
        await supabase.from('users').update({ telefon: phoneValue }).eq('id', uid);
        return true;
    } catch (error) {
        console.error("Doğrulama Hatası:", error); throw error;
    }
}

export async function eDevletBelgesiOku(file, userUid) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + ' \n';
                }
                
                // 1. ADIM: Tüm metni tek satıra indirgeyip fazla boşlukları sil
                const cleanText = fullText.replace(/\s+/g, ' ');

                // =================================================================
                // ETİKET DURDURUCU MOTOR (Lookahead Regex)
                // =================================================================
                
                // Belgedeki olası tüm ana başlıklar (Durdurucu Duvarlar)
                const duraklar = [
                    "T\\.C\\.", "Kimlik", "Adı\\s*Soyadı", "Baba\\s*Ad[ıi]", "Anne\\s*Ad[ıi]", 
                    "Doğum\\s*Tarihi", "Program", "Fakülte", "Diploma\\s*No", "Diploma\\s*Notu", 
                    "Mezuniyet\\s*Tarihi", "Durum", "İLGİLİ\\s*MAKAMA", "YOK", "Barkod", "Adayın"
                ];

                function veriyiCek(metin, aranacakEtiket) {
                    // Kendi etiketimizi durdurucu listesinden çıkaralım ki kendisinde durmasın
                    const aktifDuraklar = duraklar.filter(d => d !== aranacakEtiket);
                    const durdurucuKural = aktifDuraklar.join("|");
                    
                    // Regex: Aranacak etiket + aradaki işaretler + (istenilen veri) + (durdurucu etiket veya metin sonu)
                    const kural = new RegExp(aranacakEtiket + "\\s*[:|/.-]*\\s*(.*?)(?=" + durdurucuKural + "|$)", "i");
                    const eslesme = metin.match(kural);
                    
                    if (eslesme && eslesme[1]) {
                        let sonuc = eslesme[1].trim();
                        // Kalan sızıntı ayraçları temizle
                        sonuc = sonuc.replace(/^[|:.-]+|[|:.-]+$/g, '').trim();
                        if (sonuc.length > 0 && sonuc.length < 50) {
                            return sonuc;
                        }
                    }
                    return "Bulunamadı";
                }

                // 2. ADIM: Verileri Etiket-Durdurucu Motoruyla Cımbızla
                const tcMatch = cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                const ad_soyad = veriyiCek(cleanText, "Adı\\s*Soyadı");
                let baba_adi = veriyiCek(cleanText, "Baba\\s*Ad[ıi]");
                let anne_adi = veriyiCek(cleanText, "Anne\\s*Ad[ıi]");
                const dogum_tarihi = veriyiCek(cleanText, "Doğum\\s*Tarihi");

                // 3. ADIM: Eski Tip E-Devlet (Baba / Anne Adı : COŞKUN / GÜLER) Kurtarıcısı
                if (baba_adi === "Bulunamadı" && anne_adi === "Bulunamadı") {
                    const ortakRegex = new RegExp("(Baba[\\s/]*Anne|Anne[\\s/]*Baba)\\s*Ad[ıi]\\s*[:|.-]*\\s*(.*?)(?=" + duraklar.filter(d => !d.includes("Ad")).join("|") + "|$)", "i");
                    const ortakEslesme = cleanText.match(ortakRegex);
                    if (ortakEslesme) {
                        const etiketTuru = ortakEslesme[1].toLowerCase();
                        const degerler = ortakEslesme[2].split("/");
                        if (degerler.length >= 2) {
                            if (etiketTuru.startsWith("anne")) {
                                anne_adi = degerler[0].trim();
                                baba_adi = degerler[1].trim();
                            } else {
                                baba_adi = degerler[0].trim();
                                anne_adi = degerler[1].trim();
                            }
                        }
                    }
                }

                const uni_program = veriyiCek(cleanText, "Program");
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = veriyiCek(cleanText, "Diploma\\s*No");
                const diploma_notu = veriyiCek(cleanText, "Diploma\\s*Notu");
                const mezuniyet_tarihi = veriyiCek(cleanText, "Mezuniyet\\s*Tarihi");
                const durum = veriyiCek(cleanText, "Durum");
                
                const barkod = (cleanText.match(/YOK[A-Z0-9]{10,}/i) || cleanText.match(/[A-Z0-9]{12,}/i) || ['Bulunamadı'])[0];
                const tumTarihler = cleanText.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                const belge_tarihi = tumTarihler.length > 0 ? tumTarihler[tumTarihler.length - 1] : 'Bulunamadı';

                const belgeData = { tc, ad_soyad, baba_adi, anne_adi, dogum_tarihi, uni, fakulte, bolum, diploma_no, diploma_notu, mezuniyet_tarihi, durum, barkod, belge_tarihi, belge_durumu: "Onay Bekliyor" };

                const { error } = await supabase.rpc('me26_belge_yukle', { p_uid: userUid, p_data: belgeData });
                if (error) reject("Belge kaydedilemedi."); else resolve(belgeData);
            } catch (error) { reject("PDF okunamadı."); }
        };
        reader.readAsArrayBuffer(file);
    });
}
