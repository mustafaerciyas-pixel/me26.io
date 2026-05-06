/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Canlı Production Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Kullanıcı oturum bilgisini tarayıcıda geçici olarak tutmak
   - UI tarafındaki profil, şehir, telefon, belge ve numara durumunu yönetmek
   - Güvenlik notu:
     localStorage güvenlik kaynağı değildir; sadece arayüz hafızasıdır.
     Yetki, oy gücü, davet sayısı ve VIP numara asıl olarak Supabase'de belirlenmelidir.
   ========================================================================== */

// ------------------------------------------------------
// STORAGE ANAHTARLARI
// ------------------------------------------------------
const STORAGE_KEY = 'me26_user';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------
const safeRead = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);

        if (!data) return null;

        const parsed = JSON.parse(data);

        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        return parsed;
    } catch (error) {
        console.error('ME26 hafıza okuma hatası. Oturum hafızası sıfırlanıyor:', error);

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (removeError) {
            console.warn('Bozuk ME26 hafızası silinemedi:', removeError);
        }

        return null;
    }
};

const safeWrite = (data) => {
    try {
        if (!data || typeof data !== 'object') return;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('ME26 hafıza yazma hatası:', error);
    }
};

const safeRemove = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('ME26 oturum hafızası silinemedi:', error);
    }
};

const cleanString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;

    return String(value).trim();
};

const normalizeUser = (userData = {}) => {
    const user = userData && typeof userData === 'object' ? userData : {};

    return {
        uid: user.uid || user.id || null,
        name: cleanString(user.name || user.isim, 'İsimsiz'),
        email: user.email || user.mail || null,
        photo: user.photo || user.foto || '',
        city: cleanString(user.city || user.sehir, 'Belirsiz'),
        role: cleanString(user.role || user.mesleki_durum, 'Belirsiz'),
        votePower: cleanString(user.votePower || user.oy_gucu || '0x'),
        userNo: user.userNo || user.vip_kurucu_no || 'BEKLEYEN',
        davetKodu: user.davetKodu || user.kendi_davet_kodu || null,
        hasPhone: Boolean(user.hasPhone || user.telefon),
        authStage: cleanString(user.authStage, 'registered'),
        documentPending: Boolean(user.documentPending),
        inviteCount: Number(user.inviteCount || user.davet_edilen_kisi_sayisi || 0),
        isVip: Boolean(user.isVip || user.is_vip),
        updatedAt: new Date().toISOString()
    };
};

const persistUser = () => {
    if (!STATE.user) return;

    safeWrite(STATE.user);
};

// ======================================================
// MERKEZİ STATE NESNESİ
// ======================================================
export const STATE = {
    // --------------------------------------------------
    // 1. TEMEL DURUM
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
    // CANLI GÜVENLİK:
    // Davet sayısı artık paylaşım butonuyla veya localStorage ile artırılmaz.
    // Sadece Supabase'den gelen gerçek kayıt sayısı STATE'e yazılır.
    incrementInviteCount: () => {
        console.warn(
            'incrementInviteCount canlı sürümde devre dışı. Davet sayısı sadece Supabase gerçek kayıt verisinden güncellenmelidir.'
        );

        return Number(STATE.user?.inviteCount || 0);
    },

    setInviteCountFromServer: (count) => {
        if (!STATE.user) return;

        const parsed = Number(count);

        STATE.user.inviteCount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        STATE.user.updatedAt = new Date().toISOString();

        persistUser();
    },

    // --------------------------------------------------
    // 3. KURUCU NUMARA / VIP DURUMU
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
    // 4. TELEFON / BELGE / YETKİ DURUMU
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

    // DİKKAT:
    // Canlıda tüm localStorage'ı silmek başka sistemleri de etkileyebilir.
    // Bu yüzden sadece ME26 oturum verisini temizliyoruz.
    clearAll: () => {
        STATE.user = null;
        safeRemove();
    }
};
