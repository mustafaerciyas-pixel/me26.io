 /* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI VE YAPILANDIRMA (config.js)
   ========================================================================== */

export const ME26_CONFIG = {
    // 1. SİSTEM MODU
    // "production" = Direkt yayın
    mode: "production",

    // 2. VIP PAYLAŞIM KURALLARI
    requiredInvitesForVip: 3,

    // 3. VIP KURUCU NUMARA ARALIĞI
    vipMin: 101,
    vipMax: 5000,

    // 4. KURUCU KONTENJANI
    founderLimit: 2000,
    initialCount: 0,

    // 5. FIREBASE SMS & AUTH BAĞLANTI AYARLARI
    firebaseConfig: {
        apiKey: "AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA",
        authDomain: "me26-io.firebaseapp.com",
        projectId: "me26-io",
        storageBucket: "me26-io.firebasestorage.app",
        messagingSenderId: "87570616950",
        appId: "1:87570616950:web:50c97a3de14a69efb4c557"
    }
};