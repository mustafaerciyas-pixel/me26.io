import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

    // 5. FIREBASE SMS & AUTH BAĞLANTI AYARLARI 
    firebaseConfig: {
        apiKey: "AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA",
        authDomain: "me26-io.firebaseapp.com",
        projectId: "me26-io",
        storageBucket: "me26-io.firebasestorage.app",
        messagingSenderId: "87570616950",
        appId: "1:87570616950:web:50c97a3de14a69efb4c557"
    },

    // 6. SUPABASE VERİTABANI BAĞLANTISI 
    supabaseUrl: "https://ukmkojfntsmueikjcrvz.supabase.co", 
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbWtvamZudHNtdWVpa2pjcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDkxOTIsImV4cCI6MjA5MzEyNTE5Mn0.qekCT-bHdmq7_31KDyFLzY33rA-jFJOqhK7gGg3ptVw" 
};

// ==========================================================================
// MOTORLARI ÇALIŞTIRMA BÖLÜMÜ (İşte eksik olan buydu!)
// ==========================================================================

// Firebase uygulamasını yukarıdaki ME26_CONFIG içindeki bilgilerle başlat
const app = initializeApp(ME26_CONFIG.firebaseConfig);

// Auth (Giriş) motorunu çalıştır ve dışarıya ihraç et ki auth.js kullanabilsin
export const auth = getAuth(app);
