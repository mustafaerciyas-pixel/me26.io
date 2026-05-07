// Google'ın Güvenlik (Firebase) motorlarını projemize çağırıyoruz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

/* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI VE ŞİFRELERİ (config.js)
   Tüm şalterlerin ve kapı kilitlerinin bulunduğu anahtarlık
   ========================================================================== */

export const ME26_CONFIG = {
    // 1. SİSTEM MODU (Geliştirme aşamasında mı yoksa yayında mı olduğunu belirtir)
    mode: "production", // "production" demek sistem canlı yayında demek

    // 2. VIP (SİSTEM ELÇİSİ) PAYLAŞIM KURALLARI
    requiredInvitesForVip: 3, // Özel numara almak için WhatsApp'tan kaç kişiyi getirmeli?

    // 3. VIP KURUCU NUMARA ARALIĞI
    vipMin: 101,   // En küçük VIP numarası
    vipMax: 5000,  // En büyük VIP numarası

    // 4. KURUCU KONTENJANI
    founderLimit: 2000, // Sistemin ilk kurucu çekirdek kadrosu sınırı

    // 5. GÜVENLİK GÖREVLİSİ ŞİFRELERİ (Firebase: SMS ve Google Girişi İçin)
    firebaseConfig: {
        apiKey: "AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA",
        authDomain: "me26-io.firebaseapp.com",
        projectId: "me26-io",
        storageBucket: "me26-io.firebasestorage.app",
        messagingSenderId: "87570616950",
        appId: "1:87570616950:web:50c97a3de14a69efb4c557"
    },

    // 6. ÇELİK ARŞİV ŞİFRELERİ (Supabase: Oylar, Kullanıcılar, Önergeler İçin)
    supabaseUrl: "https://ukmkojfntsmueikjcrvz.supabase.co", 
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbWtvamZudHNtdWVpa2pjcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDkxOTIsImV4cCI6MjA5MzEyNTE5Mn0.qekCT-bHdmq7_31KDyFLzY33rA-jFJOqhK7gGg3ptVw" 
};

// ==========================================================================
// MOTORLARI ÇALIŞTIRMA BÖLÜMÜ
// ==========================================================================

// Yukarıdaki şifreleri kullanarak Google Güvenlik motorunu başlat
const app = initializeApp(ME26_CONFIG.firebaseConfig);

// Diğer dosyalar (örneğin auth.js) kullanabilsin diye kimlik doğrulama kapısını dışarı aç
export const auth = getAuth(app);
