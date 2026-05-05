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
                
                // PDF okuyucunun parçaladığı metni tek satıra sıkıştırır
                const cleanText = fullText.replace(/\s+/g, ' ');

                // =================================================================
                // YENİ MOTOR: BAŞLIKLAR ARASI (Aralık Bulucu) MANTIK
                // "baslangic" etiketinden başla, "bitis" etiketini görene kadar al!
                // =================================================================
                function aradakiMetniAl(metin, baslangic, bitis) {
                    // (?:[|:.-]\s*)* kısmı = başlığın yanındaki süslemeleri es geçer
                    // (.*?) kısmı = alacağımız gerçek veridir
                    const kural = new RegExp(baslangic + "\\s*(?:[|:.-]\\s*)*(.*?)\\s*" + bitis, "i");
                    const eslesme = metin.match(kural);
                    return eslesme ? eslesme[1].trim() : "Bulunamadı";
                }

                // 1. TAM LİSTEYE GÖRE NOKTA ATIŞI VERİ ÇEKİMİ
                const tc = aradakiMetniAl(cleanText, "(?:T\\.C\\.|Kimlik).*?(?:No|Numarası)", "Adı\\s*Soyadı");
                const ad_soyad = aradakiMetniAl(cleanText, "Adı\\s*Soyadı", "Baba\\s*Ad[ıi]");
                let baba_adi = aradakiMetniAl(cleanText, "Baba\\s*Ad[ıi]", "Anne\\s*Ad[ıi]");
                let anne_adi = aradakiMetniAl(cleanText, "Anne\\s*Ad[ıi]", "Doğum\\s*Tarihi");

                // Eğer e-devlet Baba ve Anneyi tek satırda (Baba / Anne Adı) verdiyse
                if (baba_adi === "Bulunamadı" && anne_adi === "Bulunamadı") {
                    const ortak = aradakiMetniAl(cleanText, "(?:Baba[\\s/]*Anne|Anne[\\s/]*Baba)\\s*Ad[ıi]", "Doğum\\s*Tarihi");
                    if (ortak !== "Bulunamadı") {
                        const parcalar = ortak.split('/');
                        if (parcalar.length >= 2) {
                            if (/Anne[\s/]*Baba/i.test(cleanText)) {
                                anne_adi = parcalar[0].trim();
                                baba_adi = parcalar[1].trim();
                            } else {
                                baba_adi = parcalar[0].trim();
                                anne_adi = parcalar[1].trim();
                            }
                        }
                    }
                }

                const dogum_tarihi = aradakiMetniAl(cleanText, "Doğum\\s*Tarihi", "Program");
                
                // Program satırını alıp üçe bölüyoruz (Üniversite / Fakülte / Bölüm)
                const tam_program = aradakiMetniAl(cleanText, "Program", "Diploma\\s*No");
                const uni_parts = tam_program.split('/');
                const uni = uni_parts[0] ? uni_parts[0].trim() : 'Bulunamadı';
                const fakulte = uni_parts[1] ? uni_parts[1].trim() : 'Bulunamadı';
                const bolum = uni_parts[2] ? uni_parts[2].trim() : 'Bulunamadı';

                const diploma_no = aradakiMetniAl(cleanText, "Diploma\\s*No", "Diploma\\s*Notu");
                const diploma_notu = aradakiMetniAl(cleanText, "Diploma\\s*Notu", "Mezuniyet\\s*Tarihi");
                const mezuniyet_tarihi = aradakiMetniAl(cleanText, "Mezuniyet\\s*Tarihi", "Durum");
                const durum = aradakiMetniAl(cleanText, "Durum", "(?:İLGİLİ\\s*MAKAMA|AÇIKLAMALAR|YOK)");

                // Barkod (YOK... ile başlar)
                const barkodMatch = cleanText.match(/(YOK[A-Z0-9]{10,})/i);
                const barkod = barkodMatch ? barkodMatch[1] : "Bulunamadı";

                // Belge Tarihi (Belgedeki en üstteki ilk tarih)
                const tumTarihler = cleanText.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
                const belge_tarihi = tumTarihler.length > 0 ? tumTarihler[0] : "Bulunamadı";

                // 2. VERİTABANI OBJE HARİTASI
                const belgeData = { 
                    tc: tc, 
                    ad_soyad: ad_soyad, 
                    baba_adi: baba_adi, 
                    anne_adi: anne_adi, 
                    dogum_tarihi: dogum_tarihi, 
                    uni: uni, 
                    fakulte: fakulte, 
                    bolum: bolum, 
                    diploma_no: diploma_no, 
                    diploma_notu: diploma_notu, 
                    mezuniyet_tarihi: mezuniyet_tarihi, 
                    durum: durum, 
                    barkod: barkod, 
                    belge_tarihi: belge_tarihi, 
                    belge_durumu: "Onay Bekliyor" 
                };

                const { error } = await supabase.rpc('me26_belge_yukle', { p_uid: userUid, p_data: belgeData });
                if (error) reject("Belge kaydedilemedi."); else resolve(belgeData);
            } catch (error) { reject("PDF okunamadı."); }
        };
        reader.readAsArrayBuffer(file);
    });
}
