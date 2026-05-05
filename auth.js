// ============================================================================
// ME26 SİSTEMİ - KİMLİK DOĞRULAMA VE BELGE DEŞİFRE MOTORU (auth.js)
// ============================================================================

import { auth } from './config.js';
import { supabase } from './supabase.js'; // İŞTE EKSİK OLAN VE EKLENEN ANA BORU!
import { signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ============================================================================
// 1. GOOGLE İLE GİRİŞ MOTORU
// ============================================================================
export async function googleIleGiris() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Firebase'den gelen verileri paketliyoruz
        const gizliPaket = {
            uid: user.uid,
            g_isim: user.displayName || 'İsimsiz',
            mail: user.email,
            foto: user.photoURL || '',
            m_durum: 'Belirsiz', // Belge yüklenene kadar belirsiz
            sehir: null,
            d_kod: 'ME26-TR-' + Math.random().toString(36).substring(2, 6).toUpperCase(), // Kendi davet kodu
            ref: null // Davet eden kişinin kodu (eğer varsa ui.js'den alınacak)
        };

        // Supabase Zırhlı Giriş Motoruna Yolluyoruz (me26_sistem_giris RPC)
        const { data, error } = await supabase.rpc('me26_sistem_giris', { p_payload: gizliPaket });

        if (error) {
            console.error("Supabase Kayıt Hatası:", error);
            alert("Giriş yapılırken veritabanı hatası oluştu!");
            return null;
        }

        console.log("Sisteme Başarıyla Girildi:", data);
        return data; // Kullanıcı verilerini döndürüyoruz (app.js/ui.js kullanacak)

    } catch (error) {
        console.error("Google Giriş Hatası:", error);
        alert("Google ile giriş yapılamadı. Lütfen tekrar deneyin.");
        return null;
    }
}

// ============================================================================
// 2. GÜVENLİ ÇIKIŞ MOTORU
// ============================================================================
export async function sistemdenCikis() {
    try {
        await signOut(auth);
        console.log("Sistemden güvenli çıkış yapıldı.");
        window.location.reload(); // Sayfayı sıfırla
    } catch (error) {
        console.error("Çıkış Hatası:", error);
    }
}

// ============================================================================
// 3. E-DEVLET PDF DEŞİFRE VE PARÇALAMA MOTORU
// ============================================================================
export async function eDevletBelgesiOku(file, userUid) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function() {
            try {
                // PDF.js kütüphanesi yüklenmiş olmalı (index.html'de script olarak var)
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                
                let fullText = '';
                
                // Belgenin tüm sayfalarını (genelde tek sayfadır ama) okuyoruz
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' \n';
                }

                // Fazla boşlukları temizleyip aramaya hazır hale getiriyoruz
                const cleanText = fullText.replace(/\s+/g, ' ');

                console.log("PDF'ten Okunan Ham Metin:", cleanText);

                // --- VİZYONER RADAR SİSTEMİ (Regex ile Veri Cımbızlama) ---
                
                // 1. Devlet Kimlik Verileri
                const tc = (cleanText.match(/Kimlik No\s*[:\s]*(\d{11})/i) || [])[1] || 'Bulunamadı';
                const ad_soyad = (cleanText.match(/Adı Soyadı\s*[:\s]*([a-zA-ZÇĞİÖŞÜçğıöşü\s]+?)(?=Baba Adı)/i) || [])[1]?.trim() || 'Bulunamadı';
                const baba_adi = (cleanText.match(/Baba Adı\s*[:\s]*([a-zA-ZÇĞİÖŞÜçğıöşü\s]+?)(?=Anne Adı)/i) || [])[1]?.trim() || 'Bulunamadı';
                const anne_adi = (cleanText.match(/Anne Adı\s*[:\s]*([a-zA-ZÇĞİÖŞÜçğıöşü\s]+?)(?=Doğum Tarihi)/i) || [])[1]?.trim() || 'Bulunamadı';
                const dogum_tarihi = (cleanText.match(/Doğum Tarihi\s*[:\s]*([\d\.]+)/i) || [])[1] || 'Bulunamadı';
                
                // 2. Akademik Veriler
                const uni_program = (cleanText.match(/Program\s*[:\s]*([^\n\r]+?)(?=Diploma No|Kayıt Tarihi)/i) || [])[1] || '';
                const uni_parts = uni_program.split('/');
                const uni = uni_parts[0] ? uni_parts[0].trim() : 'Bulunamadı';
                const fakulte = uni_parts[1] ? uni_parts[1].trim() : 'Bulunamadı';
                const bolum = uni_parts[2] ? uni_parts[2].trim() : 'Bulunamadı';
                
                const diploma_no = (cleanText.match(/Diploma No\s*[:\s]*([^\s]+)/i) || [])[1] || 'Bulunamadı';
                const diploma_notu = (cleanText.match(/Diploma Notu\s*[:\s]*([\d\.\s\/]+?)(?=Mezuniyet Tarihi)/i) || [])[1]?.trim() || 'Bulunamadı';
                const mezuniyet_tarihi = (cleanText.match(/Mezuniyet Tarihi\s*[:\s]*([\d\.]+)/i) || [])[1] || 'Bulunamadı';
                const durum = (cleanText.match(/Durum\s*[:\s]*([a-zA-ZÇĞİÖŞÜçğıöşü]+)/i) || [])[1] || 'Bulunamadı';
                
                // 3. Güvenlik ve Belge Doğrulama Verileri
                const barkodMatch = cleanText.match(/YOK[A-Z0-9]+/i);
                const barkod = barkodMatch ? barkodMatch[0] : 'Bulunamadı';
                
                // Barkodun hemen etrafındaki GG.AA.YYYY formatındaki tarihi arar
                const belgeTarihiMatch = cleanText.match(/YOK[A-Z0-9]+[\s\r\n]*(\d{2}\.\d{2}\.\d{4})/i);
                const belgeTarihi = belgeTarihiMatch ? belgeTarihiMatch[1] : 'Bulunamadı';

                // Veritabanına Yollanacak Çuvalı Hazırlıyoruz
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
                    belge_tarihi: belgeTarihi, 
                    belge_durumu: "Onay Bekliyor"
                };

                console.log("PDF'ten Cımbızlanan Veriler:", belgeData);

                // Supabase'deki me26_belge_yukle motoruna gönderiyoruz
                const { error } = await supabase.rpc('me26_belge_yukle', { 
                    p_uid: userUid, 
                    p_data: belgeData 
                });

                if (error) {
                    console.error("Belge Veritabanına Yazılırken Hata:", error);
                    reject("Belge sisteme kaydedilemedi.");
                } else {
                    console.log("Belge veritabanına jilet gibi işlendi!");
                    resolve(belgeData);
                }

            } catch (error) {
                console.error("PDF Okuma Hatası:", error);
                reject("PDF belgesi okunamadı. Lütfen geçerli bir e-Devlet belgesi yükleyin.");
            }
        };

        reader.readAsArrayBuffer(file);
    });
}
