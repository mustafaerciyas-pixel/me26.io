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
                // "BU KADAR BASİT" MOTORU 
                // E-Devlet belgelerinde değerler daima BÜYÜK HARFLE, 
                // Etiketler ise 'Baba Adı' gibi İlk Harfi Büyük yazılır.
                // Bu kod yalnızca başlığın yanındaki BÜYÜK HARFLİ isimleri okur, 
                // sıradaki başlığın küçük harfini gördüğü an otomatik durur.
                // =================================================================
                
                const extractIsim = (etiket) => {
                    const regex = new RegExp(etiket + "\\s*[:|]?\\s*([A-ZÇĞİÖŞÜ]+(?:\\s+[A-ZÇĞİÖŞÜ]+)*)");
                    const match = cleanText.match(regex);
                    return match ? match[1].trim() : 'Bulunamadı';
                };

                const extractTarih = (etiket) => {
                    const regex = new RegExp(etiket + "\\s*[:|]?\\s*(\\d{2}\\.\\d{2}\\.\\d{4})");
                    const match = cleanText.match(regex);
                    return match ? match[1] : 'Bulunamadı';
                };

                const tcMatch = cleanText.match(/(?:T\.C\.|Kimlik)[\s\S]*?(?:No|Numarası)\s*[:|]?\s*(\d{11})/i) || cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                // İsim, Anne ve Babayı tertemiz çekiyoruz
                const ad_soyad = extractIsim("Adı\\s*Soyadı");
                const baba_adi = extractIsim("Baba\\s*Ad[ıi]");
                const anne_adi = extractIsim("Anne\\s*Ad[ıi]");
                
                // Tarihleri çekiyoruz
                const dogum_tarihi = extractTarih("Doğum\\s*Tarihi");
                const mezuniyet_tarihi = extractTarih("Mezuniyet\\s*Tarihi");

                // Program ve Fakülte ayrıştırması
                const programMatch = cleanText.match(/Program\s*[:|]?\s*(.*?)(?=\s*Diploma|\s*Kayıt|\s*Durum)/i);
                const uni_program = programMatch ? programMatch[1].trim() : 'Bulunamadı';
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim();

                const dipNoMatch = cleanText.match(/Diploma\s*No\s*[:|]?\s*([A-Z0-9.\-]+)/i);
                const diploma_no = dipNoMatch ? dipNoMatch[1].trim() : 'Bulunamadı';

                const dipNotMatch = cleanText.match(/Diploma\s*Notu\s*[:|]?\s*([\d.,]+\s*\/\s*[\d.,]+)/i);
                const diploma_notu = dipNotMatch ? dipNotMatch[1].trim() : 'Bulunamadı';

                const durum = extractIsim("Durum");

                const barkod = (cleanText.match(/YOK[A-Z0-9]{10,}/i) || cleanText.match(/[A-Z0-9]{12,}/i) || ['Bulunamadı'])[0];
                const tumTarihler = cleanText.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                const belge_tarihi = tumTarihler.length > 0 ? tumTarihler[0] : 'Bulunamadı';

                const belgeData = { tc, ad_soyad, baba_adi, anne_adi, dogum_tarihi, uni, fakulte, bolum, diploma_no, diploma_notu, mezuniyet_tarihi, durum, barkod, belge_tarihi, belge_durumu: "Onay Bekliyor" };

                const { error } = await supabase.rpc('me26_belge_yukle', { p_uid: userUid, p_data: belgeData });
                if (error) reject("Belge kaydedilemedi."); else resolve(belgeData);
            } catch (error) { reject("PDF okunamadı."); }
        };
        reader.readAsArrayBuffer(file);
    });
}
