/* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI (config.js)
   Temiz Final Sürüm

   Görev:
   - Firebase app başlatma
   - Firebase Auth export etme
   - ME26_CONFIG export etme
   - Supabase public/anon bağlantı bilgilerini tek merkezde tutma

   ÖNEMLİ:
   - Bu dosyada ASLA service_role key, admin key, gizli token veya özel şifre olmaz.
   - Supabase tarafında sadece anon / publishable key kullanılır.
========================================================================== */

import {
  initializeApp,
  getApp,
  getApps
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';

import {
  getAuth
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// ------------------------------------------------------
// ME26 ANA AYARLARI
// ------------------------------------------------------

export const ME26_CONFIG = {
  // --------------------------------------------------
  // 1. SİSTEM MODU
  // --------------------------------------------------
  mode: 'production',

  // --------------------------------------------------
  // 2. CANLI TEST ADRESLERİ
  // me26.io domaini bağlanınca sadece bu iki adres değişebilir.
  // --------------------------------------------------
  officialBaseUrl: 'https://me26.mustafaerciyas.workers.dev',
  inviteBaseUrl: 'https://me26.mustafaerciyas.workers.dev',

  // --------------------------------------------------
  // 3. PROJE KİMLİĞİ
  // --------------------------------------------------
  projectName: 'ME26 Ağı',
  projectShortName: 'ME26',
  projectSlogan: 'İnsan Yönetici Yok. Kurallar Var.',

  // --------------------------------------------------
  // 4. VIP / KURUCU ÜYE KURALLARI
  // --------------------------------------------------
  requiredInvitesForVip: 3,
  vipMin: 101,
  vipMax: 5000,
  founderLimit: 2000,

  // --------------------------------------------------
  // 5. DOSYA / BELGE KURALLARI
  // --------------------------------------------------
  maxPdfSizeMb: 10,
  allowedPdfMimeTypes: [
    'application/pdf'
  ],

  // --------------------------------------------------
  // 6. TELEFON / SMS KURALLARI
  // --------------------------------------------------
  smsDailyLimit: 5,
  smsCooldownSeconds: 60,
  defaultPhoneCountry: 'TR',

  // --------------------------------------------------
  // 7. DAVET / REFERANS
  // --------------------------------------------------
  inviteQueryKey: 'ref',
  defaultInviteCode: 'TR-IA-BEKLEYEN',

  // --------------------------------------------------
  // 8. FIREBASE
  // Google giriş, telefon doğrulama ve reCAPTCHA için kullanılır.
  // Firebase apiKey frontend tarafında public kabul edilir.
  // --------------------------------------------------
  firebaseConfig: {
    apiKey: 'AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA',
    authDomain: 'me26-io.firebaseapp.com',
    projectId: 'me26-io',
    storageBucket: 'me26-io.firebasestorage.app',
    messagingSenderId: '87570616950',
    appId: '1:87570616950:web:50c97a3de14a69efb4c557'
  },

  // --------------------------------------------------
  // 9. SUPABASE
  // Bu key anon/public key'dir.
  // Service role veya secret key ASLA frontend'e yazılmayacak.
  // --------------------------------------------------
  supabaseUrl: 'https://ukmkojfntsmueikjcrvz.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbWtvamZudHNtdWVpa2pjcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDkxOTIsImV4cCI6MjA5MzEyNTE5Mn0.qekCT-bHdmq7_31KDyFLzY33rA-jFJOqhK7gGg3ptVw',

  // Aynı key için alias.
  // Bazı dosyalar supabaseAnonKey beklerse uyumlu çalışsın.
  get supabaseAnonKey() {
    return this.supabaseKey;
  }
};

// ------------------------------------------------------
// BASİT DOĞRULAMA
// ------------------------------------------------------

function validateConfig() {
  const requiredValues = [
    ['officialBaseUrl', ME26_CONFIG.officialBaseUrl],
    ['inviteBaseUrl', ME26_CONFIG.inviteBaseUrl],
    ['firebaseConfig.apiKey', ME26_CONFIG.firebaseConfig?.apiKey],
    ['firebaseConfig.authDomain', ME26_CONFIG.firebaseConfig?.authDomain],
    ['firebaseConfig.projectId', ME26_CONFIG.firebaseConfig?.projectId],
    ['supabaseUrl', ME26_CONFIG.supabaseUrl],
    ['supabaseKey', ME26_CONFIG.supabaseKey]
  ];

  const missing = requiredValues
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`ME26 config eksik: ${missing.join(', ')}`);
  }

  if (!ME26_CONFIG.supabaseUrl.startsWith('https://')) {
    throw new Error('ME26 config hatası: supabaseUrl https ile başlamalıdır.');
  }

  if (!ME26_CONFIG.officialBaseUrl.startsWith('https://')) {
    throw new Error('ME26 config hatası: officialBaseUrl https ile başlamalıdır.');
  }
}

validateConfig();

// ------------------------------------------------------
// FIREBASE BAŞLATMA
// ------------------------------------------------------

export const firebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(ME26_CONFIG.firebaseConfig);

export const auth = getAuth(firebaseApp);

// Google/Firebase arayüz dili
auth.languageCode = 'tr';

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------
//
// ui.js import kullanmadan window.ME26_CONFIG okuyabiliyor.
// Bu yüzden global köprü önemli.
//

window.ME26_CONFIG = ME26_CONFIG;
window.ME26_FIREBASE_APP = firebaseApp;
window.ME26_FIREBASE_AUTH = auth;

// ------------------------------------------------------
// DEFAULT EXPORT
// ------------------------------------------------------

export default ME26_CONFIG;

console.info('ME26 config.js temiz final sürüm yüklendi.');
