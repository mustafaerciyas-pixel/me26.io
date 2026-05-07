/* ==========================================================================
   ME26 AĞI - UI MOTORU (ui.js)
   Temiz, Kısa, Hatasız Final Sürüm

   Bu dosya:
   - Başka dosya import etmez.
   - Dosyanın ortasında import yoktur.
   - escapeHtml hatası yoktur.
   - qa.js ve stadium.js tarafından beklenen exportları verir.
========================================================================== */

// ------------------------------------------------------
// TEMEL YARDIMCILAR
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

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString('tr-TR');
};

export const escapeHtml = (value) => {
  return cleanText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const setText = (id, value) => {
  const el = $(id);
  if (el) el.textContent = value;
};

export const setHtml = (id, value) => {
  const el = $(id);
  if (el) el.innerHTML = value;
};

export const setVisible = (id, visible) => {
  const el = $(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
};

export const emptyState = (text) => {
  return `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${escapeHtml(text)}
    </div>
  `;
};

export const errorState = (text) => {
  return `
    <div class="text-center py-10 border border-red-900/60 rounded-2xl text-red-300 text-xs font-bold uppercase tracking-widest bg-red-950/20">
      ${escapeHtml(text)}
    </div>
  `;
};

export const loadingState = (text = 'Yükleniyor...') => {
  return `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${escapeHtml(text)}
    </div>
  `;
};

// ------------------------------------------------------
// TOAST
// ------------------------------------------------------

export function showToast(message, type = 'info') {
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
    'pointer-events-auto px-4 py-3 rounded-xl border shadow-lg text-xs font-bold uppercase tracking-widest max-w-sm transition-all duration-300 ' +
    (variants[type] || variants.info);

  toast.textContent = `${icons[type] || 'ℹ️'} ${cleanText(message, 'Bildirim')}`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
  }, 3000);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ------------------------------------------------------
// BUTON LOADING
// ------------------------------------------------------

export function setLoading(buttonOrId, text = 'İşleniyor...') {
  const button = typeof buttonOrId === 'string' ? $(buttonOrId) : buttonOrId;

  if (!button) return '';

  const oldText = button.innerHTML;

  button.disabled = true;
  button.innerHTML = text;
  button.classList.add('opacity-70', 'cursor-wait');

  return oldText;
}

export function restoreButton(buttonOrId, oldText = '') {
  const button = typeof buttonOrId === 'string' ? $(buttonOrId) : buttonOrId;

  if (!button) return;

  button.disabled = false;

  if (oldText) {
    button.innerHTML = oldText;
  }

  button.classList.remove('opacity-70', 'cursor-wait');
}

// ------------------------------------------------------
// LANDING / PANEL GEÇİŞ
// ------------------------------------------------------

export function showLanding() {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.remove('hidden');

  if (saas) {
    saas.classList.add('hidden');
    saas.classList.remove('flex');
  }

  document.body.classList.remove('overflow-hidden');
}

export function showSaas() {
  const landing = $('landing-view');
  const saas = $('saas-view');

  if (landing) landing.classList.add('hidden');

  if (saas) {
    saas.classList.remove('hidden');
    saas.classList.add('flex');
  }

  document.body.classList.add('overflow-hidden');
}

export function showView(viewName) {
  if (viewName === 'saas' || viewName === 'panel') {
    showSaas();
    return;
  }

  showLanding();
}

// ------------------------------------------------------
// PANEL SEKME GEÇİŞİ
// ------------------------------------------------------

export function switchSaasTab(targetId) {
  if (!targetId) return;

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.add('hidden');
    section.classList.remove('block');
  });

  const target = $(targetId);

  if (target) {
    target.classList.remove('hidden');
    target.classList.add('block');
  }

  document.querySelectorAll('.nav-menu-btn').forEach((button) => {
    button.classList.remove('active', 'text-white');
    button.classList.add('text-gray-400');
  });

  document
    .querySelectorAll(`.nav-menu-btn[data-target="${targetId}"]`)
    .forEach((button) => {
      button.classList.add('active', 'text-white');
      button.classList.remove('text-gray-400');
    });

  const scrollParent = document.querySelector('#saas-view main');

  if (scrollParent) {
    scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export const switchTab = switchSaasTab;
export const navigate = switchSaasTab;

// ------------------------------------------------------
// MODAL
// ------------------------------------------------------

export function openModal(modalId) {
  const modal = $(modalId);

  if (!modal) {
    console.warn('Modal bulunamadı:', modalId);
    return;
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.setAttribute('aria-hidden', 'false');
}

export function closeModal(modalId) {
  const modal = $(modalId);

  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
  modal.setAttribute('aria-hidden', 'true');
}

export function closeAllModals() {
  [
    'ortak-kursu-modal',
    'phone-modal',
    'pdf-modal',
    'vip-modal'
  ].forEach(closeModal);
}

// ------------------------------------------------------
// PROFİL RENDER
// ------------------------------------------------------

const getDigitalId = (user = {}) => {
  if (user.digitalId) return user.digitalId;
  if (user.digital_id) return user.digital_id;

  const userNo =
    user.vip_kurucu_no ||
    user.kurucu_no ||
    user.userNo ||
    user.user_no ||
    user.no ||
    'BEKLEYEN';

  if (userNo && userNo !== 'BEKLEYEN') return `TR-IA-${userNo}`;

  return 'TR-IA-BEKLEYEN';
};

export function renderProfile(user = {}) {
  const digitalId = getDigitalId(user);

  const role =
    user.role ||
    user.mesleki_durum ||
    user.m_durum ||
    user.rutbe ||
    'Kimlik Bekleniyor';

  const city =
    user.city ||
    user.sehir ||
    'TRİBÜN SEÇİLMEDİ';

  const votePower = toNumber(user.votePower || user.vote_power || user.oy_gucu, 0);

  const inviteCount = toNumber(
    user.inviteCount ||
    user.invite_count ||
    user.davet_edilen_kisi_sayisi,
    0
  );

  const access = votePower > 0 ? 'Tam' : 'Sınırlı';

  const inviteCode =
    user.inviteCode ||
    user.kendi_davet_kodu ||
    user.davet_kodu ||
    user.d_kod ||
    digitalId;

  const baseUrl =
    window.ME26_CONFIG?.inviteBaseUrl ||
    window.ME26_CONFIG?.officialBaseUrl ||
    'https://me26.mustafaerciyas.workers.dev';

  const inviteLink = `${String(baseUrl).replace(/\/+$/, '')}/?ref=${encodeURIComponent(inviteCode)}`;

  setText('sidebar-user-id', digitalId);
  setText('mobile-user-id', digitalId);
  setText('ui-user-id', digitalId);

  setText('ui-user-role', role);
  setText('sidebar-user-role', role);

  setText('ui-user-city', city);
  setText('ui-vote-power', access);
  setText('sidebar-vote-power', `Erişim Seviyesi ${access}`);

  setText('ui-invite-link', inviteLink);
  setText('ui-vip-invite-count', `${inviteCount} / 3 Paylaşım`);

  const progressBar = $('ui-vip-progress-bar');

  if (progressBar) {
    progressBar.style.width = `${Math.min((inviteCount / 3) * 100, 100)}%`;
  }

  const cityGate = $('ui-city-selector-container');

  if (cityGate) {
    const hasCity = Boolean(city && city !== 'Belirsiz' && city !== 'TRİBÜN SEÇİLMEDİ');
    cityGate.classList.toggle('hidden', hasCity);
  }

  const roleBadge = $('ui-role-badge');

  if (roleBadge) {
    if (user.isVip || user.is_vip) {
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
    if (votePower > 0) {
      systemText.textContent =
        'Sicil kaydınız aktif. Sandık, kürsü ve katkı alanları tam erişimle kullanılabilir.';
    } else {
      systemText.textContent =
        'Kullanıcı kaydınız aktif. Şehir, telefon ve belge adımları tamamlandıkça erişim seviyesi artacak.';
    }
  }
}

export const renderUser = renderProfile;
export const updateUserPanel = renderProfile;
export const renderUserInfo = renderProfile;

// ------------------------------------------------------
// ÖNERGE RENDER
// ------------------------------------------------------

export function renderProposalCard(item = {}, options = {}) {
  const destekSayisi = toNumber(
    item.destek_sayisi ||
    item.destekSayisi ||
    item.support_count,
    0
  );

  const status = cleanText(item.status || item.durum).toLowerCase();

  const isAgenda =
    options.isAgenda ||
    destekSayisi >= 50 ||
    ['gundem', 'gündem', 'voting', 'oylama'].includes(status);

  const title = item.baslik || item.title || 'Başlıksız Önerge';
  const problem = item.sorun || item.problem || item.aciklama || 'Açıklama yok.';
  const solution = item.cozum || item.solution || '';

  return `
    <div class="bg-black/50 border border-slate-800 p-5 rounded-2xl shadow-lg" data-onerge-card="${escapeHtml(item.id)}">
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

      ${isAgenda ? `
        <div class="grid grid-cols-3 gap-2 mt-4">
          <button
            type="button"
            data-id="${escapeHtml(item.id)}"
            data-vote="yes"
            class="vote-btn bg-slate-800 border border-slate-600 hover:border-green-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Kabul
          </button>

          <button
            type="button"
            data-id="${escapeHtml(item.id)}"
            data-vote="abstain"
            class="vote-btn bg-slate-800 border border-slate-600 hover:border-yellow-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Çekimser
          </button>

          <button
            type="button"
            data-id="${escapeHtml(item.id)}"
            data-vote="no"
            class="vote-btn bg-slate-800 border border-slate-600 hover:border-red-500 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest"
          >
            Ret
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

export function renderProposals(list = []) {
  const container = $('proposals-container');

  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    container.innerHTML = emptyState('Henüz önerge yok.');
    return;
  }

  container.innerHTML = items.map((item) => renderProposalCard(item)).join('');
}

export function renderGundem(list = []) {
  const container = $('gundem-container');

  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    container.innerHTML = emptyState('Henüz gündem yok.');
    return;
  }

  container.innerHTML = items
    .map((item) => renderProposalCard(item, { isAgenda: true }))
    .join('');
}

export const renderOnergeler = renderProposals;
export const onergeleriCiz = renderProposals;

// ------------------------------------------------------
// QA / SÖZ SENDE RENDER
// ------------------------------------------------------

export function renderQuestionCard(item = {}) {
  const title = item.baslik || item.title || 'Başlıksız Soru';
  const content = item.icerik || item.content || item.aciklama || '';
  const author = item.yazar_dijital_id || item.author_id || item.yazar || 'TR-IA-BEKLEYEN';
  const solved = Boolean(item.cozuldu_mu || item.solved);
  const answerCount = item.cevap_sayisi || item.answer_count || item.answers_count || 0;

  return `
    <div class="bg-black/50 border border-slate-800 p-5 rounded-2xl shadow-lg">
      <div class="flex items-center justify-between gap-3 mb-3">
        <span class="text-[9px] font-black uppercase tracking-widest ${solved ? 'text-green-400' : 'text-kaos'}">
          ${solved ? 'Kütüphane' : 'Çözüm Bekliyor'}
        </span>

        <span class="text-[9px] font-black uppercase tracking-widest text-gray-500">
          ${escapeHtml(author)}
        </span>
      </div>

      <h3 class="text-lg md:text-xl font-black text-white mb-2 leading-tight">
        ${escapeHtml(title)}
      </h3>

      <p class="text-xs md:text-sm text-gray-400 leading-relaxed">
        ${escapeHtml(content)}
      </p>

      <div class="mt-4 flex items-center justify-between gap-3">
        <span class="text-[10px] text-gray-500 font-black uppercase tracking-widest">
          ${Number(answerCount || 0).toLocaleString('tr-TR')} cevap
        </span>

        <button
          type="button"
          data-id="${escapeHtml(item.id)}"
          class="btn-qa-cevapla bg-slate-800 border border-slate-600 hover:border-kaos hover:text-kaos text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition"
        >
          Cevapla
        </button>
      </div>
    </div>
  `;
}

export function renderQuestions(list = []) {
  const container = $('qa-listesi');

  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    container.innerHTML = emptyState('Henüz soru yok.');
    return;
  }

  container.innerHTML = items.map((item) => renderQuestionCard(item)).join('');
}

export const renderQAList = renderQuestions;
export const sorulariCiz = renderQuestions;

// ------------------------------------------------------
// TRİBÜN LİGİ
// ------------------------------------------------------

export function renderTribunLigi(list = []) {
  const body = $('tribun-ligi-body');

  if (!body) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="2" class="p-4 text-center text-gray-500 text-xs uppercase tracking-widest">
          Henüz tribün verisi yok.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = items
    .map((item, index) => {
      const city = item.sehir || item.city || item.name || item.il || 'Belirsiz';
      const power = item.guc || item.güç || item.power || item.puan || 0;

      return `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition">
          <td class="p-4 font-black text-white text-sm">
            ${index + 1}. ${escapeHtml(city)}
          </td>
          <td class="p-4 font-mono font-black text-kaos text-sm text-right">
            ${formatNumber(power)}
          </td>
        </tr>
      `;
    })
    .join('');
}

// ------------------------------------------------------
// STADYUM
// ------------------------------------------------------

export function renderStadiumStats(stats = {}) {
  setText('stat-total-online', formatNumber(stats.total || stats.total_online || 0));
  setText('stat-mezun-online', formatNumber(stats.mezun || stats.mezun_online || 0));
  setText('stat-ogrenci-online', formatNumber(stats.ogrenci || stats.ogrenci_online || 0));
  setText('stat-lider-tribun', stats.lider || stats.lider_tribun || 'Bekleniyor');
}

export function renderStadiumTribunes(list = []) {
  const container = $('stadyum-tribunler');

  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-gray-500 text-xs font-bold uppercase tracking-widest">
        Tribünler hazırlanıyor...
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const city = item.sehir || item.city || item.name || 'Belirsiz';
      const count = item.count || item.sayi || item.online || item.kisi_sayisi || 0;

      return `
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4">
          <div class="text-[10px] text-gray-500 font-black uppercase tracking-widest">
            ${escapeHtml(city)}
          </div>
          <div class="text-2xl font-black text-kaos mt-2">
            ${formatNumber(count)}
          </div>
        </div>
      `;
    })
    .join('');
}

export function addStadiumMessage(message = {}) {
  const container = $('stadyum-chat-messages');

  if (!container) return;

  const text = message.text || message.mesaj || message.content || '';
  const author = message.author || message.yazar || message.id || message.dijital_id || 'TR-IA';
  const city = message.city || message.sehir || '';

  const row = document.createElement('div');

  row.className = 'bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-2 text-xs';

  row.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="text-kaos font-black">${escapeHtml(author)}</span>
      <span class="text-gray-600 font-bold">${escapeHtml(city)}</span>
    </div>
    <div class="text-gray-300 leading-relaxed">${escapeHtml(text)}</div>
  `;

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

export function renderStageSpeaker(speaker = null) {
  const nameEl = $('sahne-kisi-isim');
  const roleEl = $('sahne-kisi-rol');
  const iconEl = $('sahne-mic-icon');

  if (!speaker) {
    if (nameEl) nameEl.textContent = 'Saha Boş';
    if (roleEl) roleEl.textContent = 'Kimse Konuşmuyor';

    if (iconEl) {
      iconEl.className = 'fa-solid fa-microphone-slash text-3xl text-gray-600';
    }

    return;
  }

  if (nameEl) nameEl.textContent = speaker.name || speaker.id || speaker.dijital_id || 'TR-IA';
  if (roleEl) roleEl.textContent = speaker.role || speaker.rol || 'Kürsüde';

  if (iconEl) {
    iconEl.className = 'fa-solid fa-microphone text-3xl text-kaos';
  }
}

// ------------------------------------------------------
// FORM YARDIMCILARI
// ------------------------------------------------------

export function clearInputs(ids = []) {
  ids.forEach((id) => {
    const el = $(id);

    if (!el) return;

    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = false;
      return;
    }

    el.value = '';
  });
}

export function getInputValue(id, fallback = '') {
  return cleanText($(id)?.value, fallback);
}

export function setInputValue(id, value = '') {
  const el = $(id);
  if (el) el.value = value;
}

// ------------------------------------------------------
// UI BAŞLAT
// ------------------------------------------------------

export function initUI() {
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    if (button.dataset.me26CloseBound === '1') return;

    button.dataset.me26CloseBound = '1';

    button.addEventListener('click', () => {
      const target = button.getAttribute('data-close-modal');
      if (target) closeModal(target);
    });
  });

  document.querySelectorAll('.nav-menu-btn').forEach((button) => {
    if (button.dataset.me26UiNavBound === '1') return;

    button.dataset.me26UiNavBound = '1';

    button.addEventListener('click', () => {
      const target = button.getAttribute('data-target');
      if (target) switchSaasTab(target);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });
}

// ------------------------------------------------------
// EXPORT NESNESİ
// ------------------------------------------------------

export const UI = {
  escapeHtml,
  showToast,
  toast: showToast,

  setText,
  setHtml,
  setVisible,

  emptyState,
  errorState,
  loadingState,

  setLoading,
  restoreButton,

  showLanding,
  showSaas,
  showView,

  switchSaasTab,
  switchTab,
  navigate,

  openModal,
  closeModal,
  closeAllModals,

  renderProfile,
  renderUser,
  updateUserPanel,
  renderUserInfo,

  renderProposalCard,
  renderProposals,
  renderGundem,
  renderOnergeler,
  onergeleriCiz,

  renderQuestionCard,
  renderQuestions,
  renderQAList,
  sorulariCiz,

  renderTribunLigi,

  renderStadiumStats,
  renderStadiumTribunes,
  addStadiumMessage,
  renderStageSpeaker,

  clearInputs,
  getInputValue,
  setInputValue,

  initUI
};

window.UI = {
  ...(window.UI || {}),
  ...UI
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.info('ME26 ui.js temiz kısa final sürüm yüklendi.');
