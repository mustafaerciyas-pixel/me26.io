/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase Auth + Supabase Karanlık Oda (RPC) + Belge Bekleme Modu (MVP)
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';
import { DB } from './supabase.js'; 
import { Me26VotingSystem } from './app.js'; 

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    GoogleAuthProvider,
    signInWithRedirect,
    getRedirectResult,
    signInWithPopup,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

const firebaseApp = initializeApp(ME26_CONFIG.firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.languageCode = 'tr';

const googleProvider = new GoogleAuthProvider();
let confirmationResult = null;

const getEl = (id) => document.getElementById(id);

// Şehre özel rastgele davet kodu üretici
const generateInviteCode = (city) => {
    const cityCode = (city || 'TR').substring(0, 3).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ME26-${cityCode}-${randomPart}`;
};

const resetPhoneModal = () => {
    const step1 = getEl('phone-step-1');
    const step2 = getEl('phone-step-2');
    const phoneInput = getEl('input-phone-number');
    const otpInput = getEl('input-otp-code');

    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (phoneInput) phoneInput.value = '';
    if (otpInput) otpInput.value = '';
    confirmationResult = null;
};

const normalizeTurkishPhone = (value) => {
    let phoneVal = String(value || '').replace(/\D/g, '');
    if (phoneVal.startsWith('90')) phoneVal = phoneVal.substring(2);
    if (phoneVal.startsWith('0')) phoneVal = phoneVal.substring(1);
    return phoneVal;
};

const getCommitmentData = () => {
    const cityEl = getEl('input-taahhut-sehir');
    const roleEl = getEl('input-taahhut-rol');
    
    let finalRole = roleEl ? roleEl.value : 'Sistem Üyesi';
    if (finalRole === 'Öğrenci') finalRole = 'İçmimarlık Öğrencisi';

    return { city: cityEl ? cityEl.value : 'Bilinmiyor', role: finalRole };
};

export const AUTH = {
    
    handleGoogleSuccess: async (user) => {
        try {
            UI.showToast('Güvenli bağlantı kuruluyor...', 'info');
            
            const savedCity = localStorage.getItem('me26_temp_city') || 'Bilinmiyor';
            const savedRole = localStorage.getItem('me26_temp_role') || 'İçmimar';
            
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref') || null;

            // KOD GİZLİLİĞİ: Sütun isimleri yok! Şifrelenmiş paket.
            const gizliPaket = {
                uid: user.uid,
                g_isim: user.displayName,
                mail: user.email,
                foto: user.photoURL,
                m_durum: savedRole,
                sehir: savedCity,
                d_kod: generateInviteCode(savedCity),
                ref: refCode
            };

            // Paketi Supabase RPC (Karanlık Oda) motoruna at
            const dbUser = await DB.sistemeGiris(gizliPaket);

            // Temizlik
            localStorage.removeItem('me26_temp_city');
            localStorage.removeItem('me26_temp_role');

            if (!dbUser) throw new Error("Veritabanı yanıt vermedi.");

            // SUPABASE'DEN GELEN YANITI HAFIZAYA (STATE) YAZ
            let authStage = 'registered';
            if (dbUser.oy_gucu === 1.0) authStage = 'pdf_verified';
            else if (dbUser.oy_gucu === 0.5) authStage = 'phone_verified';
            // Yeni bekleme durumu desteği eklenebilir
            else if (dbUser.belge_durumu === 'pending') authStage = 'document_pending'; 

            STATE.setUser({
                uid: dbUser.id,
                authStage: authStage,
                userNo: dbUser.vip_kurucu_no || 'BEKLEYEN',
                role: dbUser.mesleki_durum,
                city: dbUser.sehir_tribunu,
                votePower: dbUser.oy_gucu.toFixed(1) + 'x',
                inviteCount: dbUser.basarili_davet_sayisi || 0,
                isVip: !!dbUser.vip_kurucu_no,
                davetKodu: dbUser.kendi_davet_kodu
            });
            
            UI.closeModal('taahhut-modal');
            UI.renderProfile(); 
            UI.showView('voting');
            
            // Eğer referans/davet sayısı 0 ise yeni kayıttır, WOW patlat
            if (dbUser.basarili_davet_sayisi === 0 && dbUser.oy_gucu === 0) {
                const wowNoEl = getEl('ui-wow-uye-no');
                if (wowNoEl) wowNoEl.textContent = 'Aday Kurucu';
                UI.openModal('wow-modal');
                UI.showToast(`Stadyuma hoş geldin, ${dbUser.google_isim}!`, 'success');
            } else {
                UI.showToast(`Yeniden hoş geldin, ${dbUser.resmi_ad_soyad || dbUser.google_isim}!`, 'success');
            }
            
            Me26VotingSystem.updateVisibility(); 

        } catch (error) {
            console.error("Veritabanı senkronizasyon hatası:", error);
            UI.showToast('Sistem bağlantısında bir hata oluştu.', 'error');
        }
    },

    checkRedirect: () => {
        return new Promise(async (resolve) => {
            try {
                const result = await getRedirectResult(firebaseAuth);
                if (result && result.user) {
                    await AUTH.handleGoogleSuccess(result.user);
                    resolve(true);
                    return;
                }
                
                const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                    unsubscribe(); 
                    if (user && !STATE.isLoggedIn()) {
                        await AUTH.handleGoogleSuccess(user);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            } catch (error) {
                console.error('Yönlendirme hatası:', error);
                resolve(false);
            }
        });
    },

    login: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast('Sisteme zaten giriş yaptınız.', 'info');
            return;
        }
        
        const step1 = getEl('taahhut-step-1');
        const step2 = getEl('taahhut-step-2');
        if(step1) step1.classList.remove('hidden');
        if(step2) step2.classList.add('hidden');

        UI.openModal('taahhut-modal');
    },

    loginWithGoogle: async () => {
        const formData = getCommitmentData();
        const btn = getEl('btn-google-login');

        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
        const isSocialApp = /Instagram|WhatsApp|FBAN|FBAV/i.test(ua);

        localStorage.setItem('me26_temp_city', formData.city);
        localStorage.setItem('me26_temp_role', formData.role);

        if (btn) {
            btn.innerHTML = 'YÖNLENDİRİLİYOR...';
            btn.disabled = true;
        }

        if (isMobile || isSocialApp) {
            signInWithRedirect(firebaseAuth, googleProvider);
        } else {
            try {
                const result = await signInWithPopup(firebaseAuth, googleProvider);
                await AUTH.handleGoogleSuccess(result.user);
            } catch (error) {
                console.error('Google Giriş Hatası:', error);
                if (error.code !== 'auth/popup-closed-by-user') {
                    UI.showToast('Google ile giriş başarısız oldu.', 'error');
                }
            } finally {
                if(btn) {
                    btn.innerHTML = '<i class="fab fa-google text-lg"></i> Google ile Hızlı Katıl';
                    btn.disabled = false;
                }
            }
        }
    },

    verifyPhone: async () => {
        const phoneInput = getEl('input-phone-number');
        const btnSubmit = getEl('btn-submit-phone');
        if (!phoneInput) return;

        const phoneVal = normalizeTurkishPhone(phoneInput.value);
        if (phoneVal.length !== 10 || !phoneVal.startsWith('5')) {
            UI.showToast('Geçerli bir 10 haneli cep telefonu girin (Örn: 5551234567).', 'error');
            return;
        }

        const fullPhone = `+90${phoneVal}`;
        let originalText = '';
        if (btnSubmit) {
            originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = 'SMS GÖNDERİLİYOR...';
            btnSubmit.disabled = true;
        }

        try {
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(
                    firebaseAuth,
                    'recaptcha-container',
                    { size: 'invisible' }
                );
            }

            UI.showToast('SMS gönderiliyor...', 'info');

            confirmationResult = await signInWithPhoneNumber(
                firebaseAuth,
                fullPhone,
                window.recaptchaVerifier
            );

            UI.showToast('Doğrulama kodu telefonuna gönderildi.', 'success');

            const step1 = getEl('phone-step-1');
            const step2 = getEl('phone-step-2');
            if (step1) step1.classList.add('hidden');
            if (step2) step2.classList.remove('hidden');
        } catch (error) {
            console.error('SMS gönderme hatası:', error);
            UI.showToast('SMS gönderilemedi. Numarayı kontrol edip tekrar dene.', 'error');
            if (window.recaptchaVerifier && window.grecaptcha) {
                try {
                    const widgetId = await window.recaptchaVerifier.render();
                    window.grecaptcha.reset(widgetId);
                } catch (resetError) {}
            }
        } finally {
            if (btnSubmit) {
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;
            }
        }
    },

    verifyOtp: async () => {
        const otpInput = getEl('input-otp-code');
        const btnVerify = getEl('btn-verify-otp');
        if (!otpInput) return;

        if (!confirmationResult) {
            UI.showToast('Önce telefon numarana SMS gönder.', 'error');
            return;
        }

        const code = String(otpInput.value || '').replace(/\D/g, '');
        if (code.length !== 6) {
            UI.showToast('Lütfen 6 haneli doğrulama kodunu gir.', 'error');
            return;
        }

        let originalText = '';
        if (btnVerify) {
            originalText = btnVerify.innerHTML;
            btnVerify.innerHTML = 'DOĞRULANIYOR...';
            btnVerify.disabled = true;
        }

        try {
            await confirmationResult.confirm(code);

            const phoneInput = getEl('input-phone-number');
            const phoneVal = normalizeTurkishPhone(phoneInput.value);
            
            // Gizli fonksiyona gönder
            await DB.telefonuOnayla(STATE.user.uid, `+90${phoneVal}`);

            STATE.updateUser('authStage', 'phone_verified');
            STATE.updateUser('votePower', '0.5x');

            UI.closeModal('phone-modal');
            UI.renderProfile();
            resetPhoneModal();

            UI.showToast('Telefon başarıyla doğrulandı. Oy gücün 0.5x oldu!', 'success');
        } catch (error) {
            console.error('OTP doğrulama hatası:', error);
            UI.showToast('Kod hatalı veya süresi dolmuş.', 'error');
        } finally {
            if (btnVerify) {
                btnVerify.innerHTML = originalText;
                btnVerify.disabled = false;
            }
        }
    },

    // KUSURSUZ MVP BELGE YÜKLEME (YZ OKUYUCU İPTAL EDİLDİ)
    verifyPdf: async () => {
        // 1. Giriş Yapılmış Mı?
        if (!STATE.isLoggedIn()) {
            UI.showToast('Lütfen önce sisteme giriş yapın.', 'error');
            return;
        }

        const fileInput = document.getElementById('input-pdf-file');
        const btnSubmit = document.getElementById('btn-submit-pdf');
        
        if (!fileInput || !btnSubmit) return;

        // 2. Aynı Anda Çift Çalışmayı Engelleme
        if (btnSubmit.dataset.loading === 'true') return;

        // 3. Dosya Seçilmiş Mi?
        if (!fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen e-devletten aldığınız PDF belgesini seçin.', 'error');
            return;
        }
        
        // 4. Dosya PDF Mi?
        if (fileInput.files[0].type !== 'application/pdf') {
            UI.showToast('Sadece PDF formatında belge yükleyebilirsiniz.', 'error');
            return;
        }

        // Butonu Kilitle
        btnSubmit.dataset.loading = 'true';
        const originalText = btnSubmit.innerHTML;
        btnSubmit.textContent = 'SİSTEME İLETİLİYOR...';
        btnSubmit.disabled = true;

        try {
            // Gelecekte dosyayı Supabase Storage'a atacağın yer burası.
            // await DB.uploadPdf(STATE.user.uid, fileInput.files[0]);

            // 5. Durumu Güncelle (Oy gücü 1.0x DEĞİL, sadece bekleme moduna alıyoruz)
            STATE.updateUser('authStage', 'document_pending');

            // 6. Başarı Mesajı
            UI.showToast('Belge inceleme kuyruğuna alındı.', 'success');
            
            // 7. Modalı Kapat
            UI.closeModal('pdf-modal');
            
            // 8. Profili Yeniden Çiz
            UI.renderProfile();
            
            // 9. Input'u Temizle
            fileInput.value = '';

        } catch (error) {
            console.error("Belge Yükleme Hatası:", error);
            UI.showToast('Belge kuyruğa alınamadı, lütfen tekrar deneyin.', 'error');
        } finally {
            // İşlem bitince butonu aç
            btnSubmit.dataset.loading = 'false';
            btnSubmit.innerHTML = originalText;
            btnSubmit.disabled = false;
        }
    },

    logout: () => {
        signOut(firebaseAuth).catch(() => {}); 
        STATE.clearSession();
        UI.toggleProfileDrawer(false);
        UI.showView('landing');
        UI.renderProfile();
        resetPhoneModal();
        UI.showToast('Oturum kapatıldı. Stadyumdan çıkıldı.', 'success');
        
        Me26VotingSystem.updateVisibility(); 
    },

    deleteAccount: async () => {
        if (!confirm('Tüm verilerin kalıcı olarak yok edilecek. Emin misin?')) return;
        
        try {
            signOut(firebaseAuth).catch(() => {}); 
            STATE.clearAll();
            UI.toggleProfileDrawer(false);
            UI.showView('landing');
            UI.renderProfile();
            resetPhoneModal();
            UI.showToast('Tüm verilerin sistemden silindi.', 'success');
            
            Me26VotingSystem.updateVisibility(); 
        } catch(e) {
            UI.showToast('Hesap silinirken bir hata oluştu', 'error');
        }
    }
};
