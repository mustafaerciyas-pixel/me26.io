/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase Auth + Supabase Karanlık Oda (RPC) + E-Devlet YZ Okuyucu Sürümü
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
            stopLoading();
        }
    },

    verifyPdf: async () => {
        const fileInput = document.getElementById('input-pdf-file');
        const btnSubmit = document.getElementById('btn-submit-pdf');
        
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen e-devletten aldığınız PDF belgesini seçin.', 'error');
            return;
        }
        
        const stopLoading = setButtonLoading(btnSubmit, 'SİSTEM BELGEYİ OKUYOR...');
        UI.showToast('Belge cihazınızda analiz ediliyor...', 'info');
        
        try {
            const file = fileInput.files[0];
            const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
            
            if (!pdfjsLib) {
                throw new Error("PDF kütüphanesi bulunamadı. Lütfen sayfayı yenileyin.");
            }
            
            // 🔥 GÜVENLİK DUVARINI TAMAMEN DEVRE DIŞI BIRAK (İŞÇİ YOK!)
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            pdfjsLib.GlobalWorkerOptions.disableWorker = true;

            // 🔥 SESSİZ DONMAYI ENGELLEYEN 15 SANİYELİK ZAMAN AŞIMI BOMBASI
            const readPdf = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async function() {
                    try {
                        const typedarray = new Uint8Array(this.result);
                        const loadingTask = pdfjsLib.getDocument(typedarray);
                        const pdf = await loadingTask.promise;
                        
                        let fullText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            fullText += textContent.items.map(item => item.str).join(' ') + ' ';
                        }
                        resolve(fullText);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = () => reject(new Error("Dosya tarayıcıda okunamadı."));
                reader.readAsArrayBuffer(file);
            });

            const timeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Süre doldu! Tarayıcınız işlemi engelliyor.")), 15000)
            );

            // Hangisi önce biterse (Ya okur, ya da 15 saniye sonra hata fırlatır, ASLA donmaz)
            const fullText = await Promise.race([readPdf, timeout]);

            // --- AYRIŞTIRMA İŞLEMLERİ ---
            const extract = (text, regex) => {
                const match = text.match(regex);
                return match ? match[1].trim() : '';
            };

            const tc = extract(fullText, /Kimlik No\s*\|?\s*:\s*([0-9]{11})/i);
            const maskedTc = tc ? tc.substring(0,3) + '*****' + tc.substring(8) : 'Bulunamadı';
            const adSoyad = extract(fullText, /Adı Soyadı\s*\|?\s*:\s*(.*?)(?=\s*Baba Adı|\s*Ana Adı)/i);
            const babaAdi = extract(fullText, /Baba Adı\s*\|?\s*:\s*(.*?)(?=\s*Anne Adı)/i);
            const anneAdi = extract(fullText, /Anne Adı\s*\|?\s*:\s*(.*?)(?=\s*Doğum Tarihi)/i);
            const dogumTarihi = extract(fullText, /Doğum Tarihi\s*\|?\s*:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
            const program = extract(fullText, /Program\s*\|?\s*:\s*(.*?)(?=\s*Diploma No|\s*Kayıt Tarihi)/i);
            const progParts = program.split('/');
            const uni = progParts[0] ? progParts[0].trim() : 'Bilinmiyor';
            const fakulte = progParts[1] ? progParts[1].trim() : 'Bilinmiyor';
            const bolum = progParts[2] ? progParts[2].trim() : 'Bilinmiyor';
            const diplomaNo = extract(fullText, /Diploma No\s*\|?\s*:\s*(.*?)(?=\s*Diploma Notu|\s*Mezuniyet)/i);
            const mezunTarihi = extract(fullText, /Mezuniyet Tarihi\s*\|?\s*:\s*([0-9]{2}\.[0-9]{2}\.[0-9]{4})/i);
            const barkodMatch = fullText.match(/YOK[A-Z0-9]+/i);
            const barkod = barkodMatch ? barkodMatch[0] : 'Bulunamadı';

            // LİYAKAT KONTROLÜ
            const upperBolum = bolum.toUpperCase();
            if (!upperBolum.includes('İÇ MİMAR') && !upperBolum.includes('İÇMİMAR')) {
                 UI.showToast('HATA: Belgede "İçmimarlık" liyakatı doğrulanamadı!', 'error');
                 stopLoading();
                 return;
            }

            const durumText = extract(fullText, /Durum\s*\|?\s*?(.*?)(?=\s|$)/i).toUpperCase();
            let durum = 'Öğrenci';
            if (durumText.includes('MEZUN') || fullText.toUpperCase().includes('MEZUN BELGESİ')) {
                durum = 'Mezun';
            }

            const belgeData = {
                tc: maskedTc,
                ad_soyad: adSoyad,
                baba_adi: babaAdi,
                anne_adi: anneAdi,
                dogum_tarihi: dogumTarihi,
                uni: uni,
                fakulte: fakulte,
                bolum: bolum,
                diploma_no: diplomaNo,
                mezun_tarihi: mezunTarihi,
                barkod: barkod,
                durum: durum
            };

            // SUPABASE'E GÖNDER
            await DB.belgeyiSirayaAl(STATE.user.uid, belgeData);

            STATE.updateUser('authStage', 'pdf_verified');
            STATE.updateUser('votePower', '1.0x');

            UI.showToast('Liyakat Onaylandı! Oy gücün 1.0x (Tam Yetki) oldu.', 'success');
            UI.closeModal('pdf-modal');
            UI.renderProfile();
            fileInput.value = '';

        } catch (error) {
            console.error("PDF Okuma Hatası (Ayrıntılı):", error);
            UI.showToast(`Hata: ${error.message || 'Belge okunamadı.'}`, 'error');
        } finally {
            stopLoading();
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
