/* ==========================================================================
   ME26 AĞI - VIP / KURUCU NUMARA MOTORU (vip.js)
   Temiz Final Sürüm

   Görev:
   - Davet linkini üretmek
   - VIP kurucu numara seçimini yönetmek
   - Standart kurucu numara alma butonunu yönetmek
   - Supabase RPC / DB fonksiyonlarıyla uyumlu çalışmak
   - app.js, config.js, state.js, ui.js, supabase.js ile uyumlu kalmak

   Kritik:
   - Dosyanın ortasında import yoktur.
   - Davet sayısı frontend/localStorage ile artırılmaz.
   - VIP numara frontend/localStorage ile verilmez; DB/RPC dönüşü beklenir.
========================================================================== */

import { ME26_CONFIG } from './config.js';
import { STATE } from './state.js';
import { UI, showToast, setLoading, restoreButton } from './ui.js';
import { DB } from './supabase.js';

// ------------------------------------------------------
// GLOBAL DURUM
// ------------------------------------------------------

let selectedVipNumber = null;
let vipStarted = false;

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

const getCurrentUser = () => {
  if (window.ME26_APP && typeof window.ME26_APP.getCurrentUser === 'function') {
    const appUser = window.ME26_APP.getCurrentUser();
    if (appUser && appUser.uid) return appUser;
  }

  if (STATE && typeof STATE.getUser === 'function') {
    const stateUser = STATE.getUser();
    if (stateUser && stateUser.uid) return stateUser;
  }

  try {
    const raw = localStorage.getItem('me26_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.uid) return parsed;
    }
  } catch {}

  return null;
};

const getBaseUrl = () => {
  return cleanText(
    ME26_CONFIG.inviteBaseUrl ||
      ME26_CONFIG.officialBaseUrl ||
      'https://me26.mustafaerciyas.workers.dev',
    'https://me26.mustafaerciyas.workers.dev'
  ).replace(/\/+$/, '');
};

const getDigitalId = (user = {}) => {
  if (user.digitalId) return user.digitalId;
  if (user.digital_id) return user.digital_id;
  if (user.dijital_id) return user.dijital_id;

  const userNo =
    user.userNo ||
    user.user_no ||
    user.vip_kurucu_no ||
    user.kurucu_no ||
    'BEKLEYEN';

  if (userNo && userNo !== 'BEKLEYEN') {
    return String(userNo).startsWith('TR-IA-') ? String(userNo) : `TR-IA-${userNo}`;
  }

  return 'TR-IA-BEKLEYEN';
};

const getInviteCode = (user = {}) => {
  return (
    cleanText(user.inviteCode) ||
    cleanText(user.invite_code) ||
    cleanText(user.davetKodu) ||
    cleanText(user.davet_kodu) ||
    cleanText(user.kendi_davet_kodu) ||
    cleanText(user.d_kod) ||
    getDigitalId(user) ||
    cleanText(user.uid) ||
    'TR-IA-BEKLEYEN'
  );
};

const getInviteLink = () => {
  const user = getCurrentUser() || {};
  const refKey = ME26_CONFIG.inviteQueryKey || 'ref';
  const ref = encodeURIComponent(getInviteCode(user));

  return `${getBaseUrl()}/?${refKey}=${ref}`;
};

const userInviteCount = (user = {}) => {
  return toNumber(
    user.inviteCount ||
      user.invite_count ||
      user.davet_edilen_kisi_sayisi ||
      user.davet_sayisi ||
      0,
    0
  );
};

const requiredInvites = () => {
  return toNumber(ME26_CONFIG.requiredInvitesForVip, 3);
};

const vipMin = () => {
  return toNumber(ME26_CONFIG.vipMin, 101);
};

const vipMax = () => {
  return toNumber(ME26_CONFIG.vipMax, 5000);
};

const userAlreadyHasNumber = (user = {}) => {
  const userNo =
    user.userNo ||
    user.user_no ||
    user.vip_kurucu_no ||
    user.kurucu_no ||
    '';

  return Boolean(userNo && userNo !== 'BEKLEYEN');
};

const userCanOpenVip = (user = {}) => {
  return userInviteCount(user) >= requiredInvites();
};

const updateInviteLinkOnScreen = () => {
  const inviteEl = $('ui-invite-link');
  if (inviteEl) inviteEl.textContent = getInviteLink();

  const inviteCountEl = $('ui-vip-invite-count');
  const user = getCurrentUser() || {};
  const count = userInviteCount(user);

  if (inviteCountEl) {
    inviteCountEl.textContent = `${count} / ${requiredInvites()} Paylaşım`;
  }

  const progressBar = $('ui-vip-progress-bar');
  if (progressBar) {
    const percent = Math.min((count / requiredInvites()) * 100, 100);
    progressBar.style.width = `${percent}%`;
  }
};

const fallbackCopy = (text) => {
  const textarea = document.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
  } catch (error) {
    console.error('Yedek kopyalama başarısız:', error);
  }

  textarea.remove();
};

const extractAssignedNumber = (result, fallbackNumber = null) => {
  if (result === null || result === undefined) {
    return fallbackNumber;
  }

  if (typeof result === 'number' || typeof result === 'string') {
    const direct = toNumber(result, 0);
    return direct || fallbackNumber;
  }

  if (Array.isArray(result) && result.length > 0) {
    return extractAssignedNumber(result[0], fallbackNumber);
  }

  if (typeof result === 'object') {
    const possible =
      result.numara ||
      result.number ||
      result.vip_number ||
      result.vip_kurucu_no ||
      result.kurucu_no ||
      result.user_no ||
      result.userNo ||
      result.selected_number ||
      result.assigned_number ||
      result.data?.numara ||
      result.data?.number ||
      result.data?.vip_kurucu_no ||
      result.data?.kurucu_no;

    const parsed = toNumber(possible, 0);
    return parsed || fallbackNumber;
  }

  return fallbackNumber;
};

const setClaimButtonState = () => {
  const user = getCurrentUser() || {};
  const button = $('btn-claim-vip-number');
  const input = $('input-vip-number');

  if (!button) return;

  const inputNumber = toNumber(input?.value || selectedVipNumber, 0);
  const numberIsValid = inputNumber >= vipMin() && inputNumber <= vipMax();

  const locked =
    !user.uid ||
    userAlreadyHasNumber(user) ||
    !userCanOpenVip(user) ||
    !numberIsValid;

  button.disabled = locked;
  button.classList.toggle('opacity-50', locked);
  button.classList.toggle('cursor-not-allowed', locked);
};

const ensureVipHelpText = () => {
  const input = $('input-vip-number');

  if (!input) return null;

  let help = $('vip-help-text');

  if (!help) {
    help = document.createElement('p');
    help.id = 'vip-help-text';
    help.className = 'text-[10px] text-gray-500 leading-relaxed mt-2';
    input.insertAdjacentElement('afterend', help);
  }

  return help;
};

const updateVipStatusText = () => {
  const user = getCurrentUser() || {};
  const status = $('ui-vip-status');
  const help = ensureVipHelpText();
  const input = $('input-vip-number');

  updateInviteLinkOnScreen();

  if (input) {
    input.min = String(vipMin());
    input.max = String(vipMax());
  }

  if (userAlreadyHasNumber(user)) {
    const digitalId = getDigitalId(user);

    if (status) {
      status.textContent = 'ATANDI';
      status.className =
        'text-[9px] text-green-300 font-bold bg-green-950/60 px-2 py-1 rounded border border-green-700';
    }

    if (help) {
      help.textContent = `Kurucu numaranız atanmış görünüyor: ${digitalId}. Aynı hesap için ikinci numara seçilemez.`;
    }

    setClaimButtonState();
    return;
  }

  if (!user.uid) {
    if (status) {
      status.textContent = 'GİRİŞ GEREKİR';
      status.className =
        'text-[9px] text-red-300 font-bold bg-red-950/60 px-2 py-1 rounded border border-red-700';
    }

    if (help) {
      help.textContent = 'VIP kurucu numara seçmek için önce giriş yapmalısınız.';
    }

    setClaimButtonState();
    return;
  }

  if (!userCanOpenVip(user)) {
    const count = userInviteCount(user);
    const required = requiredInvites();
    const remaining = Math.max(required - count, 0);

    if (status) {
      status.textContent = 'KİLİTLİ';
      status.className =
        'text-[9px] text-gray-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700';
    }

    if (help) {
      help.textContent = `VIP ekranı için ${required} gerçek davet gerekir. Şu an ${count} kayıt görünüyor. Kalan: ${remaining}.`;
    }

    setClaimButtonState();
    return;
  }

  if (status) {
    status.textContent = 'AÇIK';
    status.className =
      'text-[9px] text-kaos font-bold bg-yellow-950/30 px-2 py-1 rounded border border-yellow-500/40';
  }

  if (help) {
    help.textContent = `VIP numara seçimi açık. ${vipMin()} ile ${vipMax()} arasında bir kurucu numara seçebilirsiniz.`;
  }

  setClaimButtonState();
};

const syncStateNumber = (number, isVip = false) => {
  const cleanNumber = toNumber(number, 0);
  if (!cleanNumber) return null;

  if (isVip && STATE && typeof STATE.setVipNumber === 'function') {
    return STATE.setVipNumber(cleanNumber);
  }

  if (!isVip && STATE && typeof STATE.setStandardNumber === 'function') {
    return STATE.setStandardNumber(cleanNumber);
  }

  if (STATE && typeof STATE.updateUserMany === 'function') {
    return STATE.updateUserMany({
      userNo: cleanNumber,
      user_no: cleanNumber,
      digitalId: `TR-IA-${cleanNumber}`,
      digital_id: `TR-IA-${cleanNumber}`,
      isVip,
      is_vip: isVip
    });
  }

  return null;
};

const refreshAfterNumberChange = async () => {
  const user = getCurrentUser() || {};

  try {
    if (
      window.ME26_APP &&
      typeof window.ME26_APP.refreshCurrentUser === 'function' &&
      user.uid
    ) {
      const refreshed = await window.ME26_APP.refreshCurrentUser(user.uid);

      if (refreshed && UI && typeof UI.renderProfile === 'function') {
        UI.renderProfile(refreshed);
      }

      updateVipStatusText();
      return refreshed;
    }
  } catch (error) {
    console.warn('VIP sonrası kullanıcı yenileme uyarısı:', error);
  }

  const latest = getCurrentUser() || user;

  if (UI && typeof UI.renderProfile === 'function') {
    UI.renderProfile(latest);
  }

  updateVipStatusText();
  return latest;
};

// ------------------------------------------------------
// VIP GRID DESTEĞİ
// Eski index.html içinde ui-vip-grid varsa çalışır.
// Yeni index.html input-vip-number ile çalışır.
// ------------------------------------------------------

const sampleVipNumbers = () => {
  const preferred = [
    101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
    111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
    126, 200, 222, 300, 333, 500, 555, 777, 888, 999,
    1000, 1071, 1453, 1923, 2026, 3000, 4444, 5000
  ];

  return preferred.filter((number) => {
    return number >= vipMin() && number <= vipMax();
  });
};

function clearGridSelection() {
  document.querySelectorAll('.vip-num-btn').forEach((button) => {
    button.classList.remove('bg-kaos', 'text-slate-950', 'border-kaos', 'shadow-kaos');
    button.classList.add('bg-slate-800', 'text-white', 'border-slate-700');
  });
}

export function renderVipGrid() {
  const grid = $('ui-vip-grid');

  if (!grid) return;

  grid.innerHTML = '';

  const numbers = sampleVipNumbers();

  if (numbers.length === 0) {
    const empty = document.createElement('div');
    empty.className =
      'col-span-full text-center text-gray-500 text-xs uppercase tracking-widest py-8';
    empty.textContent = 'Şu an seçilebilir VIP numara bulunmuyor.';
    grid.appendChild(empty);
    return;
  }

  numbers.forEach((number) => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className =
      'vip-num-btn bg-slate-800 border border-slate-700 text-white py-3 rounded-lg font-mono text-sm font-black hover:border-kaos hover:text-kaos transition-all';
    button.textContent = `#${number}`;
    button.setAttribute('data-vip-number', String(number));

    button.addEventListener('click', () => {
      clearGridSelection();

      button.classList.remove('bg-slate-800', 'text-white', 'border-slate-700');
      button.classList.add('bg-kaos', 'text-slate-950', 'border-kaos', 'shadow-kaos');

      selectedVipNumber = number;

      const input = $('input-vip-number');
      if (input) input.value = String(number);

      setClaimButtonState();
    });

    grid.appendChild(button);
  });
}

// ------------------------------------------------------
// DAVET PAYLAŞIMI
// ------------------------------------------------------

export async function copyInviteLink() {
  const link = getInviteLink();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(link);
    } else {
      fallbackCopy(link);
    }

    showToast('Davet bağlantısı kopyalandı.', 'success');
  } catch (error) {
    console.warn('Clipboard kopyalama başarısız, fallback deneniyor:', error);
    fallbackCopy(link);
    showToast('Davet bağlantısı kopyalandı.', 'success');
  } finally {
    updateInviteLinkOnScreen();
  }
}

export function shareInviteOnWhatsApp() {
  const link = getInviteLink();

  const message =
    `ME26 Ağı açılıyor.\n\n` +
    `İçmimarlık Mezunları ve İçmimarlık Öğrencileri için belge kontrollü, aidatsız ve başkansız dijital meclise katıl:\n${link}`;

  window.open(
    `https://wa.me/?text=${encodeURIComponent(message)}`,
    '_blank',
    'noopener,noreferrer'
  );

  showToast('WhatsApp paylaşım ekranı açıldı.', 'success');
  updateInviteLinkOnScreen();
}

// ------------------------------------------------------
// STANDART NUMARA AL
// ------------------------------------------------------

export async function claimStandardNumber() {
  const user = getCurrentUser();

  if (!user || !user.uid) {
    showToast('Standart numara almak için giriş yapmalısınız.', 'error');
    return;
  }

  if (userAlreadyHasNumber(user)) {
    showToast('Bu hesap için kurucu numara zaten atanmış.', 'info');
    return;
  }

  const button = $('btn-standart-numara');
  const oldText = setLoading(button, 'Numara Alınıyor...');

  try {
    let result = null;

    if (DB && typeof DB.standartNumaraAl === 'function') {
      result = await DB.standartNumaraAl(user.uid);
    } else if (DB && typeof DB.kurucuNumaraAl === 'function') {
      result = await DB.kurucuNumaraAl(user.uid);
    } else {
      throw new Error('standard_number_backend_missing');
    }

    const assignedNumber = extractAssignedNumber(result, null);

    if (!assignedNumber) {
      throw new Error('standard_number_missing');
    }

    syncStateNumber(assignedNumber, false);

    showToast(`Kurucu numaranız TR-IA-${assignedNumber} olarak kaydedildi.`, 'success');

    await refreshAfterNumberChange();
  } catch (error) {
    console.error('Standart numara alma hatası:', error);

    if (error?.message === 'standard_number_backend_missing') {
      showToast('Standart numara sistemi veritabanı fonksiyonuna bağlı değil.', 'error');
    } else {
      showToast(error?.message || 'Standart numara alınamadı.', 'error');
    }
  } finally {
    restoreButton(button, oldText || 'Sıradan Numarayı Al');
  }
}

// ------------------------------------------------------
// VIP NUMARA REZERVE ET
// ------------------------------------------------------

export async function claimVipNumber() {
  const user = getCurrentUser();

  if (!user || !user.uid) {
    showToast('VIP numara seçmek için giriş yapmalısınız.', 'error');
    updateVipStatusText();
    return;
  }

  if (userAlreadyHasNumber(user)) {
    showToast('Bu hesap için kurucu numara zaten atanmış.', 'info');
    updateVipStatusText();
    return;
  }

  if (!userCanOpenVip(user)) {
    showToast('VIP numara seçimi için gerekli gerçek davet sayısına henüz ulaşılmadı.', 'error');
    updateVipStatusText();
    return;
  }

  const input = $('input-vip-number');
  const requestedNumber = toNumber(input?.value || selectedVipNumber, 0);

  if (!requestedNumber) {
    showToast('Lütfen önce bir VIP kurucu numara seçin.', 'error');
    return;
  }

  if (requestedNumber < vipMin() || requestedNumber > vipMax()) {
    showToast(`VIP numara ${vipMin()} ile ${vipMax()} arasında olmalıdır.`, 'error');
    return;
  }

  const button = $('btn-claim-vip-number');
  const oldText = setLoading(button, 'Rezerve Ediliyor...');

  try {
    let result = null;

    if (DB && typeof DB.vipNumaraRezerveEt === 'function') {
      result = await DB.vipNumaraRezerveEt(user.uid, requestedNumber);
    } else if (DB && typeof DB.vipNumaraAl === 'function') {
      result = await DB.vipNumaraAl(user.uid, requestedNumber);
    } else {
      throw new Error('vip_backend_missing');
    }

    const assignedNumber = extractAssignedNumber(result, requestedNumber);

    if (!assignedNumber) {
      throw new Error('vip_number_missing');
    }

    syncStateNumber(assignedNumber, true);

    if (UI && typeof UI.closeModal === 'function') {
      UI.closeModal('vip-modal');
    }

    showToast(`Tebrikler! VIP kurucu numaranız TR-IA-${assignedNumber} olarak kaydedildi.`, 'success');

    await refreshAfterNumberChange();
  } catch (error) {
    console.error('VIP numara rezervasyon hatası:', error);

    const message = cleanText(error?.message || error);

    if (message === 'vip_backend_missing') {
      showToast('VIP numara rezervasyonu veritabanı kilidine bağlanmadan açılamaz.', 'error');
    } else if (message === 'vip_number_taken') {
      showToast('Bu VIP numara az önce başka biri tarafından alındı. Lütfen başka bir numara seçin.', 'error');
      renderVipGrid();
    } else if (message === 'not_enough_invites') {
      showToast('VIP numara seçimi için gerekli gerçek davet sayısına henüz ulaşılmadı.', 'error');
      updateVipStatusText();
    } else if (message === 'already_has_number') {
      showToast('Bu hesap için kurucu numara zaten atanmış.', 'info');
      if (UI && typeof UI.closeModal === 'function') UI.closeModal('vip-modal');
      await refreshAfterNumberChange();
    } else {
      showToast(message || 'VIP numara rezerve edilemedi. Lütfen tekrar deneyin.', 'error');
    }
  } finally {
    restoreButton(button, oldText || 'Seçili Numarayı Rezerve Et');
    setClaimButtonState();
  }
}

// ------------------------------------------------------
// MODAL DURUMU
// ------------------------------------------------------

export function updateVipModalState() {
  updateInviteLinkOnScreen();
  updateVipStatusText();
  renderVipGrid();
  setClaimButtonState();
}

// ------------------------------------------------------
// EVENTLER
// ------------------------------------------------------

function bindVipEvents() {
  const openButton = $('btn-open-vip-modal');

  if (openButton && openButton.dataset.me26VipOpenBound !== '1') {
    openButton.dataset.me26VipOpenBound = '1';

    openButton.addEventListener('click', () => {
      updateVipModalState();
    });
  }

  const input = $('input-vip-number');

  if (input && input.dataset.me26VipInputBound !== '1') {
    input.dataset.me26VipInputBound = '1';

    input.min = String(vipMin());
    input.max = String(vipMax());

    input.addEventListener('input', () => {
      let value = toNumber(input.value, 0);

      if (value < 0) value = 0;

      selectedVipNumber = value || null;

      if (value > vipMax()) {
        input.value = String(vipMax());
        selectedVipNumber = vipMax();
      }

      setClaimButtonState();
    });
  }

  const claimVipButton = $('btn-claim-vip-number');

  if (claimVipButton && claimVipButton.dataset.me26VipClaimBound !== '1') {
    claimVipButton.dataset.me26VipClaimBound = '1';
    claimVipButton.addEventListener('click', claimVipNumber);
  }

  const standardButton = $('btn-standart-numara');

  if (standardButton && standardButton.dataset.me26StandardClaimBound !== '1') {
    standardButton.dataset.me26StandardClaimBound = '1';
    standardButton.addEventListener('click', claimStandardNumber);
  }
}

// ------------------------------------------------------
// BAŞLAT
// ------------------------------------------------------

export function initVip() {
  if (vipStarted) return;

  vipStarted = true;

  bindVipEvents();
  updateVipModalState();

  console.info('ME26 vip.js temiz final sürüm yüklendi.');
}

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------

export const VIP = {
  initVip,

  getInviteLink,
  copyInviteLink,
  shareInviteOnWhatsApp,

  updateVipModalState,
  updateModalState: updateVipModalState,

  renderVipGrid,

  claimStandardNumber,
  claimVipNumber,
  claimNumber: claimVipNumber
};

window.ME26_VIP = VIP;
window.VIP = VIP;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVip);
} else {
  initVip();
}
