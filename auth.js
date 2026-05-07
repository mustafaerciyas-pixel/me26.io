/* ==========================================================================
   ME26 AĞI - ÇELİK KAPI MOTORU (auth.js)
   Cloudflare Workers Canlı Test Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Google ile giriş / çıkış
   - Telefon doğrulama
   - Firebase reCAPTCHA bot koruması
   - Mesleki belge inceleme başvurusu
   ========================================================================== */

import { STATE } from './state.js';
import { auth } from './config.js';
import { DB } from './supabase.js';

import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    RecaptchaVerifier,
    linkWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ------------------------------------------------------
// GLOBAL DEĞİŞKENLER
// ------------------------------------------------------
let confirmationResult = null;
let recaptchaVerifier = null;

const SMS_LIMIT_KEY = 'me26_sms_limits';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const cleanText = (value) => {
    return String(value || '').trim();
};

const safeLocalStorageGet = (key) => {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        return null;
    }
};

const safeLocalStorageSet = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.warn('LocalStorage yazılamadı:', error);
    }
};

const safeLocalStorageRemove = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('LocalStorage silinemedi:', error);
    }
};

const getRefFromUrl = () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = cleanText(params.get('ref'));

        if (!ref) return null;

        return ref
            .replace(/[^A-Z0-9\-]/gi, '')
            .toUpperCase()
            .slice(0, 40);
    } catch (error) {
        return null;
    }
};

const createInviteCode = () => {
    try {
        const randomArray = new Uint32Array(1);
        crypto.getRandomValues(randomArray);

        return `ME26-TR-${randomArray[0].toString(36).toUpperCase().slice(0, 6)}`;
    } catch (error) {
        return `ME26-TR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }
};

const normalizeTurkishPhone = (phoneNumber) => {
    let cleanedPhone = cleanText(phoneNumber).replace(/\D/g, '');

    if (cleanedPhone.startsWith('90')) {
        cleanedPhone = cleanedPhone.substring(2);
    }

    if (cleanedPhone.startsWith('0')) {
        cleanedPhone = cleanedPhone.substring(1);
    }

    if (cleanedPhone.length !== 10 || !cleanedPhone.startsWith('5')) {
        throw new Error('Lütfen 5 ile başlayan 10 haneli geçerli bir GSM numarası girin.');
    }

    return `+90${cleanedPhone}`;
};

const isPdfFile = (file) => {
    if (!file) return false;

    const fileName = cleanText(file.name).toLowerCase();
    const fileType = cleanText(file.type).toLowerCase();

    return fileType === 'application/pdf' || fileName.endsWith('.pdf');
};

const getFirebaseErrorMessage = (error) => {
    const errCode = error?.code || '';
    const message = error?.message || '';

    if (errCode === 'auth/popup-closed-by-user') {
        return 'Google giriş penceresi kapatıldı.';
    }

    if (errCode === 'auth/cancelled-popup-request') {
        return 'Google giriş işlemi iptal edildi.';
    }

    if (errCode === 'auth/popup-blocked') {
        return 'Tarayıcı Google giriş penceresini engelledi. Popup izni verin.';
    }

    if (errCode === 'auth/too-many-requests') {
        return 'Çok fazla deneme yapıldı. Sistem geçici olarak kilitlendi, lütfen daha sonra deneyin.';
    }

    if (errCode === 'auth/unauthorized-domain') {
        return 'Bu domain Firebase Authentication içinde yetkilendirilmemiş. Firebase Console > Authentication > Settings > Authorized domains alanına me26.mustafaerciyas.workers.dev eklenmeli.';
    }

    if (errCode === 'auth/invalid-phone-number') {
        return 'Sisteme girilen telefon numarası geçersiz.';
    }

    if (errCode === 'auth/captcha-check-failed') {
        return 'Güvenlik doğrulaması başarısız oldu. Sayfayı yenileyin.';
    }

    if (errCode === 'auth/provider-already-linked') {
        return 'Bu hesapta telefon doğrulaması zaten yapılmış görünüyor.';
    }

    if (errCode === 'auth/credential-already-in-use') {
        return 'Bu telefon numarası başka bir hesaba bağlı görünüyor.';
    }

    if (errCode === 'auth/invalid-verification-code') {
        return 'Girdiğiniz doğrulama kodu hatalı.';
    }

    if (errCode === 'auth/code-expired') {
        return 'Doğrulama kodunun süresi dolmuş. Yeniden SMS isteyin.';
    }

    if (message) {
        return message;
    }

    return 'İşlem sırasında beklenmeyen bir hata oluştu.';
};

// ======================================================
// 1. GOOGLE İLE GİRİŞ
// ======================================================
export async function googleIleGiris() {
    try {
        const provider = new GoogleAuthProvider();

        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        if (!user || !user.uid) {
            throw new Error('Google hesabı doğrulanamadı.');
        }

        const payload = {
            uid: user.uid,
            g_isim: user.displayName || 'İsimsiz',
            mail: user.email || null,
            foto: user.photoURL || '',
            m_durum: 'Belirsiz',
            sehir: null,
            d_kod: createInviteCode(),
            ref: getRefFromUrl()
        };

        const data = await DB.sistemeGiris(payload);

        return data;
    } catch (error) {
        console.error('Google giriş hatası:', error);

        alert(getFirebaseErrorMessage(error));

        return null;
    }
}

// ======================================================
// 2. SİSTEMDEN ÇIKIŞ
// ======================================================
export async function sistemdenCikis() {
    try {
        await signOut(auth);

        if (STATE && typeof STATE.clearSession === 'function') {
            STATE.clearSession();
        }

        safeLocalStorageRemove(SMS_LIMIT_KEY);

        window.location.reload();
    } catch (error) {
        console.error('Çıkış yapılırken hata oluştu:', error);

        alert('Çıkış yapılırken bir hata oluştu. Lütfen sayfayı yenileyin.');
    }
}

// ======================================================
// 3. SMS LİMİT KONTROLÜ
// ======================================================
function readSmsLimits() {
    const raw = safeLocalStorageGet(SMS_LIMIT_KEY);

    if (!raw) {
        return {
            count: 0,
            date: new Date().toDateString(),
            lastAttempt: 0
        };
    }

    try {
        const parsed = JSON.parse(raw);

        return {
            count: Number(parsed.count) || 0,
            date: parsed.date || new Date().toDateString(),
            lastAttempt: Number(parsed.lastAttempt) || 0
        };
    } catch (error) {
        return {
            count: 0,
            date: new Date().toDateString(),
            lastAttempt: 0
        };
    }
}

function checkSmsLimits() {
    let limits = readSmsLimits();
    const today = new Date().toDateString();

    if (limits.date !== today) {
        limits = {
            count: 0,
            date: today,
            lastAttempt: 0
        };
    }

    const now = Date.now();
    const timeDiff = Math.floor((now - limits.lastAttempt) / 1000);

    if (limits.count >= 5) {
        throw new Error('Günlük SMS gönderme limitinizi doldurdunuz. Lütfen yarın tekrar deneyin.');
    }

    if (limits.lastAttempt > 0 && timeDiff < 60) {
        throw new Error(`Lütfen yeni bir SMS istemeden önce ${60 - timeDiff} saniye bekleyin.`);
    }

    return limits;
}

function updateSmsLimits(limits) {
    const nextLimits = {
        count: Number(limits.count || 0) + 1,
        date: limits.date || new Date().toDateString(),
        lastAttempt: Date.now()
    };

    safeLocalStorageSet(SMS_LIMIT_KEY, JSON.stringify(nextLimits));
}

// ======================================================
// 4. RECAPTCHA KURULUMU
// ======================================================
function clearRecaptcha() {
    if (!recaptchaVerifier) return;

    try {
        recaptchaVerifier.clear();
    } catch (error) {
        console.warn('reCAPTCHA temizlenemedi:', error);
    }

    recaptchaVerifier = null;
}

function ensureRecaptchaContainer() {
    let recaptchaDiv = document.getElementById('recaptcha-container');

    if (!recaptchaDiv) {
        recaptchaDiv = document.createElement('div');
        recaptchaDiv.id = 'recaptcha-container';
        recaptchaDiv.style.display = 'none';
        document.body.appendChild(recaptchaDiv);
    }

    return recaptchaDiv;
}

async function createInvisibleRecaptcha() {
    clearRecaptcha();
    ensureRecaptchaContainer();

    recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        {
            size: 'invisible',
            callback: () => {
                console.info('reCAPTCHA doğrulandı.');
            },
            'expired-callback': () => {
                console.warn('reCAPTCHA süresi doldu.');
                clearRecaptcha();
            }
        }
    );

    try {
        await recaptchaVerifier.render();
    } catch (error) {
        console.warn('reCAPTCHA render uyarısı:', error);
    }

    return recaptchaVerifier;
}

// ======================================================
// 5. SMS GÖNDERME
// ======================================================
export async function gercekSmsGonder(phoneNumber) {
    try {
        if (!auth.currentUser) {
            throw new Error('Güvenlik Hatası: Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        }

        const formattedPhone = normalizeTurkishPhone(phoneNumber);
        const limits = checkSmsLimits();
        const verifier = await createInvisibleRecaptcha();

        confirmationResult = await linkWithPhoneNumber(
            auth.currentUser,
            formattedPhone,
            verifier
        );

        updateSmsLimits(limits);

        return true;
    } catch (error) {
        console.error('SMS gönderme hatası:', error);

        clearRecaptcha();

        const readableMessage = getFirebaseErrorMessage(error);

        throw new Error(readableMessage || 'Ağ yoğunluğu nedeniyle SMS gönderilemedi. Lütfen tekrar deneyin.');
    }
}

// ======================================================
// 6. SMS DOĞRULAMA
// ======================================================
export async function gercekSmsDogrula(code, uid, phoneValue) {
    try {
        const temizKod = cleanText(code).replace(/\s+/g, '');
        const temizUid = cleanText(uid);

        if (!confirmationResult) {
            throw new Error('Önce SMS gönderilmelidir.');
        }

        if (!temizUid) {
            throw new Error('Oturum kimliği bulunamadı.');
        }

        if (!temizKod || temizKod.length < 6) {
            throw new Error('Lütfen 6 haneli doğrulama kodunu girin.');
        }

        const formattedPhone = normalizeTurkishPhone(phoneValue);

        await confirmationResult.confirm(temizKod);
        await DB.telefonuOnayla(temizUid, formattedPhone);

        if (STATE && typeof STATE.setPhoneVerified === 'function') {
            STATE.setPhoneVerified();
        }

        confirmationResult = null;

        clearRecaptcha();

        return true;
    } catch (error) {
        console.error('SMS doğrulama hatası:', error);

        throw new Error(getFirebaseErrorMessage(error));
    }
}

// ======================================================
// 7. MESLEKİ BELGE İNCELEME BAŞVURUSU
// ======================================================
export async function eDevletBelgesiOku(file, userUid) {
    const temizUid = cleanText(userUid);

    if (!temizUid) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    if (!file) {
        throw new Error('Lütfen incelenmesi için bir PDF dosyası seçin.');
    }

    if (!isPdfFile(file)) {
        throw new Error('Sadece PDF formatında mesleki belge yükleyebilirsiniz.');
    }

    if (file.size > 10 * 1024 * 1024) {
        throw new Error('Yüklediğiniz dosyanın boyutu çok yüksek. Lütfen 10 MB altında bir dosya seçin.');
    }

    try {
        const belgeData = {
            dosya_adi: cleanText(file.name).slice(0, 180),
            tur: cleanText(file.type) || 'application/pdf',
            belge_durumu: 'Onay Bekliyor'
        };

        await DB.belgeyiSirayaAl(temizUid, belgeData);

        if (STATE && typeof STATE.setDocumentPending === 'function') {
            STATE.setDocumentPending();
        }

        return true;
    } catch (error) {
        console.error('Belge inceleme kuyruğu hatası:', error);

        throw new Error('Belgeniz inceleme kuyruğuna alınırken bir iletişim hatası oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
    }
}
