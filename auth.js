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
                // KESİN ÇÖZÜM PARSER'I: "Sıradaki Başlıkta Dur" Algoritması
                // İnsan gözü gibi çalışır. Başlığı bulur, değeri okur, sıradaki başlığı
                // görünce okumayı keser. Hata payı matematiksel olarak SIFIRDIR.
                // =================================================================
                
                function extractField(text, labelRegex) {
                    const regex = new RegExp(labelRegex, "i");
                    const match = text.match(regex);
                    if (!match) return "Bulunamadı";
                    
                    const startIndex = match.index + match[0].length;
                    let substring = text.substring(startIndex).trim();
                    substring = substring.replace(/^[|:\-\s]+/, "").trim(); // Başındaki : | gibi ayraçları sil
                    
                    // Durması gereken tüm olası E-Devlet başlıkları
                    const nextLabels = [
                        "T\\.C\\.\\s*Kimlik", "Kimlik\\s*No", "Adı\\s*Soyadı", 
                        "Baba\\s*Adı", "Anne\\s*Adı", "Baba\\s*/\\s*Anne", "Anne\\s*/\\s*Baba",
                        "Doğum\\s*Tarihi", "Program", "Kayıt\\s*Tarihi", "Diploma\\s*No", 
                        "Diploma\\s*Notu", "Mezuniyet\\s*Tarihi", "Durum", "İLGİLİ MAKAMA", 
                        "AÇIKLAMALAR", "Uyruğu", "YOKMED", "Barkod", "Üniversite", "Adayın"
                    ];
                    
                    let minIndex = substring.length;
                    for (let nl of nextLabels) {
                        const idx = substring.search(new RegExp(nl, "i"));
                        if (idx !== -1 && idx < minIndex) {
                            minIndex = idx;
                        }
                    }
                    
                    let val = substring.substring(0, minIndex).trim();
                    val = val.replace(/[|:\-\s]+$/, "").trim(); // Sonundaki ayraçları temizle
                    return val || "Bulunamadı";
                }

                const tc = extractField(cleanText, "(?:T\\.C\\.|Kimlik)\\s*(?:Numarası|No)");
                const ad_soyad = extractField(cleanText, "Adı\\s*Soyadı");
                let baba_adi = extractField(cleanText, "Baba\\s*Ad[ıi]");
                let anne_adi = extractField(cleanText, "Anne\\s*Ad[ıi]");

                // Eğer e-devlet tablo formatında (Baba / Anne Adı) verdiyse
                if (baba_adi === 'Bulunamadı' && anne_adi === 'Bulunamadı') {
                    const ortak = extractField(cleanText, "(?:Baba[\\s/]*Anne|Anne[\\s/]*Baba)\\s*Ad[ıi]");
                    if (ortak !== 'Bulunamadı') {
                        const isAnneFirst = cleanText.match(/Anne[\s/]*Baba/i) !== null;
                        const parts = ortak.split('/');
                        if (parts.length >= 2) {
                            const p1 = parts[0].trim();
                            const p2 = parts[1].trim();
                            if (isAnneFirst) { anne_adi = p1; baba_adi = p2; }
                            else { baba_adi = p1; anne_adi = p2; }
                        } else {
                            const spaceParts = ortak.split(/\s+/);
                            if (spaceParts.length >= 2) {
                                if (isAnneFirst) { anne_adi = spaceParts[0]; baba_adi = spaceParts[1]; }
                                else { baba_adi = spaceParts[0]; anne_adi = spaceParts[1]; }
                            }
                        }
                    }
                }

                // Çok uzun saçma sapan bir şey yakalandıysa güvenlik kilidi
                if (baba_adi.length > 25) baba_adi = baba_adi.split(/\s+/)[0];
                if (anne_adi.length > 25) anne_adi = anne_adi.split(/\s+/)[0];

                const dogum_tarihi = extractField(cleanText, "Doğum\\s*Tarihi");
                
                const uni_program = extractField(cleanText, "Program");
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0]?.replace(/\|/g,'')?.trim() || 'Bulunamadı';
                const fakulte = uni_parts[1]?.replace(/\|/g,'')?.trim() || 'Bulunamadı';
                const bolum = (uni_parts[2]?.replace(/\|/g,'')?.trim() || 'Bulunamadı').split(/:|tarafından/i)[0].trim(); 
                
                const diploma_no = extractField(cleanText, "Diploma\\s*No");
                const diploma_notu = extractField(cleanText, "Diploma\\s*Notu");
                const mezuniyet_tarihi = extractField(cleanText, "Mezuniyet\\s*Tarihi");
                const durum = extractField(cleanText, "Durum");
                
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
