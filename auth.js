// ============================================================================
// ME26 SİSTEMİ - ÇELİK KAPI (auth.js)
// Kimlik Doğrulama, SMS kullanıcı deneyimi limiti ve Mesleki Belge Manuel İnceleme Kuyruğu
// ============================================================================

import { STATE } from './state.js'; 
import { auth } from './config.js';
import { DB } from './supabase.js'; 
import { signInWithPopup, GoogleAuthProvider, signOut, RecaptchaVerifier, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

let confirmationResult = null; 
let me26Recaptcha = null; 

// ============================================================================
// 1. GOOGLE İLE GİRİŞ & ÇIKIŞ MOTORLARI
// ============================================================================
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

        const data = await DB.sistemeGiris(gizliPaket);
        return data; 
    } catch (error) { 
        alert("Google giriş hatası veya pencere kapatıldı!"); 
        return null; 
    }
}

export async function sistemdenCikis() {
    try { 
        await signOut(auth); 
        STATE.clearSession(); 
        window.location.reload(); 
    } catch (error) { 
        console.error("Çıkış yapılırken hata oluştu:", error); 
    }
}

// ============================================================================
// 2. SMS KULLANICI DENEYİMİ LİMİTİ (GERÇEK RATE LIMIT SUNUCU/FIREBASE TARAFINDADIR)
// ============================================================================
const SMS_LIMIT_KEY = 'me26_sms_limits';

function checkSmsLimits() {
    let limits = JSON.parse(localStorage.getItem(SMS_LIMIT_KEY)) || { count: 0, date: new Date().toDateString(), lastAttempt: 0 };
    const today = new Date().toDateString();

    // Gün değiştiyse limitleri sıfırla
    if (limits.date !== today) {
        limits = { count: 0, date: today, lastAttempt: 0 };
    }

    const now = Date.now();
    
    if (limits.count >= 5) {
        throw new Error("Bugünkü SMS deneme sınırına ulaştınız. Lütfen yarın tekrar deneyin.");
    }

    const timeDiff = Math.floor((now - limits.lastAttempt) / 1000);
    if (timeDiff < 60) {
        throw new Error(`Lütfen yeni bir SMS istemeden önce ${60 - timeDiff} saniye bekleyin.`);
    }

    return limits;
}

function updateSmsLimits(limits) {
    limits.count += 1;
    limits.lastAttempt = Date.now();
    localStorage.setItem(SMS_LIMIT_KEY, JSON.stringify(limits));
}

// ============================================================================
// 3. SMS GÖNDERME MOTORU (Firebase reCAPTCHA + kullanıcı deneyimi bekleme kontrolü)
// ============================================================================
export async function gercekSmsGonder(phoneNumber) {
    try {
        if (!auth.currentUser) {
            throw new Error("Güvenlik Hatası: Oturum bulunamadı. Lütfen sayfayı yenileyin.");
        }

        // 1. Limitleri kontrol et (Hata varsa fırlatır ve durdurur)
        const limits = checkSmsLimits();

        // 2. Telefon Numarasını +90 Formatına Zorla
        let cleanedPhone = phoneNumber.replace(/\D/g, ''); 
        if (cleanedPhone.startsWith('90')) cleanedPhone = cleanedPhone.substring(2);
        if (cleanedPhone.startsWith('0')) cleanedPhone = cleanedPhone.substring(1);

        if (cleanedPhone.length !== 10 || !cleanedPhone.startsWith('5')) {
            throw new Error("Lütfen 5 ile başlayan 10 haneli geçerli bir GSM numarası girin.");
        }

        const formattedPhone = `+90${cleanedPhone}`;

        // 3. ReCAPTCHA'yı Her Denemede Temizle ve Yeniden Kur
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
        
        // 4. SMS Gönder
        confirmationResult = await linkWithPhoneNumber(auth.currentUser, formattedPhone, me26Recaptcha);
        
        // Başarılı olursa limit sayacını güncelle
        updateSmsLimits(limits);
        return true;

    } catch (error) {
        console.error("SMS Hatası Detayı:", error);
        
        let errorMsg = error.message || String(error);
        const errCode = error.code || '';

        // Firebase hatalarını Türkçe'ye çevir
        if (errCode === 'auth/too-many-requests') {
            errorMsg = "Çok fazla deneme yapıldı. Sistem geçici olarak kilitlendi, lütfen daha sonra deneyin.";
        } else if (errCode === 'auth/invalid-phone-number') {
            errorMsg = "Sisteme girilen telefon numarası geçersiz.";
        } else if (errCode === 'auth/captcha-check-failed') {
            errorMsg = "Güvenlik (Bot) doğrulaması başarısız oldu. Lütfen sayfayı yenileyin.";
        } else if (errCode === 'auth/provider-already-linked' || errCode === 'auth/credential-already-in-use') {
            errorMsg = "Bu telefon numarası zaten sistemde kayıtlı bir hesaba bağlı.";
        } else if (!error.message.includes("Google") && !error.message.includes("GSM") && !error.message.includes("saniye") && !error.message.includes("limit")) {
            errorMsg = "Ağ yoğunluğu nedeniyle SMS gönderilemedi. Lütfen tekrar deneyin.";
        }

        throw new Error(errorMsg); 
    }
}

// ============================================================================
// 4. SMS DOĞRULAMA MOTORU
// ============================================================================
export async function gercekSmsDogrula(code, uid, phoneValue) {
    try {
        if (!confirmationResult) throw new Error("Önce SMS gönderilmelidir.");

        // Kodu onayla
        await confirmationResult.confirm(code);
        
        // Supabase karanlık odada veriyi güncelle
        await DB.telefonuOnayla(uid, phoneValue);

        // State (Hafıza) üzerinden güvenli mühürleme yap
        STATE.setPhoneVerified();

        return true;
    } catch (error) {
        console.error("Doğrulama Hatası:", error); 
        throw new Error("Girdiğiniz kod hatalı veya süresi dolmuş. Lütfen tekrar kontrol edin.");
    }
}

// ============================================================================
// 5. MESLEKİ BELGE MANUEL İNCELEME KUYRUĞU (OTOMATİK E-DEVLET DOĞRULAMASI DEĞİLDİR)
// ============================================================================
export async function eDevletBelgesiOku(file, userUid) {
    if (!file) {
        throw new Error("Lütfen incelenmesi için bir dosya seçin.");
    }

    // GÜNCELLEME: Sadece PDF kabul edilecek
    const validTypes = ['application/pdf'];
    if (!validTypes.includes(file.type)) {
        throw new Error("Sadece PDF formatında mesleki belge yükleyebilirsiniz.");
    }

    // Dosya boyutu sınırı (Örn: 10MB)
    if (file.size > 10 * 1024 * 1024) {
        throw new Error("Yüklediğiniz dosyanın boyutu çok yüksek. Lütfen 10MB'ın altında bir dosya seçin.");
    }

    try {
        // Manuel inceleme kuyruğu için hazırlanacak temel belge paketi
        const belgeData = { 
            dosya_adi: file.name,
            tur: file.type,
            belge_durumu: "Manuel İnceleme Kuyruğunda"
        };

        // Supabase'e belge inceleme talebini yaz (DB motorundan hata gelirse yakalar)
        await DB.belgeyiSirayaAl(userUid, belgeData);

        // State (Hafıza) üzerinden güvenli mühürleme yap ve durumu "document_pending"e çek
        STATE.setDocumentPending();

        return true;
    } catch (error) { 
        console.error("Kuyruk Hatası:", error);
        throw new Error("Belgeniz inceleme kuyruğuna alınırken bir iletişim hatası oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin.");
    }
}
