/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   1 Tıkla Giriş + Kademeli Profilleme + SİNYAL MİMARİSİ
   ========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { ME26_CONFIG } from './config.js';
import { DB } from './supabase.js'; 
// DİKKAT: app.js importu (Kısa Devre yaptığı için) kaldırıldı!

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

const generateInviteCode = () => {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ME26-TR-${randomPart}`;
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

export const AUTH = {
    
    handleGoogleSuccess: async (user) => {
        try {
            UI.showToast('Güvenli bağlantı kuruluyor...', 'info');
            
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref') || null;

            const gizliPaket = {
                uid: user.uid,
                g_isim: user.displayName,
                mail: user.email,
                foto: user.photoURL,
                m_durum: 'Belirsiz', 
                sehir: 'Seçilmedi',  
                d_kod: generateInviteCode(),
                ref: refCode
            };

            const dbUser = await DB.sistemeGiris(gizliPaket);
            if (!dbUser) throw new Error("Veritabanı yanıt vermedi.");

            let authStage = 'registered';
            
            // GÜVENLİK SENSÖRÜ
            const guc = parseFloat(dbUser.oy_gucu || 0);
            
            if (guc >= 1.0) authStage = 'pdf_verified';
            else if (dbUser.telefon) authStage = 'phone_verified';
            
            if (dbUser.belge_durumu === 'Onay Bekliyor' || dbUser.belge_durumu?.includes('Bekliyor')) {
                authStage = 'document_pending'; 
            }

            STATE.setUser({
                uid: dbUser.id,
                authStage: authStage,
                userNo: dbUser.vip_kurucu_no || 'BEKLEYEN',
                role: dbUser.mesleki_durum,
                city: dbUser.sehir_tribunu,
                votePower: guc.toFixed(1) + 'x',
                inviteCount: dbUser.basarili_davet_sayisi || 0,
                isVip: !!dbUser.vip_kurucu_no,
                davetKodu: dbUser.kendi_davet_kodu
            });
            
            UI.renderProfile(); 
            UI.showView('voting');
            
            if (dbUser.basarili_davet_sayisi === 0 && guc === 0 && (!dbUser.telefon)) {
                const wowNoEl = getEl('ui-wow-uye-no');
                if (wowNoEl) wowNoEl.textContent = 'Aday Kurucu';
                UI.openModal('wow-modal');
                UI.showToast(`Stadyuma hoş geldin, ${dbUser.google_isim}!`, 'success');
            } else {
                UI.showToast(`Yeniden hoş geldin, ${dbUser.resmi_ad_soyad || dbUser.google_isim}!`, 'success');
            }
            
            // HAVAYA SİNYAL FİŞEĞİ AT (app.js bunu duyup ekranı güncelleyecek)
            window.dispatchEvent(new Event('auth_changed'));

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

    loginWithGoogle: async () => {
        if (STATE.isLoggedIn()) {
            UI.showView('voting');
            UI.renderProfile();
            UI.showToast('Sisteme zaten giriş yaptınız.', 'info');
            return;
        }

        UI.showToast('Google ile bağlantı kuruluyor...', 'info');

        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
        const isSocialApp = /Instagram|WhatsApp|FBAN|FBAV/i.test(ua);

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
            }
        }
    },

    verifyPhone: async () => {
        const phoneInput = getEl('input-phone-number');
        const btnSubmit = getEl('btn-submit-phone');
        if (!phoneInput) return;

        const phoneVal = normalizeTurkishPhone(phoneInput.value);
        if (phoneVal.length !== 10 || !phoneVal.startsWith('5')) {
            UI.showToast('Geçerli bir 10 haneli cep telefonu girin.', 'error');
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
            
            await DB.telefonuOnayla(STATE.user.uid, `+90${phoneVal}`);

            STATE.updateUser('authStage', 'phone_verified');

            UI.closeModal('phone-modal');
            UI.renderProfile();
            resetPhoneModal();

            UI.showToast('Telefon doğrulandı (Bot Kontrolü). Şimdi PDF yükleme sırası!', 'success');
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

    verifyPdf: async () => {
        if (!STATE.isLoggedIn()) {
            UI.showToast('Lütfen önce sisteme giriş yapın.', 'error');
            return;
        }

        const fileInput = document.getElementById('input-pdf-file');
        const btnSubmit = document.getElementById('btn-submit-pdf');
        
        if (!fileInput || !btnSubmit) return;
        if (btnSubmit.dataset.loading === 'true') return;

        if (!fileInput.files || fileInput.files.length === 0) {
            UI.showToast('Lütfen e-devletten aldığınız PDF belgesini seçin.', 'error');
            return;
        }
        
        if (fileInput.files[0].type !== 'application/pdf') {
            UI.showToast('Sadece PDF formatında belge yükleyebilirsiniz.', 'error');
            return;
        }

        btnSubmit.dataset.loading = 'true';
        const originalText = btnSubmit.innerHTML;
        btnSubmit.textContent = 'BELGE DEŞİFRE EDİLİYOR...';
        btnSubmit.disabled = true;

        try {
            const file = fileInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);
            
            const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
            if (!pdfjsLib) throw new Error("PDF kütüphanesi bulunamadı.");
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            
            let rawItems = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                rawItems = rawItems.concat(textContent.items);
            }
            
            rawItems.sort((a, b) => {
                if (!a.transform || !b.transform) return 0;
                const yDiff = b.transform[5] - a.transform[5];
                if (Math.abs(yDiff) > 5) return yDiff; 
                return a.transform[4] - b.transform[4]; 
            });
            
            let cleanText = rawItems.map(item => item.str).join(' ').replace(/\s+/g, ' ');

            const extract = (regex) => {
                const match = cleanText.match(regex);
                return match ? match[1].replace(/[:|]+$/, '').trim() : 'Bulunamadı';
            };

            let tcMatch = cleanText.match(/Kimlik No[\s:|]*([0-9]{11})/i);
            let tc = tcMatch ? tcMatch[1] : 'Bulunamadı';
            if(tc === 'Bulunamadı') {
                const fallback = cleanText.match(/\b[1-9][0-9]{10}\b/);
                tc = fallback ? fallback[0] : 'Bulunamadı';
            }

            const adSoyad = extract(/Adı Soyadı[\s:|]*(.*?)(?=Baba Adı|Anne Adı|Doğum Tarihi|Program)/i);
            const babaAdi = extract(/Baba Adı[\s:|]*(.*?)(?=Anne Adı|Doğum Tarihi|Program)/i);
            const anneAdi = extract(/Anne Adı[\s:|]*(.*?)(?=Doğum Tarihi|Program)/i);
            const dogumTarihi = extract(/Doğum Tarihi[\s:|]*(\d{2}\.\d{2}\.\d{4})/i);

            const programStr = extract(/Program[\s:|]*(.*?)(?=Diploma No|Diploma Notu|Mezuniyet)/i);
            let uni = 'Bulunamadı', fakulte = 'Bulunamadı', bolum = 'Bulunamadı';
            
            if (programStr !== 'Bulunamadı') {
                const parts = programStr.split('/');
                if(parts.length >= 3) {
                    uni = parts[0].trim();
                    fakulte = parts[1].trim();
                    bolum = parts.slice(2).join('/').trim(); 
                } else {
                    bolum = programStr;
                }
            }
            
            const diplomaNo = extract(/Diploma No[\s:|]*(.*?)(?=Diploma Notu|Mezuniyet|Durum)/i);
            const diplomaNotu = extract(/Diploma Notu[\s:|]*(.*?)(?=Mezuniyet Tarihi|Durum|İLGİLİ)/i);
            const mezunTarihi = extract(/Mezuniyet Tarihi[\s:|]*(\d{2}\.\d{2}\.\d{4})/i);
            const okunanDurum = extract(/Durum[\s:|]*(.*?)(?=İLGİLİ MAKAMA|Çankaya|Bu belgenin|$)/i);

            const barkodMatch = cleanText.match(/YOK[A-Z0-9]+/i);
            const barkod = barkodMatch ? barkodMatch[0] : 'Bulunamadı';

            const isIcmimar = cleanText.toUpperCase().includes('İÇ MİMAR') || cleanText.toUpperCase().includes('İÇMİMAR');
            const belgeDurumu = 'Onay Bekliyor';

            const belgeData = {
                tc: tc,
                ad_soyad: adSoyad,
                baba_adi: babaAdi,
                anne_adi: anneAdi,
                dogum_tarihi: dogumTarihi,
                uni: uni,
                fakulte: fakulte,
                bolum: bolum,
                diploma_no: diplomaNo,
                diploma_notu: diplomaNotu,     
                mezuniyet_tarihi: mezunTarihi, 
                durum: okunanDurum,            
                belge_durumu: belgeDurumu,     
                barkod: barkod
            };

            await DB.belgeyiSirayaAl(STATE.user.uid, belgeData);
            STATE.updateUser('authStage', 'document_pending');

            if (isIcmimar) {
                UI.showToast('Belgeniz başarıyla okundu ve Yönetici Onayına gönderildi.', 'success');
            } else {
                UI.showToast('Belgeniz incelenmek üzere onay kuyruğuna eklendi.', 'info');
            }
            
            UI.closeModal('pdf-modal');
            UI.renderProfile();
            fileInput.value = '';

        } catch (error) {
            console.error("Belge Okuma Hatası:", error);
            UI.showToast('Belge okunamadı. Lütfen orijinal PDF yüklediğinizden emin olun.', 'error');
        } finally {
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
        
        window.dispatchEvent(new Event('auth_changed')); // Sinyal gönder
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
            
            window.dispatchEvent(new Event('auth_changed')); // Sinyal gönder
        } catch(e) {
            UI.showToast('Hesap silinirken bir hata oluştu', 'error');
        }
    }
};
