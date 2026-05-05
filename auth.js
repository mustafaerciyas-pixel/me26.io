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
                // YENİ NESİL, SIFIR HATA PARSER (DURAKLAMA MANTIĞI)
                // =================================================================
                // Etiketlerin arasına ne girerse girsin, bir sonraki etiketi görene kadar 
                // olan metni alır ve gereksiz sembolleri temizler.
                
                const duraklar = ["Baba", "Anne", "Doğum", "Kimlik", "T\\.C\\.", "Program", "Fakülte", "Adı Soyadı", "Uyruğu", "Diploma", "Mezuniyet", "Durum", "YOK"];
                
                function extractSafe(text, label) {
                    const stopRegex = duraklar.join('|');
                    const r = new RegExp(label + "\\s*[|:.-]*\\s*([^]+?)(?=" + stopRegex + "|$)", "i");
                    const m = text.match(r);
                    if (m) {
                        let val = m[1].replace(/^[|:.\\-\\s]+/, '').replace(/[|:.\\-\\s]+$/, '').trim();
                        if (val.length > 0 && val.length < 50) return val;
                    }
                    return 'Bulunamadı';
                }

                const tcMatch = cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                const ad_soyad = extractSafe(cleanText, "Adı\\s*Soyadı");
                let baba_adi = extractSafe(cleanText, "Baba\\s*Ad[ıi]");
                let anne_adi = extractSafe(cleanText, "Anne\\s*Ad[ıi]");

                // Eğer e-devlet isimleri yan yana tabloda verdiyse (Baba / Anne Adı : COŞKUN / GÜLER)
                if (baba_adi === 'Bulunamadı' && anne_adi === 'Bulunamadı') {
                    const ortak = cleanText.match(/(?:Baba[\s/]*Anne|Anne[\s/]*Baba)\s*Ad[ıi]\s*[:|.-]*\s*([^]+?)(?=Doğum|Kimlik|Program|Fakülte|Uyruğu)/i);
                    if (ortak) {
                        let val = ortak[1].trim();
                        let parts = val.split('/');
                        if(parts.length >= 2) {
                            if (ortak[0].toLowerCase().startsWith('anne')) {
                                anne_adi = parts[0].replace(/[:|.-]/g, '').trim();
                                baba_adi = parts[1].replace(/[:|.-]/g, '').trim();
                            } else {
                                baba_adi = parts[0].replace(/[:|.-]/g, '').trim();
                                anne_adi = parts[1].replace(/[:|.-]/g, '').trim();
                            }
                        }
                    }
                }

                // =================================================================
                
                const sep = "[\\s|:.-]*";
                const dogum_tarihi = (cleanText.match(new RegExp(`Doğum\\s*Tarihi${sep}(\\d{2}\\.\\d{2}\\.\\d{4})`, 'i')) || [])[1] || 'Bulunamadı';
                
                const uni_program = (cleanText.match(new RegExp(`Program${sep}([^\\n\\r]+?)(?=Diploma No|Kayıt Tarihi|Genel Not)`, 'i')) || [])[1] || '';
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.replace(/\|/g,'')?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.replace(/\|/g,'')?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.replace(/\|/g,'')?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = (cleanText.match(new RegExp(`Diploma\\s*No${sep}([^\\s]+)`, 'i')) || [])[1] || 'Bulunamadı';
                const diploma_notu = (cleanText.match(new RegExp(`Diploma\\s*Notu${sep}([\\d\\.\\s\\/]+?)(?=Mezuniyet)`, 'i')) || [])[1]?.trim() || 'Bulunamadı';
                const mezuniyet_tarihi = (cleanText.match(new RegExp(`Mezuniyet\\s*Tarihi${sep}(\\d{2}\\.\\d{2}\\.\\d{4})`, 'i')) || [])[1] || 'Bulunamadı';
                const durum = (cleanText.match(new RegExp(`Durum${sep}([a-zA-ZÇĞİÖŞÜçğıöşü]+)`, 'i')) || [])[1] || 'Bulunamadı';
                
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
