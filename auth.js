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
                const cleanText = fullText.replace(/\s+/g, ' ');

                // =================================================================
                // YENİ MOTOR: YANINDAKİNİ AL (Kullanıcı Mantığı)
                // Sistemi: "Etiketi bul. Sıradaki etiketlerden birini görene kadar aradaki metni çek al."
                // =================================================================
                
                function yanindakiniAl(metin, aranacakBaslik, siradakiBasliklar) {
                    const baslikRegex = new RegExp(aranacakBaslik + "[\\s|:.-]*", "i");
                    const match = metin.match(baslikRegex);
                    if (!match) return "Bulunamadı";

                    // Başlığın bittiği yerden sonrasını alıyoruz
                    const kalanMetin = metin.substring(match.index + match[0].length);
                    
                    // Sıradaki etiketleri duvara çeviriyoruz
                    const durdurucuDuvar = new RegExp("(?=" + siradakiBasliklar.join("|") + ")", "i");
                    
                    // Metni duvara kadar kesiyoruz
                    const alinacakKisim = kalanMetin.split(durdurucuDuvar)[0];

                    // Başındaki/sonundaki ayraç ve boşlukları silip gönderiyoruz
                    return alinacakKisim.replace(/^[|:.-]+|[|:.-]+$/g, '').trim() || "Bulunamadı";
                }

                const tcMatch = cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                const ad_soyad = yanindakiniAl(cleanText, "Adı\\s*Soyadı", ["Baba", "Anne", "Doğum", "T\\.C\\.", "Kimlik"]);
                
                let baba_adi = "Bulunamadı";
                let anne_adi = "Bulunamadı";

                // Eğer belge eski formatta gelirse (Baba / Anne Adı : COŞKUN / GÜLER)
                const ortakFormat = yanindakiniAl(cleanText, "(?:Baba[\\s/]*Anne|Anne[\\s/]*Baba)\\s*Ad[ıi]", ["Doğum", "Program", "Kimlik"]);
                
                if (ortakFormat !== "Bulunamadı") {
                    const isAnneFirst = /Anne[\s/]*Baba/i.test(cleanText);
                    const parts = ortakFormat.split('/');
                    if (parts.length >= 2) {
                        if (isAnneFirst) {
                            anne_adi = parts[0].trim();
                            baba_adi = parts[1].trim();
                        } else {
                            baba_adi = parts[0].trim();
                            anne_adi = parts[1].trim();
                        }
                    }
                } else {
                    // Senin söylediğin o basit mantık devrede:
                    baba_adi = yanindakiniAl(cleanText, "Baba\\s*Ad[ıi]", ["Anne", "Doğum", "Program", "Kimlik"]);
                    anne_adi = yanindakiniAl(cleanText, "Anne\\s*Ad[ıi]", ["Baba", "Doğum", "Program", "Kimlik"]);
                }

                const dogum_tarihi = yanindakiniAl(cleanText, "Doğum\\s*Tarihi", ["Program", "Diploma", "Kimlik", "Baba", "Anne"]);
                
                const uni_program = yanindakiniAl(cleanText, "Program", ["Diploma", "Mezuniyet", "Kayıt", "Durum"]);
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = yanindakiniAl(cleanText, "Diploma\\s*No", ["Diploma\\s*Notu", "Mezuniyet", "Durum"]);
                const diploma_notu = yanindakiniAl(cleanText, "Diploma\\s*Notu", ["Mezuniyet", "Durum"]);
                const mezuniyet_tarihi = yanindakiniAl(cleanText, "Mezuniyet\\s*Tarihi", ["Durum", "Diploma", "İLGİLİ"]);
                const durum = yanindakiniAl(cleanText, "Durum", ["İLGİLİ", "AÇIKLAMALAR", "YOK", "Barkod"]);
                
                const barkod = (cleanText.match(/YOK[A-Z0-9]{10,}/i) || cleanText.match(/[A-Z0-9]{12,}/i) || ['Bulunamadı'])[0];
                const tumTarihler = cleanText.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                const belge_tarihi = tumTarihler.length > 0 ? tumTarihler[0] : 'Bulunamadı'; // Belgenin asıl tarihi genelde ilk tarihtir

                const belgeData = { tc, ad_soyad, baba_adi, anne_adi, dogum_tarihi, uni, fakulte, bolum, diploma_no, diploma_notu, mezuniyet_tarihi, durum, barkod, belge_tarihi, belge_durumu: "Onay Bekliyor" };

                const { error } = await supabase.rpc('me26_belge_yukle', { p_uid: userUid, p_data: belgeData });
                if (error) reject("Belge kaydedilemedi."); else resolve(belgeData);
            } catch (error) { reject("PDF okunamadı."); }
        };
        reader.readAsArrayBuffer(file);
    });
}
