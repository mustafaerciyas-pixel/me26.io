/* ==========================================================================
   ME26 AĞI - ANA MOTOR (app.js)
   Güvenli Giriş + Supabase Kayıt + Panel Geçiş Sürümü

   ÖNEMLİ:
   - Bu dosya auth.js / ui.js / supabase.js / state.js import etmez.
   - Sebep: Bu dosyalarda kopyalama kaynaklı string/syntax bozulması var.
   - Amaç: Kayıt Ol / Giriş Yap butonlarını kesin çalıştırmak.
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
// SUPABASE CLIENT
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

let currentUser = null;
let loginLock = false;
let appStarted = false;

// ------------------------------------------------------
// KISA YARDIMCILAR
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

const safeSetText = (id, value) => {
  const el = $(id);
  if (el) el.textContent = value;
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

const normalizeUser = (dbUser = {}) => {
  const userNo =
    dbUser.vip_kurucu_no ||
    dbUser.kurucu_no ||
    dbUser.userNo ||
    dbUser.user_no ||
    'BEKLEYEN';

  const digitalId =
    userNo && userNo !== 'BEKLEYEN' ? `TR-IA-${userNo}` : 'TR-IA-BEKLEYEN';

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
// EKRAN GEÇİŞLERİ
// ------------------------------------------------------

const showLanding = () => {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.remove('hidden');

  if (saas) {
    saas.classList.add('hidden');
    saas.classList.remove('flex');
  }

  document.body.classList.remove('overflow-hidden');
};

const showSaas = () => {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.add('hidden');

  if (saas) {
    saas.classList.remove('hidden');
    saas.classList.add('flex');
  }

  document.body.classList.add('overflow-hidden');
};

const switchSaasTab = (targetId) => {
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

  if (targetId === 'view-sandik') {
    loadProposals();
  }

  if (targetId === 'view-tribun') {
    loadTribunLigi();
  }
};

const openModal = (modalId) => {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');
};

const closeModal = (modalId) => {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.setAttribute('aria-hidden', 'true');
};

// ------------------------------------------------------
// PROFİL RENDER
// ------------------------------------------------------

const renderProfile = () => {
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

  const inviteLink = `${ME26_CONFIG.inviteBaseUrl}/?ref=${encodeURIComponent(
    currentUser.inviteCode || digitalId
  )}`;

  safeSetText('sidebar-user-id', digitalId);
  safeSetText('mobile-user-id', digitalId);
  safeSetText('ui-user-id', digitalId);

  safeSetText('ui-user-role', role);
  safeSetText('sidebar-user-role', role);

  safeSetText('ui-user-city', city);
  safeSetText('ui-vote-power', access);
  safeSetText('sidebar-vote-power', `Erişim Seviyesi ${access}`);

  safeSetText('ui-invite-link', inviteLink);
  safeSetText('ui-vip-invite-count', `${currentUser.inviteCount || 0} / 3 Paylaşım`);

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
};

// ------------------------------------------------------
// SUPABASE KULLANICI OLUŞTUR / OKU
// ------------------------------------------------------

const loadOrCreateSupabaseUser = async (firebaseUser) => {
  if (!firebaseUser || !firebaseUser.uid) {
    throw new Error('Google kullanıcı kimliği alınamadı.');
  }

  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', firebaseUser.uid)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingUser) {
    return existingUser;
  }

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

  if (rpcError) {
    throw rpcError;
  }

  return createdUser;
};

// ------------------------------------------------------
// GOOGLE GİRİŞ
// ------------------------------------------------------

async function loginWithGoogle(event = null) {
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  if (loginLock) return;
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

    const code = cleanText(error?.code);
    let message = error?.message || 'Google giriş tamamlanamadı.';

    if (code === 'auth/popup-closed-by-user') {
      message = 'Google giriş penceresi kapatıldı.';
    }

    if (code === 'auth/popup-blocked') {
      message = 'Tarayıcı Google giriş penceresini engelledi. Popup izni verin.';
    }

    if (code === 'auth/unauthorized-domain') {
      message =
        'Bu domain Firebase Authentication içinde yetkilendirilmemiş. Firebase Authorized domains alanına workers.dev domainini ekleyin.';
    }

    showToast(message, 'error');
    alert(message);
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
  const oldText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';
  }

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
    showToast(error?.message || 'Şehir kaydedilemedi.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || 'Kaydet';
    }
  }
}

// ------------------------------------------------------
// DAVET KOPYALA
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
    showToast('Davet bağlantısı kopyalanamadı.', 'error');
  }
}

// ------------------------------------------------------
// ÖNERGE / SORU MODAL
// ------------------------------------------------------

let activeKursuMode = 'onerge';

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
  const oldText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';
  }

  try {
    if (activeKursuMode === 'soru') {
      const icerik = cleanText($('input-kursu-content')?.value);

      if (icerik.length < 50) {
        throw new Error('Soru içeriği en az 50 karakter olmalıdır.');
      }

      const { error } = await supabase.rpc('me26_soru_gonder', {
        p_uid: currentUser.uid,
        p_yazar_dijital_id: currentUser.digitalId || 'TR-IA-BEKLEYEN',
        p_baslik: baslik,
        p_icerik: icerik,
        p_hedef_kitle: hedefKitle
      });

      if (error) throw error;

      showToast('Sorunuz ortak akla gönderildi.', 'success');
    } else {
      const sorun = cleanText($('input-kursu-problem')?.value);
      const cozum = cleanText($('input-kursu-solution')?.value);
      const sure = toNumber($('input-kursu-duration')?.value, 2);

      if (sorun.length < 20) {
        throw new Error('Sorun alanı en az 20 karakter olmalıdır.');
      }

      if (cozum.length < 20) {
        throw new Error('Çözüm alanı en az 20 karakter olmalıdır.');
      }

      const { error } = await supabase.rpc('me26_onerge_gonder', {
        p_uid: currentUser.uid,
        p_baslik: baslik,
        p_sorun: sorun,
        p_cozum: cozum,
        p_hedef_kitle: hedefKitle,
        p_sure: sure
      });

      if (error) throw error;

      showToast('Önergeniz meclise sunuldu.', 'success');
      await loadProposals();
    }

    ['input-kursu-title', 'input-kursu-problem', 'input-kursu-solution', 'input-kursu-content'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });

    const responsibility = $('input-kursu-responsibility');
    if (responsibility) responsibility.checked = false;

    closeModal('ortak-kursu-modal');
  } catch (error) {
    console.error('Kürsü gönderim hatası:', error);
    showToast(error?.message || 'Gönderim yapılamadı.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || 'Gönder';
    }
  }
}

// ------------------------------------------------------
// ÖNERGELERİ GETİR
// ------------------------------------------------------

async function loadProposals() {
  const proposalsContainer = $('proposals-container');
  const gundemContainer = $('gundem-container');

  if (proposalsContainer) {
    proposalsContainer.innerHTML =
      '<div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">Önergeler yükleniyor...</div>';
  }

  if (gundemContainer) {
    gundemContainer.innerHTML =
      '<div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">Gündem yükleniyor...</div>';
  }

  try {
    const { data, error } = await supabase
      .from('onergeler')
      .select('*')
      .order('olusturulma_tarihi', { ascending: false });

    if (error) throw error;

    const list = Array.isArray(data) ? data : [];

    if (proposalsContainer) proposalsContainer.innerHTML = '';
    if (gundemContainer) gundemContainer.innerHTML = '';

    if (list.length === 0) {
      if (proposalsContainer) {
        proposalsContainer.innerHTML =
          '<div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">Henüz önerge yok.</div>';
      }

      if (gundemContainer) {
        gundemContainer.innerHTML =
          '<div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">Henüz gündem yok.</div>';
      }

      return;
    }

    list.forEach((item) => {
      const destekSayisi = toNumber(item.destek_sayisi || item.support_count, 0);
      const isAgenda = destekSayisi >= 50 || ['gundem', 'gündem', 'voting', 'oylama'].includes(cleanText(item.status || item.durum).toLowerCase());

      const target = isAgenda ? gundemContainer : proposalsContainer;
      if (!target) return;

      const card = document.createElement('div');

      card.className =
        'bg-black/50 border border-slate-800 p-5 rounded-2xl shadow-lg';

      card.innerHTML = `
        <div class="text-[9px] font-black uppercase tracking-widest text-kaos mb-3">
          ${isAgenda ? 'Gündemde' : 'Destek Bekliyor'}
        </div>

        <h3 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">
          ${escapeHtml(item.baslik || item.title || 'Başlıksız Önerge')}
        </h3>

        <p class="text-xs md:text-sm text-gray-400 leading-relaxed mb-4">
          ${escapeHtml(item.sorun || item.problem || 'Açıklama yok.')}
        </p>

        <div class="flex items-center justify-between gap-3">
          <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">
            Destek: ${destekSayisi}/50
          </span>

          <button
            type="button"
            data-id="${item.id}"
            class="btn-destekle bg-slate-800 border border-slate-600 hover:border-kaos hover:text-kaos text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition"
          >
            Destekle
          </button>
        </div>
      `;

      target.appendChild(card);
    });
  } catch (error) {
    console.error('Önergeler alınamadı:', error);

    if (proposalsContainer) {
      proposalsContainer.innerHTML =
        '<div class="text-center py-10 border border-red-800 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest bg-red-950/20">Önergeler alınamadı.</div>';
    }
  }
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ------------------------------------------------------
// DESTEK VER
// ------------------------------------------------------

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

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = '...';

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

    if (
      String(error?.message || '').toLowerCase().includes('already') ||
      String(error?.message || '').toLowerCase().includes('duplicate')
    ) {
      showToast('Bu önergeyi zaten desteklediniz.', 'info');
    } else {
      showToast(error?.message || 'Destek gönderilemedi.', 'error');
    }
  } finally {
    button.disabled = false;
    button.textContent = oldText || 'Destekle';
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
      const city = item.sehir || item.city || item.name || 'Belirsiz';
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
  const oldText = btn ? btn.textContent : '';

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';
  }

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

    ['input-koruma-kisi', 'input-koruma-link', 'input-koruma-aciklama', 'input-koruma-ad', 'input-koruma-iletisim'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });

    const kvkkEl = $('input-koruma-kvkk');
    if (kvkkEl) kvkkEl.checked = false;

    showToast('Bildirim güvenli ağa iletildi.', 'success');
  } catch (error) {
    console.error('Koruma hattı hatası:', error);
    showToast(error?.message || 'Bildirim gönderilemedi.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || 'Bildirimi Güvenli Ağa İlet';
    }
  }
}

// ------------------------------------------------------
// EVENT BAĞLANTILARI
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

    if (
      text === 'KAYIT OL' ||
      text === 'GİRİŞ YAP' ||
      text === 'GIRIS YAP'
    ) {
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

  $('btn-open-proposal-modal')?.addEventListener('click', () => {
    switchKursuTab('onerge');
    openModal('ortak-kursu-modal');
  });

  $('btn-open-qa-modal')?.addEventListener('click', () => {
    switchKursuTab('soru');
    openModal('ortak-kursu-modal');
  });

  $('btn-close-kursu-modal')?.addEventListener('click', () => {
    closeModal('ortak-kursu-modal');
  });

  $('tab-btn-onerge')?.addEventListener('click', () => switchKursuTab('onerge'));
  $('tab-btn-soru')?.addEventListener('click', () => switchKursuTab('soru'));
  $('btn-submit-kursu')?.addEventListener('click', submitKursu);

  $('btn-close-phone-modal')?.addEventListener('click', () => closeModal('phone-modal'));
  $('btn-close-pdf-modal')?.addEventListener('click', () => closeModal('pdf-modal'));
  $('btn-close-vip-modal')?.addEventListener('click', () => closeModal('vip-modal'));

  $('btn-open-phone-modal')?.addEventListener('click', () => {
    showToast('Telefon doğrulama motorunu sonraki adımda auth.js ile bağlayacağız.', 'info');
    openModal('phone-modal');
  });

  $('btn-open-pdf-modal')?.addEventListener('click', () => {
    showToast('Belge yükleme motorunu sonraki adımda auth.js ile bağlayacağız.', 'info');
    openModal('pdf-modal');
  });

  $('btn-open-vip-modal')?.addEventListener('click', () => {
    openModal('vip-modal');
  });

  $('btn-submit-koruma')?.addEventListener('click', submitKoruma);

  document.body.addEventListener('click', (event) => {
    const destekBtn = event.target.closest('.btn-destekle');

    if (destekBtn) {
      event.preventDefault();
      destekVer(destekBtn);
    }
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

  bindLoginButtons();
  bindNavigation();
  bindStaticButtons();
  startAuthWatcher();

  console.info('ME26 app.js temiz sürüm başladı.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
