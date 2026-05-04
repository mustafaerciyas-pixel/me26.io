/* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI VE YAPILANDIRMA (config.js)
   ========================================================================== */

export const ME26_CONFIG = {
    // 1. SİSTEM MODU
    mode: "production",

    // 2. VIP PAYLAŞIM KURALLARI
    requiredInvitesForVip: 3,

    // 3. VIP KURUCU NUMARA ARALIĞI
    vipMin: 101,
    vipMax: 5000,

    // 4. KURUCU KONTENJANI
    founderLimit: 2000,

    // 5. FIREBASE SMS & AUTH BAĞLANTI AYARLARI (Senin mevcut ayarların)
    firebaseConfig: {
        apiKey: "AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA",
        authDomain: "me26-io.firebaseapp.com",
        projectId: "me26-io",
        storageBucket: "me26-io.firebasestorage.app",
        messagingSenderId: "87570616950",
        appId: "1:87570616950:web:50c97a3de14a69efb4c557"
    },

    // 6. SUPABASE VERİTABANI BAĞLANTISI
    // Buraya Supabase panelinden aldığın Project URL ve API Key gelecek
    supabaseUrl: "BURAYA_SUPABASE_URL_YAZILACAK",
    supabaseKey: "BURAYA_SUPABASE_ANON_KEY_YAZILACAK"
};
