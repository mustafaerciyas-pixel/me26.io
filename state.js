/* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI VE ŞALTERLER (js/config.js)
   ========================================================================== */

export const ME26_CONFIG = {
    // 1. SİSTEM ÇALIŞMA MODU
    // "local" = Dış servis olmadan tarayıcı içinde çalışır.
    // "production" = Gerçek veritabanı ve doğrulama servisleri devreye girer.
    mode: "local",

    // 2. DIŞ SERVİS BAĞLANTILARI
    // Direkt yayında gerçek servisler hazır oldukça true yapılacak.
    useFirebase: false,
    useSupabase: false,
    useRealSms: false,
    useRealPdf: false,

    // 3. GENEL LİMİTLER VE SABİTLER
    founderLimit: 2000,
    initialCount: 0,

    // 4. VIP KURUCU NUMARASI KURALLARI
    vipMin: 101,
    vipMax: 5000,
    requiredInvitesForVip: 3
};
