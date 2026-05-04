/* ==========================================================================
   ME26 AĞI - KİMLİK VE YETKİ YÖNETİCİSİ (auth.js)
   Firebase Auth + Supabase Karanlık Oda (RPC) + E-Devlet Nokta Atışı Okuyucu
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

            const dbUser = await DB.sistemeGiris(gizliPaket);

            localStorage.removeItem('me26_temp_city');
            localStorage.removeItem('me26_temp_role');

            if (!dbUser) throw new Error("Veritabanı yanıt vermedi.");

            let authStage = 'registered';
            if (dbUser.oy_gucu === 1.0) authStage = 'pdf_verified';
            else if (dbUser.oy_gucu === 0.5) authStage = 'phone_verified';
            
            if (dbUser.belge_durumu === 'pending' || dbUser.belge_durumu?.includes('İnceleme')) {
                authStage = 'document_pending'; 
            }

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

    // TAM UYUMLU E-DEVLET OKUYUCU (Maskesiz TC, Manuel İnceleme)
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
        btnSubmit.textContent = 'BELGE PARÇALANIYOR...';
        btnSubmit.disabled = true;

        try {
            const file = fileInput.files[0];
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);
            
            const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
            if (!pdfjsLib) throw new Error("PDF kütüphanesi bulunamadı.");
            
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + ' ';
            }
            
            fullText = fullText.replace(/\s+/g, ' ');

            // NOKTA ATIŞI BİLGİ KOPARICI
            const parseField = (text, startLabel, endLabel) => {
                const escapedStart = startLabel.replace(/\./g, '\\.');
                const escapedEnd = endLabel ? endLabel.replace(/\./g, '\\.') : '$';
                const regex = new RegExp(`${escapedStart}\\s*\\|?\\s*:?\\s*(.*?)\\s*(?=${escapedEnd})`, 'i');
                const match = text.match(regex);
                if (match) {
                    return match[1].replace(/[:|]+$/, '').trim();
                }
                return 'Bulunamadı';
            };

            // 1. TC Kimlik No (Tam halini alır, maskeleme yok)
            const tcMatch = fullText.match(/Kimlik No\s*\|?\s*:?\s*([0-9]{11})/i);
            const tc = tcMatch ? tcMatch[1] : 'Bulunamadı';
            
            // 2. İsimler
            const adSoyad = parseField(fullText, 'Adı Soyadı', 'Baba Adı');
            const babaAdi = parseField(fullText, 'Baba Adı', 'Anne Adı');
            const anneAdi = parseField(fullText, 'Anne Adı', 'Doğum Tarihi');
            const dogumTarihi = parseField(fullText, 'Doğum Tarihi', 'Program');
            
            // 3. Okul ve Bölüm
            const programRaw = parseField(fullText, 'Program', 'Diploma No');
            let uni = 'Bulunamadı', fakulte = 'Bulunamadı', bolum = 'Bulunamadı';
            
            if (programRaw !== 'Bulunamadı') {
                const parts = programRaw.split('/');
                if(parts.length >= 3) {
                    uni = parts[0].trim();
                    fakulte = parts[1].trim();
                    bolum = parts[2].trim();
                } else {
                    bolum = programRaw;
                }
            }
            
            // 4. Diğer Belgeler
            const diplomaNo = parseField(fullText, 'Diploma No', 'Diploma Notu');
            const mezunTarihi = parseField(fullText, 'Mezuniyet Tarihi', 'Durum');

            const barkodMatch = fullText.match(/YOK[A-Z0-9]+/i);
            const barkod = barkodMatch ? barkodMatch[0] : 'Bulunamadı';

            // KESİN KURAL: Herkes Manuel Onay sırasına girer
            const isIcmimar = fullText.toUpperCase().includes('İÇ MİMAR') || fullText.toUpperCase().includes('İÇMİMAR');
            const gercekDurum = 'İncelemeye Alındı'; 

            // ÇIKARTILAN GERÇEK VERİLER
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
                mezun_tarihi: mezunTarihi,
                barkod: barkod,
                durum: gercekDurum
            };

            await DB.belgeyiSirayaAl(STATE.user.uid, belgeData);

            // Kullanıcıyı her zaman "bekleyen belge" aşamasına al
            STATE.updateUser('authStage', 'document_pending');

            if (isIcmimar) {
                UI.showToast('Belgeniz başarıyla okundu ve Yönetici Onayına (Manuel İnceleme) gönderildi.', 'success');
            } else {
                UI.showToast('Belgeniz alındı ve incelenmek üzere kuyruğa eklendi.', 'info');
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
