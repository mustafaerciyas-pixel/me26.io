// ============================================================================
// ME26 SİSTEMİ - KİMLİK DOĞRULAMA, SMS VE BELGE DEŞİFRE MOTORU (auth.js)
// ============================================================================

import { auth } from './config.js';
import { supabase } from './supabase.js'; 
import { signInWithPopup, GoogleAuthProvider, signOut, RecaptchaVerifier, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let confirmationResult = null;
let me26Recaptcha = null; // İzole ve takılmayan motor hafızası

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
        // ZARİF VE İZOLE KURULUM: Motoru senin butonuna değil, bağımsız görünmez odaya kuruyoruz.
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

                const tcMatch = cleanText.match(/(?:T\.C\.|Kimlik)[\s\S]*?(?:Numarası|No)\s*[:\s]*(\d{11})/i) || cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                const regexDuvar = "(?=Baba Adı|Anne Adı|Doğum Tarihi|Kimlik|T\\.C\\.|Program|Fakülte|TC|Uyruğu)";
                const ad_soyad = (cleanText.match(new RegExp(`Adı\\s*Soyadı\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1]?.trim() || 'Bulunamadı';
                
                let baba_adi = 'Bulunamadı';
                let anne_adi = 'Bulunamadı';

                // YENİ: E-Devlet özel tablo formatı yakalayıcısı ("COŞKUN / GÜLER" gibi aradaki slash'ı bulur)
                const birlesikAnneBaba = cleanText.match(/(?:Baba|Anne)[^\/]*\/[^\/]*(?:Adı)[\s:]*([A-ZÇĞİÖŞÜa-zçğıöşü\s]+?)\s*\/\s*([A-ZÇĞİÖŞÜa-zçğıöşü\s]+?)(?=Doğum|Kimlik|T\.C\.|Program|Fakülte|Uyruğu)/i);
                
                if (birlesikAnneBaba) {
                    baba_adi = birlesikAnneBaba[1].trim();
                    anne_adi = birlesikAnneBaba[2].trim();
                } else {
                    // Normal ayrı yazılmışsa klasik yöntemle bul
                    baba_adi = (cleanText.match(new RegExp(`Baba\\s*Adı\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1]?.trim() || 'Bulunamadı';
                    anne_adi = (cleanText.match(new RegExp(`Anne\\s*Adı\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1]?.trim() || 'Bulunamadı';
                }

                const dogum_tarihi = (cleanText.match(/Doğum\s*Tarihi\s*[:\s]*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || 'Bulunamadı';
                
                const uni_program = (cleanText.match(/Program\s*[:\s]*([^\n\r]+?)(?=Diploma No|Kayıt Tarihi|Genel Not)/i) || [])[1] || '';
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = (cleanText.match(/Diploma\s*No\s*[:\s]*([^\s]+)/i) || [])[1] || 'Bulunamadı';
                const diploma_notu = (cleanText.match(/Diploma\s*Notu\s*[:\s]*([\d\.\s\/]+?)(?=Mezuniyet)/i) || [])[1]?.trim() || 'Bulunamadı';
                const mezuniyet_tarihi = (cleanText.match(/Mezuniyet\s*Tarihi\s*[:\s]*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || 'Bulunamadı';
                const durum = (cleanText.match(/Durum\s*[:\s]*([a-zA-ZÇĞİÖŞÜçğıöşü]+)/i) || [])[1] || 'Bulunamadı';
                
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
