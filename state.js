/* ==========================================================================
   ME26 AĞI - MERKEZİ HAFIZA MOTORU (state.js)
   Temiz Final Sürüm

   Görev:
   - Kullanıcı oturum bilgisini localStorage içinde güvenli tutmak
   - Firebase / Supabase / eski modüllerden gelen kullanıcı verisini tek formata çekmek
   - auth.js, vip.js, qa.js, stadium.js ve eski modüllerle uyumlu named export vermek

   Kritik:
   - Bu dosya named export verir: export const STATE
   - Bu dosyada import yoktur.
   - Service key, gizli token veya sunucu sırrı içermez.
========================================================================== */

// ------------------------------------------------------
// SABİTLER
// ------------------------------------------------------

const STORAGE_KEY = 'me26_user';

const LEGACY_KEYS = {
  authStage: 'me26_auth_stage',
  userNo: 'me26_uye_no',
  role: 'me26_rutbe',
  city: 'me26_sehir',
  inviteCount: 'me26_davet_sayisi',
  isVip: 'me26_is_vip',
  vipNumber: 'me26_vip_number',
  votePower: 'me26_vote_power'
};

// ------------------------------------------------------
// GÜVENLİ LOCALSTORAGE
// ------------------------------------------------------

const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`ME26 localStorage okunamadı: ${key}`, error);
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`ME26 localStorage yazılamadı: ${key}`, error);
  }
};

const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`ME26 localStorage silinemedi: ${key}`, error);
  }
};

const safeJsonParse = (value, fallback = null) => {
  try {
    if (!value) return fallback;

    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }

    return parsed;
  } catch {
    return fallback;
  }
};

const safeReadUser = () => {
  const raw = safeStorageGet(STORAGE_KEY);
  const parsed = safeJsonParse(raw, null);

  if (!parsed) {
    return null;
  }

  return parsed;
};

const safeWriteUser = (user) => {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return;
  }

  safeStorageSet(STORAGE_KEY, JSON.stringify(user));
};

const safeRemoveUser = () => {
  safeStorageRemove(STORAGE_KEY);
};

// ------------------------------------------------------
// TEMİZLEME YARDIMCILARI
// ------------------------------------------------------

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const cleanNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace('x', '').replace(',', '.').trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanBoolean = (value, fallback = false) => {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
};

const nowIso = () => new Date().toISOString();

const createInviteCode = (uid = '') => {
  const source = cleanText(uid || Math.random().toString(36));

  return `ME26-TR-${source
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 8)
    .toUpperCase()}`;
};

const getDigitalIdFromUserNo = (userNo) => {
  const cleanNo = cleanText(userNo, 'BEKLEYEN');

  if (!cleanNo || cleanNo === 'BEKLEYEN') {
    return 'TR-IA-BEKLEYEN';
  }

  if (cleanNo.startsWith('TR-IA-')) {
    return cleanNo;
  }

  return `TR-IA-${cleanNo}`;
};

// ------------------------------------------------------
// ESKİ KEY SENKRONİZASYONU
// ------------------------------------------------------

const writeLegacyKeys = (user) => {
  if (!user) return;

  safeStorageSet(LEGACY_KEYS.authStage, cleanText(user.authStage, 'registered'));
  safeStorageSet(LEGACY_KEYS.userNo, cleanText(user.userNo, 'BEKLEYEN'));
  safeStorageSet(LEGACY_KEYS.role, cleanText(user.role, 'Belirsiz'));
  safeStorageSet(LEGACY_KEYS.city, cleanText(user.city, 'Belirsiz'));
  safeStorageSet(LEGACY_KEYS.inviteCount, String(cleanNumber(user.inviteCount, 0)));
  safeStorageSet(LEGACY_KEYS.isVip, String(Boolean(user.isVip)));
  safeStorageSet(LEGACY_KEYS.vipNumber, cleanText(user.vipNumber || user.userNo, ''));
  safeStorageSet(LEGACY_KEYS.votePower, String(cleanNumber(user.votePower, 0)));
};

const clearLegacyKeys = () => {
  Object.values(LEGACY_KEYS).forEach((key) => {
    safeStorageRemove(key);
  });
};

// ------------------------------------------------------
// USER NORMALİZE
// ------------------------------------------------------

export const normalizeUser = (userData = {}) => {
  const user =
    userData && typeof userData === 'object' && !Array.isArray(userData)
      ? userData
      : {};

  const uid = cleanText(user.uid || user.id || user.firebase_uid || '', null);

  const rawUserNo =
    user.userNo ||
    user.user_no ||
    user.vip_kurucu_no ||
    user.kurucu_no ||
    user.no ||
    'BEKLEYEN';

  const userNo = cleanText(rawUserNo, 'BEKLEYEN') || 'BEKLEYEN';

  const digitalId =
    user.digitalId ||
    user.digital_id ||
    user.dijital_id ||
    getDigitalIdFromUserNo(userNo);

  const inviteCode =
    user.inviteCode ||
    user.invite_code ||
    user.kendi_davet_kodu ||
    user.davet_kodu ||
    user.d_kod ||
    user.davetKodu ||
    digitalId ||
    createInviteCode(uid);

  const votePower = cleanNumber(
    user.votePower ||
      user.vote_power ||
      user.oy_gucu ||
      user.guc ||
      0,
    0
  );

  const inviteCount = cleanNumber(
    user.inviteCount ||
      user.invite_count ||
      user.davet_edilen_kisi_sayisi ||
      user.davet_sayisi ||
      0,
    0
  );

  const hasPhone = cleanBoolean(
    user.hasPhone ||
      user.has_phone ||
      user.telefon_onayli ||
      Boolean(user.telefon || user.phone),
    false
  );

  const documentStatus = cleanText(
    user.documentStatus ||
      user.document_status ||
      user.belge_durumu ||
      'Bekliyor',
    'Bekliyor'
  );

  const authStage = cleanText(
    user.authStage ||
      user.auth_stage ||
      user.stage ||
      (documentStatus.toLowerCase().includes('onay') ? 'document_pending' : 'registered'),
    'registered'
  );

  const documentPending = cleanBoolean(
    user.documentPending ||
      user.document_pending ||
      authStage === 'document_pending' ||
      documentStatus.toLowerCase().includes('bek'),
    false
  );

  const isVip = cleanBoolean(
    user.isVip ||
      user.is_vip ||
      user.vip ||
      Boolean(user.vip_kurucu_no),
    false
  );

  const role = cleanText(
    user.role ||
      user.mesleki_durum ||
      user.m_durum ||
      user.rutbe ||
      'Belirsiz',
    'Belirsiz'
  );

  const city = cleanText(
    user.city ||
      user.sehir ||
      'Belirsiz',
    'Belirsiz'
  );

  const normalized = {
    uid,
    id: uid,

    name: cleanText(
      user.name ||
        user.isim ||
        user.g_isim ||
        user.displayName ||
        'İsimsiz',
      'İsimsiz'
    ),

    email: cleanText(
      user.email ||
        user.mail ||
        user.eposta ||
        '',
      null
    ),

    photo: cleanText(
      user.photo ||
        user.foto ||
        user.photoURL ||
        '',
      ''
    ),

    city,
    sehir: city,

    role,
    mesleki_durum: role,
    m_durum: role,

    userNo,
    user_no: userNo,

    digitalId,
    digital_id: digitalId,
    dijital_id: digitalId,

    inviteCode,
    invite_code: inviteCode,
    davetKodu: inviteCode,
    d_kod: inviteCode,

    hasPhone,
    has_phone: hasPhone,
    phone: cleanText(user.phone || user.telefon || '', null),
    telefon: cleanText(user.telefon || user.phone || '', null),

    documentStatus,
    document_status: documentStatus,
    belge_durumu: documentStatus,
    documentPending,

    authStage,
    auth_stage: authStage,

    votePower,
    vote_power: votePower,
    oy_gucu: votePower,
    votePowerLabel: `${votePower}x`,

    inviteCount,
    invite_count: inviteCount,
    davet_edilen_kisi_sayisi: inviteCount,

    isVip,
    is_vip: isVip,
    vipNumber: cleanText(user.vipNumber || user.vip_kurucu_no || '', ''),

    mentorPreference: cleanText(user.mentorPreference || user.mentor_preference || '', ''),
    themeMode: cleanText(user.themeMode || user.theme_mode || 'default', 'default'),

    raw: user.raw || user,

    createdAt: user.createdAt || user.created_at || null,
    updatedAt: nowIso()
  };

  return normalized;
};

// ------------------------------------------------------
// PERSIST
// ------------------------------------------------------

const persistUser = () => {
  if (!STATE.user) return;

  safeWriteUser(STATE.user);
  writeLegacyKeys(STATE.user);
};

const setNormalizedUser = (userData) => {
  STATE.user = normalizeUser(userData);
  persistUser();
  return STATE.user;
};

// ======================================================
// MERKEZİ STATE
// ======================================================

export const STATE = {
  // --------------------------------------------------
  // 1. TEMEL OTURUM
  // --------------------------------------------------

  user: safeReadUser(),
  aktifKursuModu: 'onerge',

  hydrateFromLocalStorage: () => {
    const stored = safeReadUser();

    if (!stored) {
      STATE.user = null;
      return null;
    }

    STATE.user = normalizeUser(stored);
    persistUser();

    return STATE.user;
  },

  isLoggedIn: () => {
    return Boolean(STATE.user && STATE.user.uid);
  },

  getUser: () => {
    return STATE.user || {};
  },

  getUid: () => {
    return STATE.user?.uid || null;
  },

  getDigitalId: () => {
    return STATE.user?.digitalId || 'TR-IA-BEKLEYEN';
  },

  setUser: (userData) => {
    return setNormalizedUser(userData);
  },

  setFirebaseUser: (firebaseUser = {}) => {
    if (!firebaseUser || !firebaseUser.uid) {
      return null;
    }

    return setNormalizedUser({
      ...(STATE.user || {}),
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      name: firebaseUser.displayName || STATE.user?.name || 'İsimsiz',
      email: firebaseUser.email || STATE.user?.email || null,
      photo: firebaseUser.photoURL || STATE.user?.photo || ''
    });
  },

  updateUser: (key, value) => {
    if (!STATE.user) return null;

    const safeKey = cleanText(key);

    if (!safeKey) return STATE.user;

    STATE.user[safeKey] = value;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  updateUserMany: (updates = {}) => {
    if (!STATE.user) return null;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return STATE.user;
    }

    STATE.user = normalizeUser({
      ...STATE.user,
      ...updates,
      updatedAt: nowIso()
    });

    persistUser();

    return STATE.user;
  },

  // --------------------------------------------------
  // 2. KÜRSÜ MODU
  // --------------------------------------------------

  setKursuMode: (mode = 'onerge') => {
    STATE.aktifKursuModu = mode === 'soru' ? 'soru' : 'onerge';
    return STATE.aktifKursuModu;
  },

  getKursuMode: () => {
    return STATE.aktifKursuModu || 'onerge';
  },

  // --------------------------------------------------
  // 3. DAVET SAYISI
  // --------------------------------------------------

  setInviteCountFromServer: (count) => {
    if (!STATE.user) return 0;

    const parsed = cleanNumber(count, 0);
    STATE.user.inviteCount = parsed >= 0 ? parsed : 0;
    STATE.user.invite_count = STATE.user.inviteCount;
    STATE.user.davet_edilen_kisi_sayisi = STATE.user.inviteCount;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user.inviteCount;
  },

  incrementInviteCount: () => {
    console.warn(
      'incrementInviteCount canlı sürümde lokal olarak artırılmaz. Davet sayısı Supabase verisinden gelmelidir.'
    );

    return cleanNumber(STATE.user?.inviteCount, 0);
  },

  // --------------------------------------------------
  // 4. KURUCU NUMARA / VIP
  // --------------------------------------------------

  setVipNumber: (num) => {
    if (!STATE.user) return null;

    const cleanNo = cleanText(num);

    if (!cleanNo) return STATE.user;

    STATE.user.userNo = cleanNo;
    STATE.user.user_no = cleanNo;
    STATE.user.vipNumber = cleanNo;
    STATE.user.digitalId = getDigitalIdFromUserNo(cleanNo);
    STATE.user.digital_id = STATE.user.digitalId;
    STATE.user.dijital_id = STATE.user.digitalId;
    STATE.user.isVip = true;
    STATE.user.is_vip = true;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setStandardNumber: (num) => {
    if (!STATE.user) return null;

    const cleanNo = cleanText(num);

    if (!cleanNo) return STATE.user;

    STATE.user.userNo = cleanNo;
    STATE.user.user_no = cleanNo;
    STATE.user.digitalId = getDigitalIdFromUserNo(cleanNo);
    STATE.user.digital_id = STATE.user.digitalId;
    STATE.user.dijital_id = STATE.user.digitalId;
    STATE.user.isVip = false;
    STATE.user.is_vip = false;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  // --------------------------------------------------
  // 5. TELEFON / BELGE / YETKİ
  // --------------------------------------------------

  setPhoneVerified: (phone = null) => {
    if (!STATE.user) return null;

    STATE.user.hasPhone = true;
    STATE.user.has_phone = true;

    if (phone) {
      STATE.user.phone = cleanText(phone);
      STATE.user.telefon = cleanText(phone);
    }

    if (
      STATE.user.authStage !== 'pdf_verified' &&
      STATE.user.authStage !== 'document_pending'
    ) {
      STATE.user.authStage = 'phone_verified';
      STATE.user.auth_stage = 'phone_verified';
    }

    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setDocumentPending: () => {
    if (!STATE.user) return null;

    STATE.user.authStage = 'document_pending';
    STATE.user.auth_stage = 'document_pending';
    STATE.user.documentPending = true;
    STATE.user.documentStatus = 'Onay Bekliyor';
    STATE.user.document_status = 'Onay Bekliyor';
    STATE.user.belge_durumu = 'Onay Bekliyor';
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setPdfVerified: () => {
    if (!STATE.user) return null;

    STATE.user.authStage = 'pdf_verified';
    STATE.user.auth_stage = 'pdf_verified';
    STATE.user.documentPending = false;
    STATE.user.documentStatus = 'Onaylandı';
    STATE.user.document_status = 'Onaylandı';
    STATE.user.belge_durumu = 'Onaylandı';
    STATE.user.votePower = 1;
    STATE.user.vote_power = 1;
    STATE.user.oy_gucu = 1;
    STATE.user.votePowerLabel = '1x';
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setDocumentRejected: () => {
    if (!STATE.user) return null;

    STATE.user.authStage = 'document_rejected';
    STATE.user.auth_stage = 'document_rejected';
    STATE.user.documentPending = false;
    STATE.user.documentStatus = 'Reddedildi';
    STATE.user.document_status = 'Reddedildi';
    STATE.user.belge_durumu = 'Reddedildi';
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setVotePower: (power = 0) => {
    if (!STATE.user) return null;

    const parsed = cleanNumber(power, 0);

    STATE.user.votePower = parsed;
    STATE.user.vote_power = parsed;
    STATE.user.oy_gucu = parsed;
    STATE.user.votePowerLabel = `${parsed}x`;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  // --------------------------------------------------
  // 6. ŞEHİR / ROL / PROFİL
  // --------------------------------------------------

  setCity: (city) => {
    if (!STATE.user) return null;

    const cleanCity = cleanText(city);

    if (!cleanCity) return STATE.user;

    STATE.user.city = cleanCity;
    STATE.user.sehir = cleanCity;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setRole: (role) => {
    if (!STATE.user) return null;

    const cleanRole = cleanText(role);

    if (!cleanRole) return STATE.user;

    STATE.user.role = cleanRole;
    STATE.user.mesleki_durum = cleanRole;
    STATE.user.m_durum = cleanRole;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setMentorPreference: (preference) => {
    if (!STATE.user) return null;

    STATE.user.mentorPreference = cleanText(preference);
    STATE.user.mentor_preference = STATE.user.mentorPreference;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  setThemeMode: (themeMode = 'default') => {
    if (!STATE.user) return null;

    STATE.user.themeMode = cleanText(themeMode, 'default');
    STATE.user.theme_mode = STATE.user.themeMode;
    STATE.user.updatedAt = nowIso();

    persistUser();

    return STATE.user;
  },

  // --------------------------------------------------
  // 7. OTURUM TEMİZLİĞİ
  // --------------------------------------------------

  clearSession: () => {
    STATE.user = null;
    safeRemoveUser();
    clearLegacyKeys();
  },

  clearAll: () => {
    STATE.user = null;
    safeRemoveUser();
    clearLegacyKeys();
  }
};

// ------------------------------------------------------
// İLK AÇILIŞ NORMALİZE
// ------------------------------------------------------

if (STATE.user) {
  STATE.user = normalizeUser(STATE.user);
  persistUser();
}

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------

window.STATE = STATE;
window.ME26_STATE = STATE;

console.info('ME26 state.js temiz final sürüm yüklendi.');

export default STATE;
