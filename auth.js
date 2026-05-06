// ============================================================================
// ME26 SİSTEMİ - ÇELİK KAPI (auth.js)
// Kimlik Doğrulama, SMS Bot Koruması ve E-Devlet PDF Deşifre Motoru
// ============================================================================

import { STATE } from './state.js'; 
import { auth } from './config.js';
import { DB, supabase } from './supabase.js'; // DÜZELTME: DB motorunu içeri aldık
import { signInWithPopup, GoogleAuthProvider, signOut, RecaptchaVerifier, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let confirmationResult = null; 
let me26Recaptcha = null; 

// 1. GOOGLE İLE GİRİŞ MOTORU
export async function googleIleGiris() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        const gizliPaket = {
            uid: user.uid, 
            g_isim: user.displayName || 'İsimsiz', 
            mail: user.email, 
            foto: user.photoURL || '',
            m_durum: 'Belirsiz', 
            sehir: null, 
            d_kod: 'ME26-TR-' + Math.random().toString(36).substring(2, 6).toUpperCase(), 
            ref: null 
        };

        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });
        if (error) { alert("Giriş veritabanı hatası!"); return null; }
        return data; 
    } catch (error) { alert("Google giriş hatası!"); return null; }
}

// 2. ÇIKIŞ MOTORU
export async function sistemdenCikis() {
    try { 
        await signOut(auth); 
        STATE.clearSession(); 
        window.location.reload(); 
    } catch (error) { console.error(error); }
}

// 3. SMS GÖNDERME MOTORU (BOT KORUMASI)
export async function gercekSmsGonder(phoneNumber) {
    try {
        if (!auth.currentUser) {
            throw new Error("Oturum bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.");
        }

        let cleanedPhone = phoneNumber.replace(/\D/g, ''); 
        
        if (cleanedPhone.startsWith('90')) cleanedPhone = cleanedPhone.substring(2);
        if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.substring(1);

        if (cleanedPhone.length !== 10 || !cleanedPhone.startsWith('5')) {
            throw new Error("Telefon numarası 5 ile başlayan 10 haneli GSM numarası olmalı.");
        }

        const formattedPhone = `+90${cleanedPhone}`;

        if (me26Recaptcha) {
            try { me26Recaptcha.clear(); } catch(e) {}
            me26Recaptcha = null;
        }

        let recaptchaDiv = document.getElementById('recaptcha-container');
        if (!recaptchaDiv) {
            recaptchaDiv = document.createElement('div');
            recaptchaDiv.id = 'recaptcha-container';
            recaptchaDiv.style.display = 'none'; 
            document.body.appendChild(recaptchaDiv);
        }

        me26Recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
        confirmationResult = await linkWithPhoneNumber(auth.currentUser, formattedPhone, me26Recaptcha);
        return true;

    } catch (error) {
        console.error("SMS Hatası Detayı:", error);
        
        let errorMsg = error.message || String(error);
        const errCode = error.code || '';

        if (errCode === 'auth/too-many-requests') {
            errorMsg = "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
        } else if (errCode === 'auth/invalid-phone-number') {
            errorMsg = "Telefon numarası geçersiz.";
        } else if (errCode === 'auth/captcha-check-failed') {
            errorMsg = "Güvenlik doğrulaması başarısız oldu. Sayfayı yenileyip tekrar deneyin.";
        } else if (errCode === 'auth/provider-already-linked' || errCode === 'auth/credential-already-in-use') {
            errorMsg = "Bu hesaba telefon doğrulaması zaten bağlı görünüyor.";
        } else if (!error.message.includes("Google") && !error.message.includes("GSM")) {
            errorMsg = "SMS gönderilemedi. Lütfen tekrar deneyin.";
        }

        throw new Error(errorMsg); 
    }
}

// 4. SMS DOĞRULAMA MOTORU
export async function gercekSmsDogrula(code, uid, phoneValue) {
    try {
        if (!confirmationResult) throw new Error("Önce SMS gönderilmelidir.");

        await confirmationResult.confirm(code);
        
        // DÜZELTME: Doğrudan tabloyu güncellemek yerine Karanlık Oda (RPC) Robotumuzu kullanıyoruz!
        await DB.telefonuOnayla(uid, phoneValue);

        STATE.updateUser('hasPhone', true);
        STATE.updateUser('authStage', 'phone_verified');

        return true;
    } catch (error) {
        console.error("Doğrulama Hatası:", error); 
        throw error;
    }
}

// 5. E-DEVLET AKILLI BELGE OKUYUCU MOTORU
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

                const tcMatch = cleanText.match(/(?:T\.C\.|Kimlik)[\s\S]*?(?:Numarası|No)[\s|:.-]*(\d{11})/i) || cleanText.match(/(\d{11})/);
                const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';

                const regexDuvar = "(?=Baba\\s*Ad|Anne\\s*Ad|Doğum\\s*Tarihi|Kimlik|T\\.C\\.|Program|Fakülte|TC|Uyruğu|Diploma|Mezuniyet|Durum|İLGİLİ)";
                
                const ad_soyad_raw = (cleanText.match(new RegExp(`Adı\\s*Soyadı[\\s|:.-]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1] || 'Bulunamadı';
                const ad_soyad = ad_soyad_raw.replace(/[|:.-]+/g, '').trim();

                let baba_adi_raw = (cleanText.match(new RegExp(`Baba\\s*Ad[ıi][\\s|:.-]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1] || 'Bulunamadı';
                let baba_adi = baba_adi_raw.replace(/[|:.-]+/g, '').trim();

                let anne_adi_raw = (cleanText.match(new RegExp(`Anne\\s*Ad[ıi][\\s|:.-]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1] || 'Bulunamadı';
                let anne_adi = anne_adi_raw.replace(/[|:.-]+/g, '').trim();

                if (baba_adi === 'Bulunamadı' && anne_adi === 'Bulunamadı') {
                    const ortak_raw = (cleanText.match(new RegExp(`(?:Baba[\\s/]*Anne|Anne[\\s/]*Baba)\\s*Ad[ıi][\\s|:.-]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s/]+?)` + regexDuvar, 'i')) || [])[1];
                    if (ortak_raw) {
                        const parts = ortak_raw.split('/');
                        if (parts.length >= 2) {
                            if (/Anne[\s/]*Baba/i.test(cleanText)) {
                                anne_adi = parts[0].replace(/[|:.-]+/g, '').trim();
                                baba_adi = parts[1].replace(/[|:.-]+/g, '').trim();
                            } else {
                                baba_adi = parts[0].replace(/[|:.-]+/g, '').trim();
                                anne_adi = parts[1].replace(/[|:.-]+/g, '').trim();
                            }
                        }
                    }
                }

                const dogum_tarihi = (cleanText.match(/Doğum\s*Tarihi[\s|:.-]*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || 'Bulunamadı';
                
                const uni_program_raw = (cleanText.match(/Program[\s|:.-]*([\s\S]+?)(?=Diploma No|Kayıt Tarihi|Genel Not|Diploma Notu)/i) || [])[1] || '';
                const uni_program = uni_program_raw.replace(/[|:.-]+$/, '').trim();
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = (cleanText.match(/Diploma\s*No[\s|:.-]*([A-Z0-9.\-]+)/i) || [])[1] || 'Bulunamadı';
                const diploma_notu = (cleanText.match(/Diploma\s*Notu[\s|:.-]*([\d.,]+\s*\/\s*[\d.,]+)/i) || [])[1]?.trim() || 'Bulunamadı';
                const mezuniyet_tarihi = (cleanText.match(/Mezuniyet\s*Tarihi[\s|:.-]*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || 'Bulunamadı';
                const durum = (cleanText.match(/Durum[\s|:.-]*([a-zA-ZÇĞİÖŞÜçğıöşü]+)/i) || [])[1] || 'Bulunamadı';
                
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
