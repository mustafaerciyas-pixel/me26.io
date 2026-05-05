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

                const regexDuvar = "(?=Baba Adı|Anne Adı|Doğum Tarihi|Kimlik|T\\.C\\.|Program|Fakülte|TC|Uyruğu|Anne|Baba)";
                const ad_soyad = (cleanText.match(new RegExp(`Adı\\s*Soyadı\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvar, 'i')) || [])[1]?.trim() || 'Bulunamadı';
                
                let baba_adi = 'Bulunamadı';
                let anne_adi = 'Bulunamadı';

                // =================================================================
                // YENİ: ZIRHLI ANNE/BABA PARSER'I (Sırayı ve birleşik yazımları tanır)
                // =================================================================
                
                // Belgedeki Anne/Baba satırını komple yakala (Sıra "Anne / Baba" mı yoksa "Baba / Anne" mi kontrol eder)
                const anneBabaSatiri = cleanText.match(/(Anne[\s\/]*Baba|Baba[\s\/]*Anne)\s*Ad[ıi][\s:]*(.*?)(?=Doğum|Kimlik|T\.C\.|Uyruğu|Program|Kayıt|Fakülte|TC|Cinsiyeti)/i);

                if (anneBabaSatiri && anneBabaSatiri[2]) {
                    const sira = anneBabaSatiri[1].toLowerCase(); 
                    const isAnneFirst = sira.startsWith('anne'); // Önce anne adı mı yazıyor?
                    let icerik = anneBabaSatiri[2].trim();

                    if (icerik.includes('/')) {
                        // Eğer arada slash kalmışsa temiz temiz böleriz
                        const parcalar = icerik.split('/');
                        const isim1 = parcalar[0].replace(/[:]/g, '').trim();
                        const isim2 = parcalar[1].replace(/[:]/g, '').trim();

                        if (isAnneFirst) {
                            anne_adi = isim1; baba_adi = isim2;
                        } else {
                            baba_adi = isim1; anne_adi = isim2;
                        }
                    } else {
                        // PDF slash'ı yutup isimleri yapıştırmışsa (Örn: GÜLER COŞKUN)
                        const kelimeler = icerik.split(/\s+/);
                        if (kelimeler.length >= 2) {
                            if (isAnneFirst) {
                                baba_adi = kelimeler.pop().trim(); // Son kelime babadır
                                anne_adi = kelimeler.join(' ').trim(); // Kalan baş taraf annedir
                            } else {
                                anne_adi = kelimeler.pop().trim(); // Son kelime annedir
                                baba_adi = kelimeler.join(' ').trim(); // Kalan baş taraf babadır
                            }
                        } else {
                            // Tek bir kelime okuyabildiyse
                            if (isAnneFirst) anne_adi = icerik;
                            else baba_adi = icerik;
                        }
                    }
                } else {
                    // Eğer tamamen ayrı ayrı satırlardaysa
                    const regexDuvarAna = "(?=Doğum|Kimlik|T\\.C\\.|Program|Fakülte|TC|Uyruğu|Anne|Baba|Adı|Soyadı)";
                    const ayriBaba = cleanText.match(new RegExp(`Baba\\s*Ad[ıi]\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvarAna, 'i'));
                    const ayriAnne = cleanText.match(new RegExp(`Anne\\s*Ad[ıi]\\s*[:\\s]*([A-ZÇĞİÖŞÜa-zçğıöşü\\s]+?)` + regexDuvarAna, 'i'));
                    
                    if (ayriBaba) baba_adi = ayriBaba[1].replace(/[\/:-]/g, '').trim();
                    if (ayriAnne) anne_adi = ayriAnne[1].replace(/[\/:-]/g, '').trim();
                }

                // Emniyet Kemeri: Eğer bir isim 25 karakterden uzunsa okuma hatasıdır, sadece ilk kelimesini al.
                if (baba_adi.length > 25) baba_adi = baba_adi.split(/\s+/)[0];
                if (anne_adi.length > 25) anne_adi = anne_adi.split(/\s+/)[0];
                
                // =================================================================

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
