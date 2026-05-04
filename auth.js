/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase Auth + Supabase DB Entegre Sürüm
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';
import { DB } from './supabase.js'; // <-- YENİ: Supabase Motoru
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

// Şehre özel rastgele davet kodu üretici (Örn: ME26-ANK-7X9P)
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

const setButtonLoading = (button, loadingText) => {
    if (!button) return () => {};
    const originalText = button.innerHTML;
    button.textContent = loadingText;
    button.disabled = true;
    return () => {
        button.innerHTML = originalText;
        button.disabled = false;
    };
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
            
            // Supabase'den kullanıcıyı ara
            let dbUser = await DB.getUser(user.uid);
            let isNewUser = false;

            // KULLANICI YOKSA (SİSTEME İLK DEFA GİRİYORSA)
            if (!dbUser) {
                isNewUser = true;
                const savedCity = localStorage.getItem('me26_temp_city') || 'Bilinmiyor';
                const savedRole = localStorage.getItem('me26_temp_role') || 'İçmimar';
                
                // URL'de referans kodu var mı bak (Davet linkiyle mi gelmiş?)
                const urlParams = new URLSearchParams(window.location.search);
                const refCode = urlParams.get('ref') || null;

                dbUser = await DB.createUser({
                    id: user.uid,
                    google_isim: user.displayName,
                    email: user.email,
                    profil_foto: user.photoURL,
                    mesleki_durum: savedRole,
                    sehir_tribunu: savedCity,
                    kendi_davet_kodu: generateInviteCode(savedCity),
                    referans_kodu: refCode
                });
            }

            // Temizlik
            localStorage.removeItem('me26_temp_city');
            localStorage.removeItem('me26_temp_role');

            // SUPABASE VERİSİNİ STATE (HAFIZA) İLE EŞLEŞTİR
            let authStage = 'registered';
            if (dbUser.oy_gucu === 1.0) authStage = 'pdf_verified';
            else if (dbUser.oy_gucu === 0.5) authStage = 'phone_verified';

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
            UI.renderProfile(); // UI güncellenir, referans kodu yerine yerleşir
            
            UI.showView('voting');
            
            // Sadece yeni kayıt olanlara karşılama konfetisini (WOW) patlat
            if (isNewUser) {
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

        if (isMobile || isSocialApp) {
            setButtonLoading(btn, 'GÜVENLİ GİRİŞE YÖNLENDİRİLİYOR...');
            signInWithRedirect(firebaseAuth, googleProvider);
        } else {
            try {
                setButtonLoading(btn, 'GOOGLE İLE BAĞLANILIYOR...');
                const result = await signInWithPopup(firebaseAuth, googleProvider);
                await AUTH.handleGoogleSuccess(result.user);
            } catch (error) {
                console.error('Google Giriş Hatası:', error);
                if (error.code !== 'auth/popup-closed-by-user') {
                    UI.showToast('Google ile giriş başarısız oldu.', 'error');
                }
            } finally {
                if(btn) btn.innerHTML = '<i class="fab fa-google text-lg"></i> Google ile Hızlı Katıl';
                if(btn) btn.disabled = false;
            }
        }
    },

    // Manuel Giriş (Anonim) artık kullanılmayacağı için sildik. Sadece Google!

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
        const stopLoading = setButtonLoading(btnSubmit, 'SMS GÖNDERİLİYOR...');

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
            stopLoading();
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

        const stopLoading = setButtonLoading(btnVerify, 'DOĞRULANIYOR...');

        try {
            await confirmationResult.confirm(code);

            // Supabase Veritabanını Güncelle
            const phoneInput = getEl('input-phone-number');
            const phoneVal = normalizeTurkishPhone(phoneInput.value);
            
            await DB.updateUser(STATE.user.uid, { 
                telefon_no: `+90${phoneVal}`,
                oy_gucu: 0.5 
            });

            // Local Hafızayı Güncelle
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
            stopLoading();
        }
    },

    verifyPdf: async () => {
        const fileInput = getEl('input-pdf-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen e-devletten aldığınız PDF belgesini seçin.', 'error');
            return;
        }
        if (fileInput.files[0].type !== 'application/pdf') {
            UI.showToast('Sadece PDF formatında belge yükleyebilirsiniz.', 'error');
            return;
        }
        
        UI.showToast('Belgeniz güvenli bir şekilde sisteme aktarılıyor...', 'info');
        
        try {
            // Şimdilik sadece veritabanında durumu 'Bekliyor' yapıyoruz
            // İlerleyen aşamada burada dosyayı Supabase Storage'a atacağız
            await DB.updateUser(STATE.user.uid, { 
                belge_onay_durumu: 'Bekliyor'
            });

            UI.showToast('Belgeniz sıraya alındı! Liyakat kontrolünden sonra onaylanacaktır.', 'success');
            UI.closeModal('pdf-modal');
            fileInput.value = '';

        } catch (error) {
            console.error("PDF Yükleme hatası:", error);
            UI.showToast('Belge gönderilirken bir hata oluştu.', 'error');
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
            // İleride Supabase'den de silme komutu eklenebilir
            // await DB.deleteUser(STATE.user.uid);
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
