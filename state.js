/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Geçici Vercel Canlı Sürümü
   --------------------------------------------------------------------------
   Bu dosya şu modüllerle uyumludur:
   - app.js
   - ui.js
   - vip.js
   - qa.js
   - auth.js

   Kritik:
   - Bu dosya mutlaka named export verir:
     export const STATE
   ========================================================================== */

const STORAGE_KEY = 'me26_user';

// ------------------------------------------------------
// GÜVENLİ LOCALSTORAGE OKUMA / YAZMA
// ------------------------------------------------------
const safeRead = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) return null;

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object') {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return parsed;
    } catch (error) {
        console.error('ME26 state okuma hatası:', error);

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}

        return null;
    }
};

const safeWrite = (data) => {
    try {
        if (!data || typeof data !== 'object') return;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('ME26 state yazma hatası:', error);
    }
};

const safeRemove = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('ME26 state silme hatası:', error);
    }
};

// ------------------------------------------------------
// TEMİZLEME YARDIMCILARI
// ------------------------------------------------------
const cleanString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;

    return String(value).trim();
};

const cleanNumber = (value, fallback = 0) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
};

// ------------------------------------------------------
// USER NORMALİZE
// Supabase, Firebase ve frontend alanlarını tek formata çeker.
// ------------------------------------------------------
const normalizeUser = (userData = {}) => {
    const user = userData && typeof userData === 'object' ? userData : {};

    const uid = user.uid || user.id || null;

    const rawUserNo =
        user.userNo ||
        user.vip_kurucu_no ||
        user.kurucu_no ||
        'BEKLEYEN';

    const userNo =
        rawUserNo === null ||
        rawUserNo === undefined ||
        rawUserNo === ''
            ? 'BEKLEYEN'
            : rawUserNo;

    const rawVotePower =
        user.votePower ||
        user.oy_gucu ||
        user.vote_power ||
        '0x';

    const votePower =
        String(rawVotePower).includes('x')
            ? String(rawVotePower)
            : `${rawVotePower || 0}x`;

    return {
        uid,
        name: cleanString(user.name || user.isim || user.g_isim, 'İsimsiz'),
        email: user.email || user.mail || null,
        photo: user.photo || user.foto || '',
        city: cleanString(user.city || user.sehir, 'Belirsiz'),
        role: cleanString(user.role || user.mesleki_durum || user.m_durum, 'Belirsiz'),
        votePower,
        userNo,
        davetKodu: user.davetKodu || user.kendi_davet_kodu || user.d_kod || null,
        hasPhone: Boolean(user.hasPhone || user.telefon),
        authStage: cleanString(user.authStage, 'registered'),
        documentPending: Boolean(user.documentPending),
        inviteCount: cleanNumber(user.inviteCount || user.davet_edilen_kisi_sayisi, 0),
        isVip: Boolean(user.isVip || user.is_vip),
        updatedAt: new Date().toISOString()
    };
};

const persistUser = () => {
    if (!STATE.user) return;

    safeWrite(STATE.user);
};

// ======================================================
// MERKEZİ STATE
// ======================================================
export const STATE = {
    // --------------------------------------------------
    // 1. TEMEL OTURUM
    // --------------------------------------------------
    user: safeRead(),

    aktifKursuModu: 'onerge',

    isLoggedIn: () => {
        return Boolean(STATE.user && STATE.user.uid);
    },

    getUser: () => {
        return STATE.user || {};
    },

    setUser: (userData) => {
        STATE.user = normalizeUser(userData);
        persistUser();
    },

    updateUser: (key, value) => {
        if (!STATE.user) return;

        const safeKey = cleanString(key);

        if (!safeKey) return;

        STATE.user[safeKey] = value;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    updateUserMany: (updates = {}) => {
        if (!STATE.user) return;
        if (!updates || typeof updates !== 'object') return;

        STATE.user = {
            ...STATE.user,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        persistUser();
    },

    // --------------------------------------------------
    // 2. DAVET SAYISI
    // --------------------------------------------------
    setInviteCountFromServer: (count) => {
        if (!STATE.user) return;

        const parsed = cleanNumber(count, 0);

        STATE.user.inviteCount = parsed >= 0 ? parsed : 0;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    // Canlıda paylaş butonuna basınca davet sayısı artırılmaz.
    incrementInviteCount: () => {
        console.warn(
            'incrementInviteCount canlı sürümde devre dışı. Davet sayısı sadece Supabase verisinden gelmelidir.'
        );

        return Number(STATE.user?.inviteCount || 0);
    },

    // --------------------------------------------------
    // 3. KURUCU NUMARA / VIP
    // --------------------------------------------------
    setVipNumber: (num) => {
        if (!STATE.user) return;

        const cleanNo = cleanString(num);

        if (!cleanNo) return;

        STATE.user.userNo = cleanNo;
        STATE.user.isVip = true;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    setStandardNumber: (num) => {
        if (!STATE.user) return;

        const cleanNo = cleanString(num);

        if (!cleanNo) return;

        STATE.user.userNo = cleanNo;
        STATE.user.isVip = false;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    // --------------------------------------------------
    // 4. TELEFON / BELGE / YETKİ
    // --------------------------------------------------
    setPhoneVerified: () => {
        if (!STATE.user) return;

        STATE.user.hasPhone = true;

        if (
            STATE.user.authStage !== 'pdf_verified' &&
            STATE.user.authStage !== 'document_pending'
        ) {
            STATE.user.authStage = 'phone_verified';
        }

        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    setDocumentPending: () => {
        if (!STATE.user) return;

        STATE.user.authStage = 'document_pending';
        STATE.user.documentPending = true;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    setPdfVerified: () => {
        if (!STATE.user) return;

        STATE.user.authStage = 'pdf_verified';
        STATE.user.documentPending = false;
        STATE.user.votePower = '1.0x';
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    // --------------------------------------------------
    // 5. ŞEHİR / TRİBÜN
    // --------------------------------------------------
    setCity: (city) => {
        if (!STATE.user) return;

        const cleanCity = cleanString(city);

        if (!cleanCity) return;

        STATE.user.city = cleanCity;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    // --------------------------------------------------
    // 6. OTURUM TEMİZLİĞİ
    // --------------------------------------------------
    clearSession: () => {
        STATE.user = null;
        safeRemove();
    },

    clearAll: () => {
        STATE.user = null;
        safeRemove();
    }
};
