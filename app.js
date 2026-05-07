/* ==========================================================================
   ME26 AĞI - app.js
   Temiz Güvenli Sürüm

   Çalışan ana hat:
   - Kayıt Ol / Giriş Yap
   - Firebase Google popup giriş
   - Supabase users kaydı / okuması
   - SaaS panele geçiş
   - Profil render
   - Şehir seçimi
   - Davet linki kopyalama
   - Telefon modalı için auth.js opsiyonel yükleme
   - PDF belge başvurusu
   - Önerge gönderimi
   - Destek ver
   - Koruma hattı bildirimi
========================================================================== */

import { ME26_CONFIG, auth } from './config.js';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ------------------------------------------------------
// SUPABASE
// ------------------------------------------------------

const supabase = createClient(ME26_CONFIG.supabaseUrl, ME26_CONFIG.supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// ------------------------------------------------------
// GLOBAL DURUM
// ------------------------------------------------------

const STORAGE_KEY = 'me26_user';
const DEFAULT_BASE_URL = 'https://me26.mustafaerciyas.workers.dev';

let currentUser = null;
let appStarted = false;
let loginLock = false;
let activeKursuMode = 'onerge';
let authModuleLoaded = false;

// ------------------------------------------------------
// YARDIMCILAR
// ------------------------------------------------------

const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeHtml = (value) => {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const setText = (id, value) => {
  const el = $(id);
  if (el) el.textContent = value;
};

const getBaseUrl = () => {
  return cleanText(
    ME26_CONFIG.inviteBaseUrl || ME26_CONFIG.officialBaseUrl || DEFAULT_BASE_URL,
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '');
};

const showToast = (message, type = 'info') => {
  const container = $('toast-container');

  if (!container) {
    console.log(`[ME26 ${type}]`, message);
    return;
  }

  const variants = {
    success: 'bg-green-900/90 text-green-300 border-green-700',
    info: 'bg-blue-900/90 text-blue-300 border-blue-700',
    warning: 'bg-yellow-900/90 text-yellow-300 border-yellow-700',
    error: 'bg-red-900/90 text-red-300 border-red-700'
  };

  const icons = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
  };

  const toast = document.createElement('div');

  toast.className =
    'pointer-events-auto px-4 py-3 rounded-xl border shadow-lg text-xs font-bold uppercase tracking-widest max-w-sm ' +
    (variants[type] || variants.info);

  toast.textContent = `${icons[type] || 'ℹ️'} ${message}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
};

const setLoading = (button, text = 'İşleniyor...') => {
  if (!button) return '';

  const oldText = button.innerHTML;

  button.disabled = true;
  button.innerHTML = text;
  button.classList.add('opacity-70', 'cursor-wait');

  return oldText;
};

const restoreButton = (button, oldText = '') => {
  if (!button) return;

  button.disabled = false;
  button.innerHTML = oldText || button.innerHTML;
  button.classList.remove('opacity-70', 'cursor-wait');
};

const saveLocalUser = (user) => {
  currentUser = user;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('ME26 localStorage yazılamadı:', error);
  }
};

const clearLocalUser = () => {
  currentUser = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};

const getRefFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = cleanText(params.get('ref'));

    if (!ref) return null;

    return ref
      .replace(/[^A-Z0-9\-]/gi, '')
      .toUpperCase()
      .slice(0, 60);
  } catch {
    return null;
  }
};

const createInviteCode = (uid = '') => {
  try {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);

    return `ME26-TR-${randomArray[0]
      .toString(36)
      .toUpperCase()
      .slice(0, 6)}`;
  } catch {
    return `ME26-TR-${String(uid || Math.random())
      .replace(/[^A-Z0-9]/gi, '')
      .slice(0, 8)
      .toUpperCase()}`;
  }
};

const getReadableError = (error, fallback = 'İşlem sırasında hata oluştu.') => {
  const code = cleanText(error?.code);
  const message = cleanText(error?.message || error);

  if (code === 'auth/popup-closed-by-user') return 'Google giriş penceresi kapatıldı.';
  if (code === 'auth/popup-blocked') return 'Tarayıcı popup penceresini engelledi. Popup izni verin.';
  if (code === 'auth/cancelled-popup-request') return 'Aynı anda iki giriş isteği oluştu. Tekrar deneyin.';
  if (code === 'auth/unauthorized-domain') return 'Bu domain Firebase Authentication içinde yetkilendirilmemiş. Firebase Authorized domains alanına workers.dev domainini ekleyin.';
  if (code === 'auth/too-many-requests') return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.';

  const map = {
    already_voted: 'Bu önergeye zaten oy verdiniz.',
    already_supported: 'Bu önergeyi zaten desteklediniz.',
    duplicate_record: 'Bu işlem daha önce yapılmış görünüyor.',
    missing_uid: 'Oturum kimliği bulunamadı.',
    missing_city: 'Şehir seçimi eksik.',
    missing_proposal_id: 'Önerge kimliği okunamadı.',
    user_not_found: 'Kullanıcı kaydı bulunamadı.'
  };

  return map[message] || message || fallback;
};

// ------------------------------------------------------
// KULLANICI NORMALİZE
// ------------------------------------------------------

const getDigitalIdFromDbUser = (dbUser = {}) => {
  const userNo =
    dbUser.vip_kurucu_no ||
    dbUser.kurucu_no ||
    dbUser.userNo ||
    dbUser.user_no ||
    'BEKLEYEN';

  if (userNo && userNo !== 'BEKLEYEN') return `TR-IA-${userNo}`;
  if (dbUser.digital_id) return dbUser.digital_id;
  if (dbUser.digitalId) return dbUser.digitalId;

  return 'TR-IA-BEKLEYEN';
};

const normalizeUser = (dbUser = {}) => {
  const userNo =
    dbUser.vip_kurucu_no ||
    dbUser.kurucu_no ||
    dbUser.userNo ||
    dbUser.user_no ||
    'BEKLEYEN';

  const digitalId = getDigitalIdFromDbUser(dbUser);

  return {
    uid: dbUser.id || dbUser.uid || null,
    name: dbUser.isim || dbUser.g_isim || dbUser.name || 'İsimsiz',
    email: dbUser.email || dbUser.mail || null,
    photo: dbUser.foto || dbUser.photo || '',
    city: dbUser.sehir || dbUser.city || 'Belirsiz',
    role: dbUser.mesleki_durum || dbUser.m_durum || dbUser.role || 'Belirsiz',
    userNo,
    digitalId,
    inviteCode:
      dbUser.kendi_davet_kodu ||
      dbUser.davet_kodu ||
      dbUser.d_kod ||
      digitalId,
    hasPhone: Boolean(dbUser.telefon || dbUser.has_phone || dbUser.hasPhone),
    phone: dbUser.telefon || dbUser.phone || null,
    documentStatus: dbUser.belge_durumu || 'Bekliyor',
    votePower: toNumber(dbUser.oy_gucu || dbUser.vote_power, 0),
    inviteCount: toNumber(
      dbUser.davet_edilen_kisi_sayisi || dbUser.invite_count || dbUser.inviteCount,
      0
    ),
    isVip: Boolean(dbUser.is_vip || dbUser.isVip),
    raw: dbUser
  };
};

// ------------------------------------------------------
// AUTH.JS OPSİYONEL YÜKLEME
// ------------------------------------------------------

async function loadOptionalAuthModule() {
  if (authModuleLoaded) return true;

  try {
    await import('./auth.js');
    authModuleLoaded = true;

    if (window.ME26_AUTH?.telefonuUlkeMenusuHazirla) {
      window.ME26_AUTH.telefonuUlkeMenusuHazirla();
    }

    return true;
  } catch (error) {
    console.warn('auth.js yüklenemedi. Ana giriş etkilenmedi:', error);
    return false;
  }
}

// ------------------------------------------------------
// EKRAN GEÇİŞLERİ
// ------------------------------------------------------

function showLanding() {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.remove('hidden');

  if (saas) {
    saas.classList.add('hidden');
    saas.classList.remove('flex');
  }

  document.body.classList.remove('overflow-hidden');
}

function showSaas() {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.add('hidden');

  if (saas) {
    saas.classList.remove('hidden');
    saas.classList.add('flex');
  }

  document.body.classList.add('overflow-hidden');
}

function switchSaasTab(targetId) {
  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.add('hidden');
    section.classList.remove('block');
  });

  const target = $(targetId);

  if (target) {
    target.classList.remove('hidden');
    target.classList.add('block');
  }

  document.querySelectorAll('.nav-menu-btn').forEach((btn) => {
    btn.classList.remove('active', 'text-white');
    btn.classList.add('text-gray-400');
  });

  document
    .querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`)
    .forEach((btn) => {
      btn.classList.add('active', 'text-white');
      btn.classList.remove('text-gray-400');
    });

  const scrollParent = document.querySelector('#saas-view main');
  if (scrollParent) scrollParent.scrollTo({ top: 0, behavior: 'smooth' });

  if (targetId === 'view-sandik') loadProposals();
  if (targetId === 'view-tribun') loadTribunLigi();
}

async function openModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');

  if (modalId === 'phone-modal') {
    await loadOptionalAuthModule();

    if (window.ME26_AUTH?.telefonuUlkeMenusuHazirla) {
      window.ME26_AUTH.telefonuUlkeMenusuHazirla();
    }
  }
}

function closeModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.setAttribute('aria-hidden', 'true');
}

// ------------------------------------------------------
// PROFİL
// ------------------------------------------------------

function renderProfile() {
  if (!currentUser) return;

  const digitalId = currentUser.digitalId || 'TR-IA-BEKLEYEN';

  const role =
    currentUser.role && currentUser.role !== 'Belirsiz'
      ? currentUser.role
      : 'Kimlik Bekleniyor';

  const city =
    currentUser.city && currentUser.city !== 'Belirsiz'
      ? currentUser.city
      : 'TRİBÜN SEÇİLMEDİ';

  const access = currentUser.votePower > 0 ? 'Tam' : 'Sınırlı';

  const inviteLink = `${getBaseUrl()}/?ref=${encodeURIComponent(
    currentUser.inviteCode || digitalId
  )}`;

  setText('sidebar-user-id', digitalId);
  setText('mobile-user-id', digitalId);
  setText('ui-user-id', digitalId);

  setText('ui-user-role', role);
  setText('sidebar-user-role', role);

  setText('ui-user-city', city);
  setText('ui-vote-power', access);
  setText('sidebar-vote-power', `Erişim Seviyesi ${access}`);

  setText('ui-invite-link', inviteLink);
  setText('ui-vip-invite-count', `${currentUser.inviteCount || 0} / 3 Paylaşım`);

  const progressBar = $('ui-vip-progress-bar');
  if (progressBar) {
    progressBar.style.width = `${Math.min(((currentUser.inviteCount || 0) / 3) * 100, 100)}%`;
  }

  const cityGate = $('ui-city-selector-container');
  if (cityGate) {
    const hasCity = Boolean(currentUser.city && currentUser.city !== 'Belirsiz');
    cityGate.classList.toggle('hidden', hasCity);
  }

  const roleBadge = $('ui-role-badge');

  if (roleBadge) {
    if (currentUser.isVip) {
      roleBadge.textContent = 'VIP KURUCU';
      roleBadge.className =
        'inline-flex bg-kaos text-slate-950 border border-kaos px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest mb-4';
    } else if (digitalId !== 'TR-IA-BEKLEYEN') {
      roleBadge.textContent = 'ASİL KURUCU';
      roleBadge.className =
        'inline-flex bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest mb-4';
    } else {
      roleBadge.textContent = 'ME26 Ağı Onay Bekliyor';
      roleBadge.className =
        'inline-flex bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest mb-4';
    }
  }

  const systemText = $('ui-sistem-durumu');

  if (systemText) {
    if (currentUser.votePower > 0) {
      systemText.textContent =
        'Sicil kaydınız aktif. Sandık, kürsü ve katkı alanları tam erişimle kullanılabilir.';
    } else {
      systemText.textContent =
        'Kullanıcı kaydınız Supabase içine işlendi. Şehir, telefon ve belge adımları tamamlandıkça erişim seviyesi artacak.';
    }
  }
}

// ------------------------------------------------------
// SUPABASE KULLANICI
// ------------------------------------------------------

async function loadOrCreateSupabaseUser(firebaseUser) {
  if (!firebaseUser || !firebaseUser.uid) {
    throw new Error('Google kullanıcı kimliği alınamadı.');
  }

  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', firebaseUser.uid)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existingUser) return existingUser;

  const payload = {
    uid: firebaseUser.uid,
    g_isim: firebaseUser.displayName || 'İsimsiz',
    mail: firebaseUser.email || null,
    foto: firebaseUser.photoURL || '',
    m_durum: 'Belirsiz',
    sehir: null,
    d_kod: createInviteCode(firebaseUser.uid),
    ref: getRefFromUrl()
  };

  const { data: createdUser, error: rpcError } = await supabase.rpc(
    'me26_sistem_giris',
    {
      p_payload: payload
    }
  );

  if (rpcError) throw rpcError;

  return createdUser;
}

async function refreshCurrentUser(uid = null) {
  const userId = uid || currentUser?.uid || auth.currentUser?.uid;

  if (!userId) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  currentUser = normalizeUser(data);
  saveLocalUser(currentUser);
  renderProfile();

  return currentUser;
}

// ------------------------------------------------------
// GOOGLE GİRİŞ
// ------------------------------------------------------

async function loginWithGoogle(event = null) {
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  if (loginLock || window.__ME26_LOGIN_LOCK__ === true) return;

  loginLock = true;
  window.__ME26_LOGIN_LOCK__ = true;

  try {
    showToast('Google giriş başlatılıyor.', 'info');

    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const dbUser = await loadOrCreateSupabaseUser(result.user);

    currentUser = normalizeUser(dbUser);
    saveLocalUser(currentUser);

    showSaas();
    switchSaasTab('view-lobi');
    renderProfile();

    showToast('Giriş tamamlandı. Supabase kaydı okundu.', 'success');
  } catch (error) {
    console.error('ME26 Google giriş hatası:', error);

    const message = getReadableError(error, 'Google giriş tamamlanamadı.');

    if (error?.code !== 'auth/popup-closed-by-user') {
      alert(message);
    }

    showToast(message, error?.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
  } finally {
    setTimeout(() => {
      loginLock = false;
      window.__ME26_LOGIN_LOCK__ = false;
    }, 1200);
  }
}

// ------------------------------------------------------
// ÇIKIŞ
// ------------------------------------------------------

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Firebase çıkış uyarısı:', error);
  }

  clearLocalUser();
  showLanding();
  showToast('Çıkış yapıldı.', 'info');
}

// ------------------------------------------------------
// ŞEHİR KAYDET
// ------------------------------------------------------

async function saveCity() {
  if (!currentUser || !currentUser.uid) {
    showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
    return;
  }

  const selectedCity = cleanText($('input-profile-city')?.value);

  if (!selectedCity) {
    showToast('Lütfen şehir seçin.', 'error');
    return;
  }

  const btn = $('btn-save-profile-city');
  const oldText = setLoading(btn, 'Kaydediliyor...');

  try {
    const { error: rpcError } = await supabase.rpc('me26_sehir_guncelle', {
      p_uid: currentUser.uid,
      p_sehir: selectedCity
    });

    if (rpcError) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ sehir: selectedCity })
        .eq('id', currentUser.uid);

      if (updateError) throw updateError;
    }

    currentUser.city = selectedCity;
    saveLocalUser(currentUser);
    renderProfile();

    showToast(`${selectedCity} tribününe katıldınız.`, 'success');
  } catch (error) {
    console.error('Şehir kaydetme hatası:', error);
    showToast(getReadableError(error, 'Şehir kaydedilemedi.'), 'error');
  } finally {
    restoreButton(btn, oldText || 'Kaydet');
  }
}

// ------------------------------------------------------
// DAVET LİNKİ
// ------------------------------------------------------

async function copyInviteLink() {
  const text = cleanText($('ui-invite-link')?.textContent);

  if (!text) {
    showToast('Davet linki bulunamadı.', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('Davet bağlantısı kopyalandı.', 'success');
  } catch {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();

    showToast('Davet bağlantısı kopyalandı.', 'success');
  }
}

// ------------------------------------------------------
// TELEFON / PDF
// ------------------------------------------------------

async function openPhoneModal() {
  await openModal('phone-modal');
}

async function openPdfModal() {
  await loadOptionalAuthModule();
  openModal('pdf-modal');
}

async function submitPdf() {
  const fileInput = $('input-pdf-file');
  const file = fileInput?.files?.[0];

  if (!file) {
    showToast('Önce bir PDF dosyası seçin.', 'error');
    return;
  }

  if (!currentUser?.uid) {
    showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
    return;
  }

  const btn = $('btn-submit-pdf');
  const oldText = setLoading(btn, 'İncelemeye gönderiliyor...');

  try {
    await loadOptionalAuthModule();

    if (window.ME26_AUTH?.eDevletBelgesiOku) {
      await window.ME26_AUTH.eDevletBelgesiOku(file, currentUser.uid);
    } else {
      const { error } = await supabase.rpc('me26_belge_yukle', {
        p_uid: currentUser.uid,
        p_belge: {
          dosya_adi: file.name,
          tur: file.type || 'application/pdf',
          belge_durumu: 'Onay Bekliyor'
        }
      });

      if (error) throw error;
    }

    showToast('Belge başvurunuz inceleme kuyruğuna alındı.', 'success');
    closeModal('pdf-modal');

    if (fileInput) fileInput.value = '';

    await refreshCurrentUser(currentUser.uid);
  } catch (error) {
    console.error('PDF gönderim hatası:', error);
    showToast(getReadableError(error, 'Belge gönderilemedi.'), 'error');
  } finally {
    restoreButton(btn, oldText || 'Belge İnceleme Başvurusu Gönder');
  }
}

// ------------------------------------------------------
// ÖNERGE / SORU
// ------------------------------------------------------

function switchKursuTab(mode) {
  activeKursuMode = mode === 'soru' ? 'soru' : 'onerge';

  const onergeBtn = $('tab-btn-onerge');
  const soruBtn = $('tab-btn-soru');
  const onergeFields = $('kursu-onerge-fields');
  const soruFields = $('kursu-soru-fields');
  const submitBtn = $('btn-submit-kursu');
  const duration = $('input-kursu-duration')?.parentElement;

  if (activeKursuMode === 'soru') {
    onergeBtn?.classList.remove('bg-slate-800', 'text-white');
    soruBtn?.classList.add('bg-slate-800', 'text-white');

    onergeFields?.classList.add('hidden');
    soruFields?.classList.remove('hidden');

    if (duration) duration.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'SORUYU ORTAK AKLA GÖNDER';

    return;
  }

  soruBtn?.classList.remove('bg-slate-800', 'text-white');
  onergeBtn?.classList.add('bg-slate-800', 'text-white');

  soruFields?.classList.add('hidden');
  onergeFields?.classList.remove('hidden');

  if (duration) duration.classList.remove('hidden');
  if (submitBtn) submitBtn.textContent = 'ÖNERGEYİ GÜNDEME GÖNDER';
}

async function submitKursu() {
  if (!currentUser || !currentUser.uid) {
    showToast('Önerge veya soru göndermek için giriş yapmalısınız.', 'error');
    return;
  }

  const baslik = cleanText($('input-kursu-title')?.value);
  const hedefKitle = cleanText($('input-kursu-audience')?.value, 'Herkes');
  const sorumluluk = $('input-kursu-responsibility')?.checked === true;

  if (!sorumluluk) {
    showToast('Sorumluluk beyanını onaylamalısınız.', 'error');
    return;
  }

  if (baslik.length < 15) {
    showToast('Başlık en az 15 karakter olmalıdır.', 'error');
    return;
  }

  const btn = $('btn-submit-kursu');
  const oldText = setLoading(btn, 'Gönderiliyor...');

  try {
    if (activeKursuMode === 'soru') {
      const icerik = cleanText($('input-kursu-content')?.value);

      if (icerik.length < 50) {
        throw new Error('Soru içeriği en az 50 karakter olmalıdır.');
      }

      const { error } = await supabase.from('me26_sorular').insert([
        {
          yazar_uid: currentUser.uid,
          yazar_dijital_id: currentUser.digitalId || 'TR-IA-BEKLEYEN',
          baslik,
          icerik,
          hedef_kitle: hedefKitle,
          cozuldu_mu: false
        }
      ]);

      if (error) throw error;

      showToast('Sorunuz ortak akla gönderildi.', 'success');
    } else {
      const sorun = cleanText($('input-kursu-problem')?.value);
      const cozum = cleanText($('input-kursu-solution')?.value);

      if (sorun.length < 20) throw new Error('Sorun alanı en az 20 karakter olmalıdır.');
      if (cozum.length < 20) throw new Error('Çözüm alanı en az 20 karakter olmalıdır.');

      const { error } = await supabase.from('onergeler').insert([
        {
          yazar_uid: currentUser.uid,
          baslik,
          sorun,
          cozum,
          hedef_kitle: hedefKitle,
          destek_sayisi: 0,
          durum: 'bekliyor'
        }
      ]);

      if (error) throw error;

      showToast('Önergeniz meclise sunuldu.', 'success');
      await loadProposals();
    }

    [
      'input-kursu-title',
      'input-kursu-problem',
      'input-kursu-solution',
      'input-kursu-content'
    ].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });

    const responsibility = $('input-kursu-responsibility');
    if (responsibility) responsibility.checked = false;

    closeModal('ortak-kursu-modal');
  } catch (error) {
    console.error('Kürsü gönderim hatası:', error);
    showToast(getReadableError(error, 'Gönderim yapılamadı.'), 'error');
  } finally {
    restoreButton(btn, oldText || 'Gönder');
  }
}

// ------------------------------------------------------
// ÖNERGELER
// ------------------------------------------------------

function emptyState(text) {
  return `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${escapeHtml(text)}
    </div>
  `;
}

async function fetchProposals() {
  const tableTries = ['onergeler', 'me26_onergeler'];

  for (const table of tableTries) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('olusturulma_tarihi', { ascending: false });

    if (!error) return Array.isArray(data) ? data : [];
  }

  return [];
}

async function loadProposals() {
  const proposalsContainer = $('proposals-container');
  const gundemContainer = $('gundem-container');

  if (proposalsContainer) proposalsContainer.innerHTML = emptyState('Önergeler yükleniyor...');
  if (gundemContainer) gundemContainer.innerHTML = emptyState('Gündem yükleniyor...');

  try {
    const list = await fetchProposals();

    if (proposalsContainer) proposalsContainer.innerHTML = '';
    if (gundemContainer) gundemContainer.innerHTML = '';

    if (list.length === 0) {
      if (proposalsContainer) proposalsContainer.innerHTML = emptyState('Henüz önerge yok.');
      if (gundemContainer) gundemContainer.innerHTML = emptyState('Henüz gündem yok.');
      return;
    }

    let proposalCount = 0;
    let agendaCount = 0;

    list.forEach((item) => {
      const destekSayisi = toNumber(item.destek_sayisi || item.destekSayisi || item.support_count, 0);
      const status = cleanText(item.status || item.durum).toLowerCase();
      const isAgenda = destekSayisi >= 50 || ['gundem', 'gündem', 'voting', 'oylama'].includes(status);

      const target = isAgenda ? gundemContainer : proposalsContainer;
      if (!target) return;

      const card = document.createElement('div');

      card.className = 'bg-black/50 border border-slate-800 p-5 rounded-2xl shadow-lg';
      card.setAttribute('data-onerge-card', item.id);

      const title = item.baslik || item.title || 'Başlıksız Önerge';
      const problem = item.sorun || item.problem || item.aciklama || 'Açıklama yok.';
      const solution = item.cozum || item.solution || '';

      card.innerHTML = `
        <div class="text-[9px] font-black uppercase tracking-widest text-kaos mb-3">
          ${isAgenda ? 'Gündemde' : 'Destek Bekliyor'}
        </div>

        <h3 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">
          ${escapeHtml(title)}
        </h3>

        <p class="text-xs md:text-sm text-gray-400 leading-relaxed mb-3">
          ${escapeHtml(problem)}
        </p>

        ${solution ? `
          <p class="text-xs md:text-sm text-gray-300 leading-relaxed mb-4 border-l-2 border-kaos/60 pl-3">
            ${escapeHtml(solution)}
          </p>
        ` : ''}

        <div class="flex items-center justify-between gap-3">
          <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">
            Destek: ${destekSayisi}/50
          </span>

          <button
            type="button"
            data-id="${escapeHtml(item.id)}"
            class="btn-destekle bg-slate-800 border border-slate-600 hover:border-kaos hover:text-kaos text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition"
          >
            Destekle
          </button>
        </div>
      `;

      target.appendChild(card);

      if (isAgenda) agendaCount += 1;
      else proposalCount += 1;
    });

    if (proposalsContainer && proposalCount === 0) {
      proposalsContainer.innerHTML = emptyState('Destek bekleyen önerge yok.');
    }

    if (gundemContainer && agendaCount === 0) {
      gundemContainer.innerHTML = emptyState('Gündeme alınmış önerge yok.');
    }
  } catch (error) {
    console.error('Önergeler alınamadı:', error);

    if (proposalsContainer) proposalsContainer.innerHTML = emptyState('Önergeler alınamadı.');

    showToast('Önergeler alınamadı.', 'error');
  }
}

async function destekVer(button) {
  if (!currentUser || !currentUser.uid) {
    showToast('Destek vermek için giriş yapmalısınız.', 'error');
    return;
  }

  const onergeId = button?.getAttribute('data-id');

  if (!onergeId) {
    showToast('Önerge kimliği okunamadı.', 'error');
    return;
  }

  const oldText = setLoading(button, '...');

  try {
    const { error } = await supabase.rpc('me26_destek_ver', {
      p_uid: currentUser.uid,
      p_onerge_id: onergeId
    });

    if (error) throw error;

    showToast('Önergeye destek verdiniz.', 'success');
    await loadProposals();
  } catch (error) {
    console.error('Destek verme hatası:', error);
    showToast(getReadableError(error, 'Destek gönderilemedi.'), 'error');
  } finally {
    restoreButton(button, oldText || 'Destekle');
  }
}

// ------------------------------------------------------
// TRİBÜN LİGİ
// ------------------------------------------------------

async function loadTribunLigi() {
  const body = $('tribun-ligi-body');
  if (!body) return;

  body.innerHTML =
    '<tr><td colspan="2" class="p-4 text-center text-gray-500 text-xs uppercase tracking-widest">Tribün verileri yükleniyor...</td></tr>';

  try {
    const { data, error } = await supabase.rpc('me26_tribun_ligi_getir');

    if (error) throw error;

    const list = Array.isArray(data) ? data : [];

    body.innerHTML = '';

    if (list.length === 0) {
      body.innerHTML =
        '<tr><td colspan="2" class="p-4 text-center text-gray-500 text-xs uppercase tracking-widest">Henüz tribün verisi yok.</td></tr>';
      return;
    }

    list.forEach((item, index) => {
      const city = item.sehir || item.city || item.name || item.il || 'Belirsiz';
      const power = item.guc || item.güç || item.power || item.puan || 0;

      const row = document.createElement('tr');

      row.className = 'border-b border-slate-800 hover:bg-slate-800/50 transition';

      row.innerHTML = `
        <td class="p-4 font-black text-white text-sm">
          ${index + 1}. ${escapeHtml(city)}
        </td>
        <td class="p-4 font-mono font-black text-kaos text-sm text-right">
          ${Number(power || 0).toLocaleString('tr-TR')}
        </td>
      `;

      body.appendChild(row);
    });
  } catch (error) {
    console.warn('Tribün Ligi alınamadı:', error);

    body.innerHTML =
      '<tr><td colspan="2" class="p-4 text-center text-yellow-500 text-xs uppercase tracking-widest">Tribün verisi şu an alınamadı.</td></tr>';
  }
}

// ------------------------------------------------------
// KORUMA HATTI
// ------------------------------------------------------

async function submitKoruma() {
  const kisi = cleanText($('input-koruma-kisi')?.value);
  const link = cleanText($('input-koruma-link')?.value);
  const aciklama = cleanText($('input-koruma-aciklama')?.value);
  const tur = cleanText($('input-koruma-turu')?.value, 'Diğer');
  const kvkk = $('input-koruma-kvkk')?.checked === true;
  const anonim = $('input-koruma-anonim')?.checked === true;
  const adSoyad = cleanText($('input-koruma-ad')?.value);
  const iletisim = cleanText($('input-koruma-iletisim')?.value);

  if (!kisi) {
    showToast('Bildirilen kişi veya kurum yazılmalı.', 'error');
    return;
  }

  if (aciklama.length < 20) {
    showToast('Açıklama en az 20 karakter olmalı.', 'error');
    return;
  }

  if (!kvkk) {
    showToast('Doğruluk beyanını onaylamalısınız.', 'error');
    return;
  }

  const btn = $('btn-submit-koruma');
  const oldText = setLoading(btn, 'Gönderiliyor...');

  try {
    const payload = {
      bildiren_uid: currentUser?.digitalId || 'TR-IA-ZIYARETCI',
      bildirim_turu: tur,
      sikayet_edilen: kisi,
      baglanti: link || null,
      aciklama,
      ad_soyad: anonim ? null : adSoyad || null,
      iletisim: anonim ? null : iletisim || null,
      anonim_mi: anonim
    };

    const { error } = await supabase.from('me26_koruma_hatti').insert([payload]);

    if (error) throw error;

    [
      'input-koruma-kisi',
      'input-koruma-link',
      'input-koruma-aciklama',
      'input-koruma-ad',
      'input-koruma-iletisim'
    ].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });

    const kvkkEl = $('input-koruma-kvkk');
    if (kvkkEl) kvkkEl.checked = false;

    showToast('Bildirim güvenli ağa iletildi.', 'success');
  } catch (error) {
    console.error('Koruma hattı hatası:', error);
    showToast(getReadableError(error, 'Bildirim gönderilemedi.'), 'error');
  } finally {
    restoreButton(btn, oldText || 'Bildirimi Güvenli Ağa İlet');
  }
}

// ------------------------------------------------------
// EVENTLER
// ------------------------------------------------------

function bindLoginButtons() {
  const loginIds = [
    'btn-register-nav',
    'btn-login-nav',
    'btn-register-hero',
    'btn-login-hero'
  ];

  loginIds.forEach((id) => {
    const btn = $(id);

    if (!btn) return;
    if (btn.dataset.me26AppLoginBound === '1') return;

    btn.dataset.me26AppLoginBound = '1';
    btn.style.pointerEvents = 'auto';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', loginWithGoogle, true);
  });

  document.querySelectorAll('.me26-login-btn, button, a').forEach((el) => {
    const text = cleanText(el.textContent).toUpperCase();

    if (text === 'KAYIT OL' || text === 'GİRİŞ YAP' || text === 'GIRIS YAP') {
      if (el.dataset.me26AppLoginBound === '1') return;

      el.dataset.me26AppLoginBound = '1';
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';

      el.addEventListener('click', loginWithGoogle, true);
    }
  });
}

function bindNavigation() {
  document.querySelectorAll('.nav-menu-btn').forEach((btn) => {
    if (btn.dataset.me26NavBound === '1') return;

    btn.dataset.me26NavBound = '1';

    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      if (targetId) switchSaasTab(targetId);
    });
  });
}

function bindStaticButtons() {
  $('btn-logout')?.addEventListener('click', logout);
  $('btn-mobile-logout')?.addEventListener('click', logout);

  $('btn-save-profile-city')?.addEventListener('click', saveCity);
  $('btn-copy-invite')?.addEventListener('click', copyInviteLink);

  $('btn-whatsapp-share')?.addEventListener('click', () => {
    const link = cleanText($('ui-invite-link')?.textContent);
    if (!link) return;

    window.open(`https://wa.me/?text=${encodeURIComponent(link)}`, '_blank');
  });

  $('btn-open-proposal-modal')?.addEventListener('click', () => {
    switchKursuTab('onerge');
    openModal('ortak-kursu-modal');
  });

  $('btn-open-proposal-modal-2')?.addEventListener('click', () => {
    switchKursuTab('onerge');
    openModal('ortak-kursu-modal');
  });

  $('btn-open-qa-modal')?.addEventListener('click', () => {
    switchKursuTab('soru');
    openModal('ortak-kursu-modal');
  });

  $('btn-close-kursu-modal')?.addEventListener('click', () => closeModal('ortak-kursu-modal'));

  $('tab-btn-onerge')?.addEventListener('click', () => switchKursuTab('onerge'));
  $('tab-btn-soru')?.addEventListener('click', () => switchKursuTab('soru'));
  $('btn-submit-kursu')?.addEventListener('click', submitKursu);

  $('btn-close-phone-modal')?.addEventListener('click', () => closeModal('phone-modal'));
  $('btn-close-pdf-modal')?.addEventListener('click', () => closeModal('pdf-modal'));
  $('btn-close-vip-modal')?.addEventListener('click', () => closeModal('vip-modal'));

  $('btn-open-phone-modal')?.addEventListener('click', openPhoneModal);
  $('btn-open-pdf-modal')?.addEventListener('click', openPdfModal);
  $('btn-submit-pdf')?.addEventListener('click', submitPdf);

  $('btn-open-vip-modal')?.addEventListener('click', () => openModal('vip-modal'));

  $('btn-submit-koruma')?.addEventListener('click', submitKoruma);

  document.body.addEventListener('click', (event) => {
    const destekBtn = event.target.closest('.btn-destekle');

    if (destekBtn) {
      event.preventDefault();
      destekVer(destekBtn);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    [
      'ortak-kursu-modal',
      'phone-modal',
      'pdf-modal',
      'vip-modal'
    ].forEach(closeModal);
  });
}

// ------------------------------------------------------
// OTURUM TAKİBİ
// ------------------------------------------------------

function startAuthWatcher() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      clearLocalUser();
      showLanding();
      return;
    }

    try {
      const dbUser = await loadOrCreateSupabaseUser(firebaseUser);

      currentUser = normalizeUser(dbUser);
      saveLocalUser(currentUser);

      showSaas();
      switchSaasTab('view-lobi');
      renderProfile();

      console.info('ME26 oturum açık:', currentUser);
    } catch (error) {
      console.error('Oturum devam hatası:', error);
      showToast('Firebase açık ama Supabase kullanıcı bilgisi okunamadı.', 'error');
    }
  });
}

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------

window.AUTH = {
  loginWithGoogle,
  logout
};

window.UI = {
  showToast,
  showView: (viewId) => {
    if (viewId === 'saas') showSaas();
    else showLanding();
  },
  switchSaasTab,
  renderProfile,
  openModal,
  closeModal
};

window.ME26_APP = {
  loginWithGoogle,
  logout,
  refreshCurrentUser,
  loadProposals,
  loadTribunLigi,
  copyInviteLink,
  getCurrentUser: () => currentUser,
  supabase
};

window.onergeleriGetir = loadProposals;
window.loadTribunLigiData = loadTribunLigi;
window.kopyalaDavetLinki = copyInviteLink;
window.copyInviteLink = copyInviteLink;

// ------------------------------------------------------
// BAŞLAT
// ------------------------------------------------------

function startApp() {
  if (appStarted) return;

  appStarted = true;
  window.__ME26_APP_READY__ = true;

  bindLoginButtons();
  bindNavigation();
  bindStaticButtons();
  startAuthWatcher();

  loadOptionalAuthModule();

  console.info('ME26 app.js temiz kısa sürüm başladı.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
