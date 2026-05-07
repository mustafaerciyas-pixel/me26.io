/* ==========================================================================
   ME26 AĞI - SİSTEM AYARLARI (config.js)
   Cloudflare Workers Canlı Test Sürümü
   --------------------------------------------------------------------------
   Geçici canlı adres:
   https://me26.mustafaerciyas.workers.dev

   me26.io domaini bağlanınca sadece officialBaseUrl ve inviteBaseUrl değişecek.

   ÖNEMLİ:
   Bu dosyaya ASLA service_role key, admin key, gizli şifre veya özel token yazma.
   Supabase tarafında sadece anon / publishable key kullanılmalıdır.
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ======================================================
// ME26 ANA AYARLARI
// ======================================================
export const ME26_CONFIG = {
    // --------------------------------------------------
    // 1. SİSTEM MODU
    // --------------------------------------------------
    mode: "production",

    // --------------------------------------------------
    // 2. CANLI TEST ADRESLERİ
    // --------------------------------------------------
    officialBaseUrl: "https://me26.mustafaerciyas.workers.dev",
    inviteBaseUrl: "https://me26.mustafaerciyas.workers.dev",

    // --------------------------------------------------
    // 3. VIP / KURUCU ÜYE KURALLARI
    // --------------------------------------------------
    requiredInvitesForVip: 3,
    vipMin: 101,
    vipMax: 5000,
    founderLimit: 2000,

    // --------------------------------------------------
    // 4. DOSYA / BELGE KURALLARI
    // --------------------------------------------------
    maxPdfSizeMb: 10,
    allowedPdfMimeTypes: [
        "application/pdf"
    ],

    // --------------------------------------------------
    // 5. FIREBASE
    // Google giriş, telefon doğrulama ve reCAPTCHA için kullanılır.
    // --------------------------------------------------
    firebaseConfig: {
        apiKey: "AIzaSyBYbh_AjnBGsapwfIy68vTJ_ivcgSSvIOA",
        authDomain: "me26-io.firebaseapp.com",
        projectId: "me26-io",
        storageBucket: "me26-io.firebasestorage.app",
        messagingSenderId: "87570616950",
        appId: "1:87570616950:web:50c97a3de14a69efb4c557"
    },

    // --------------------------------------------------
    // 6. SUPABASE
    // Bu key anon / publishable key olmalı; service_role ASLA buraya yazılmamalı.
    // --------------------------------------------------
    supabaseUrl: "https://ukmkojfntsmueikjcrvz.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InVrbWtvamZudHNtdWVpa2pjcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDkxOTIsImV4cCI6MjA5MzEyNTE5Mn0.qekCT-bHdmq7_31KDyFLzY33rA-jFJOqhK7gGg3ptVw"
};

// ======================================================
// FIREBASE BAŞLATMA
// ======================================================
const app = initializeApp(ME26_CONFIG.firebaseConfig);

export const auth = getAuth(app);
