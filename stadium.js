/* ==========================================================================
   ME26 AĞI - CANLI STADYUM MOTORU (stadium.js)
   Temiz Final Sürüm

   Görev:
   - Canlı stadyum istatistikleri
   - Şehir tribünleri
   - Tribün chat mesajları
   - Söz isteme / kürsüden inme
   - Supabase varsa canlı kayıt, yoksa güvenli local fallback

   Kullanılan ID'ler:
   - stat-total-online
   - stat-mezun-online
   - stat-ogrenci-online
   - stat-lider-tribun
   - stadyum-tribunler
   - stadyum-chat-messages
   - input-chat-mesaj
   - btn-chat-gonder
   - btn-soz-iste
   - btn-kursuyu-birak
   - sahne-kisi-isim
   - sahne-kisi-rol
   - sahne-mic-icon
   - saha-dalgalar
   - chat-cooldown-overlay
   - chat-cooldown-timer
========================================================================== */

import { DB } from './supabase.js';
import {
  escapeHtml,
  showToast,
  renderStadiumStats,
  renderStadiumTribunes,
  addStadiumMessage,
  renderStageSpeaker
} from './ui.js';

// ------------------------------------------------------
// GLOBAL DURUM
// ------------------------------------------------------

const CHAT_COOLDOWN_SECONDS = 60;
const CHAT_LIMIT = 30;
const PRESENCE_INTERVAL_MS = 30000;
const STADIUM_REFRESH_INTERVAL_MS = 45000;
const CHAT_REFRESH_INTERVAL_MS = 20000;

const CHAT_COOLDOWN_KEY = 'me26_stadium_chat_last_time';
const LOCAL_SPEAKER_KEY = 'me26_stadium_local_speaker';

let stadiumStarted = false;
let presenceTimer = null;
let stadiumTimer = null;
let chatTimer = null;
let cooldownTimer = null;
let isOnStage = false;

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

const safeJsonParse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getSupabase = () => {
  return DB?.supabase || window.ME26_SUPABASE || window.ME26_DB?.supabase || null;
};

const getCurrentUser = () => {
  if (window.ME26_APP && typeof window.ME26_APP.getCurrentUser === 'function') {
    const user = window.ME26_APP.getCurrentUser();
    if (user) return user;
  }

  try {
    const raw = localStorage.getItem('me26_user');
    if (raw) return JSON.parse(raw);
  } catch {}

  return null;
};

const getDigitalId = (user = {}) => {
  return (
    user.digitalId ||
    user.digital_id ||
    user.dijital_id ||
    user.kendi_davet_kodu ||
    user.davet_kodu ||
    'TR-IA-BEKLEYEN'
  );
};

const getUserCity = (user = {}) => {
  return user.city || user.sehir || 'Belirsiz';
};

const getUserRole = (user = {}) => {
  return user.role || user.mesleki_durum || user.m_durum || 'Kimlik Bekleniyor';
};

const nowIso = () => new Date().toISOString();

const isStadiumVisible = () => {
  const stadium = $('view-stadium');
  if (!stadium) return false;

  return !stadium.classList.contains('hidden');
};

// ------------------------------------------------------
// SUPABASE GÜVENLİ DENEME YARDIMCILARI
// ------------------------------------------------------

async function trySelectFromTables(tableNames = [], buildQuery) {
  const supabase = getSupabase();

  if (!supabase) return null;

  let lastError = null;

  for (const table of tableNames) {
    try {
      let query = supabase.from(table).select('*');

      if (typeof buildQuery === 'function') {
        query = buildQuery(query, table);
      }

      const { data, error } = await query;

      if (error) throw error;

      return Array.isArray(data) ? data : [];
    } catch (error) {
      lastError = error;
      console.warn(`Stadium select başarısız: ${table}`, error);
    }
  }

  if (lastError) console.warn('Stadium select tamamen başarısız:', lastError);

  return null;
}

async function tryInsertIntoTables(tableNames = [], payload = {}) {
  const supabase = getSupabase();

  if (!supabase) return null;

  let lastError = null;

  for (const table of tableNames) {
    try {
      const { data, error } = await supabase
        .from(table)
        .insert([payload])
        .select()
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Stadium insert başarısız: ${table}`, error);
    }
  }

  if (lastError) throw lastError;

  return null;
}

async function tryUpsertIntoTables(tableNames = [], payload = {}, conflictColumn = 'uid') {
  const supabase = getSupabase();

  if (!supabase) return null;

  let lastError = null;

  for (const table of tableNames) {
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert([payload], { onConflict: conflictColumn })
        .select()
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Stadium upsert başarısız: ${table}`, error);
    }
  }

  if (lastError) console.warn('Stadium upsert tamamen başarısız:', lastError);

  return null;
}

async function tryUpdateTables(tableNames = [], match = {}, updates = {}) {
  const supabase = getSupabase();

  if (!supabase) return null;

  let lastError = null;

  for (const table of tableNames) {
    try {
      let query = supabase.from(table).update(updates).select();

      Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query;

      if (error) throw error;

      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Stadium update başarısız: ${table}`, error);
    }
  }

  if (lastError) console.warn('Stadium update tamamen başarısız:', lastError);

  return null;
}

// ------------------------------------------------------
// PRESENCE / ONLINE DURUM
// ------------------------------------------------------

async function syncPresence() {
  const user = getCurrentUser();

  if (!user?.uid) return;

  const payload = {
    uid: user.uid,
    dijital_id: getDigitalId(user),
    sehir: getUserCity(user),
    rol: getUserRole(user),
    online: true,
    son_gorulme: nowIso(),
    updated_at: nowIso()
  };

  await tryUpsertIntoTables(
    ['me26_stadyum_presence', 'stadyum_presence', 'stadium_presence'],
    payload,
    'uid'
  );
}

function startPresenceHeartbeat() {
  if (presenceTimer) clearInterval(presenceTimer);

  syncPresence();

  presenceTimer = setInterval(() => {
    syncPresence();
  }, PRESENCE_INTERVAL_MS);
}

// ------------------------------------------------------
// STADYUM İSTATİSTİKLERİ
// ------------------------------------------------------

async function fetchUsersForFallback() {
  const supabase = getSupabase();

  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,sehir,city,mesleki_durum,m_durum,role,oy_gucu,vote_power');

    if (error) throw error;

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('users fallback okunamadı:', error);
    return [];
  }
}

function buildStatsFromUsers(users = []) {
  const cityMap = new Map();

  let mezun = 0;
  let ogrenci = 0;

  users.forEach((user) => {
    const city = cleanText(user.sehir || user.city || 'Belirsiz');
    const role = cleanText(user.mesleki_durum || user.m_durum || user.role || '').toLowerCase();

    if (role.includes('öğr') || role.includes('ogr')) {
      ogrenci += 1;
    } else {
      mezun += 1;
    }

    if (!cityMap.has(city)) {
      cityMap.set(city, {
        sehir: city,
        city,
        count: 0,
        sayi: 0,
        online: 0,
        guc: 0
      });
    }

    const current = cityMap.get(city);
    current.count += 1;
    current.sayi += 1;
    current.online += 1;
    current.guc += toNumber(user.oy_gucu || user.vote_power, 0);
  });

  const tribunes = Array.from(cityMap.values()).sort((a, b) => {
    return (b.count || 0) - (a.count || 0);
  });

  const leader = tribunes[0]?.sehir || 'Bekleniyor';

  return {
    stats: {
      total: users.length,
      total_online: users.length,
      mezun,
      mezun_online: mezun,
      ogrenci,
      ogrenci_online: ogrenci,
      lider: leader,
      lider_tribun: leader
    },
    tribunes
  };
}

async function fetchStadiumStats() {
  try {
    const data = await DB.stadyumDurumuGetir();

    if (data && typeof data === 'object') {
      return {
        total: data.total || data.total_online || 0,
        total_online: data.total_online || data.total || 0,
        mezun: data.mezun || data.mezun_online || 0,
        mezun_online: data.mezun_online || data.mezun || 0,
        ogrenci: data.ogrenci || data.ogrenci_online || 0,
        ogrenci_online: data.ogrenci_online || data.ogrenci || 0,
        lider: data.lider || data.lider_tribun || 'Bekleniyor',
        lider_tribun: data.lider_tribun || data.lider || 'Bekleniyor'
      };
    }
  } catch (error) {
    console.warn('DB.stadyumDurumuGetir çalışmadı:', error);
  }

  const users = await fetchUsersForFallback();
  return buildStatsFromUsers(users).stats;
}

async function fetchTribunes() {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('me26_stadyum_tribunler_getir');

      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (error) {
      console.warn('me26_stadyum_tribunler_getir RPC çalışmadı:', error);
    }
  }

  const users = await fetchUsersForFallback();
  return buildStatsFromUsers(users).tribunes;
}

async function loadStadium() {
  try {
    await syncPresence();

    const [stats, tribunes] = await Promise.all([
      fetchStadiumStats(),
      fetchTribunes()
    ]);

    renderStadiumStats(stats);
    renderStadiumTribunes(tribunes);
  } catch (error) {
    console.error('Stadyum yüklenemedi:', error);
    showToast('Stadyum verileri alınamadı.', 'error');
  }
}

function startStadiumRefresh() {
  if (stadiumTimer) clearInterval(stadiumTimer);

  loadStadium();

  stadiumTimer = setInterval(() => {
    if (isStadiumVisible()) {
      loadStadium();
    }
  }, STADIUM_REFRESH_INTERVAL_MS);
}

// ------------------------------------------------------
// CHAT
// ------------------------------------------------------

function getLastChatTime() {
  try {
    return Number(localStorage.getItem(CHAT_COOLDOWN_KEY) || 0);
  } catch {
    return 0;
  }
}

function setLastChatTime() {
  try {
    localStorage.setItem(CHAT_COOLDOWN_KEY, String(Date.now()));
  } catch {}
}

function getCooldownRemaining() {
  const last = getLastChatTime();

  if (!last) return 0;

  const diff = Math.floor((Date.now() - last) / 1000);
  return Math.max(CHAT_COOLDOWN_SECONDS - diff, 0);
}

function updateCooldownOverlay() {
  const remaining = getCooldownRemaining();
  const overlay = $('chat-cooldown-overlay');
  const timer = $('chat-cooldown-timer');

  if (!overlay || !timer) return;

  if (remaining > 0) {
    overlay.classList.remove('hidden');
    timer.textContent = String(remaining);
  } else {
    overlay.classList.add('hidden');

    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }
}

function startCooldownTimer() {
  if (cooldownTimer) clearInterval(cooldownTimer);

  updateCooldownOverlay();

  cooldownTimer = setInterval(updateCooldownOverlay, 1000);
}

async function fetchChatMessages() {
  const supabase = getSupabase();

  if (!supabase) return [];

  const tables = ['me26_stadyum_mesajlari', 'stadyum_mesajlari', 'stadium_messages'];
  const orderColumns = ['created_at', 'olusturulma_tarihi', 'tarih'];

  let lastError = null;

  for (const table of tables) {
    for (const orderColumn of orderColumns) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order(orderColumn, { ascending: false })
          .limit(CHAT_LIMIT);

        if (error) throw error;

        return Array.isArray(data) ? data.reverse() : [];
      } catch (error) {
        lastError = error;
      }
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(CHAT_LIMIT);

      if (error) throw error;

      return Array.isArray(data) ? data : [];
    } catch (error) {
      lastError = error;
      console.warn(`Chat mesajları okunamadı: ${table}`, error);
    }
  }

  if (lastError) console.warn('Chat tamamen okunamadı:', lastError);

  return [];
}

function renderChatMessages(messages = []) {
  const container = $('stadyum-chat-messages');

  if (!container) return;

  container.innerHTML = '';

  const items = Array.isArray(messages) ? messages : [];

  if (items.length === 0) {
    container.innerHTML = `
      <div class="animate-pulse text-gray-500 text-xs font-bold uppercase tracking-widest">
        Tribün mesajları bekleniyor...
      </div>
    `;
    return;
  }

  items.forEach((message) => {
    addStadiumMessage({
      text: message.mesaj || message.text || message.content || '',
      author: message.dijital_id || message.author || message.yazar || 'TR-IA',
      city: message.sehir || message.city || ''
    });
  });
}

async function loadChatMessages() {
  try {
    const messages = await fetchChatMessages();
    renderChatMessages(messages);
  } catch (error) {
    console.warn('Chat mesajları yüklenemedi:', error);
  }
}

async function sendChatMessage() {
  const input = $('input-chat-mesaj');
  const message = cleanText(input?.value);

  if (!message) {
    showToast('Mesaj yazmadan gönderemezsiniz.', 'error');
    return;
  }

  if (message.length < 2) {
    showToast('Mesaj çok kısa.', 'error');
    return;
  }

  if (message.length > 80) {
    showToast('Mesaj en fazla 80 karakter olabilir.', 'error');
    return;
  }

  const remaining = getCooldownRemaining();

  if (remaining > 0) {
    showToast(`${remaining} saniye sonra tekrar mesaj gönderebilirsiniz.`, 'warning');
    startCooldownTimer();
    return;
  }

  const user = getCurrentUser();

  if (!user?.uid) {
    showToast('Mesaj göndermek için giriş yapmalısınız.', 'error');
    return;
  }

  const button = $('btn-chat-gonder');
  const oldText = button ? button.innerHTML : '';

  if (button) {
    button.disabled = true;
    button.innerHTML = '...';
  }

  try {
    const payload = {
      uid: user.uid,
      dijital_id: getDigitalId(user),
      sehir: getUserCity(user),
      city: getUserCity(user),
      mesaj: message,
      text: message,
      created_at: nowIso(),
      olusturulma_tarihi: nowIso()
    };

    try {
      await DB.stadyumMesajGonder(payload);
    } catch (dbError) {
      console.warn('DB.stadyumMesajGonder çalışmadı, tablo fallback deneniyor:', dbError);

      await tryInsertIntoTables(
        ['me26_stadyum_mesajlari', 'stadyum_mesajlari', 'stadium_messages'],
        payload
      );
    }

    input.value = '';
    setLastChatTime();
    startCooldownTimer();

    showToast('Mesaj tribüne gönderildi.', 'success');
    await loadChatMessages();
  } catch (error) {
    console.error('Mesaj gönderilemedi:', error);
    showToast(error?.message || 'Mesaj gönderilemedi.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = oldText || 'Gönder';
    }
  }
}

function startChatRefresh() {
  if (chatTimer) clearInterval(chatTimer);

  loadChatMessages();

  chatTimer = setInterval(() => {
    if (isStadiumVisible()) {
      loadChatMessages();
    }
  }, CHAT_REFRESH_INTERVAL_MS);
}

// ------------------------------------------------------
// SAHNE / SÖZ İSTEME
// ------------------------------------------------------

function getLocalSpeaker() {
  try {
    const raw = localStorage.getItem(LOCAL_SPEAKER_KEY);
    return safeJsonParse(raw, null);
  } catch {
    return null;
  }
}

function setLocalSpeaker(speaker) {
  try {
    localStorage.setItem(LOCAL_SPEAKER_KEY, JSON.stringify(speaker));
  } catch {}
}

function clearLocalSpeaker() {
  try {
    localStorage.removeItem(LOCAL_SPEAKER_KEY);
  } catch {}
}

async function fetchCurrentSpeaker() {
  const rows = await trySelectFromTables(
    ['me26_stadyum_kursu', 'stadyum_kursu', 'stadium_stage'],
    (query) => query.eq('aktif', true).limit(1)
  );

  if (Array.isArray(rows) && rows.length > 0) {
    const row = rows[0];

    return {
      uid: row.uid,
      id: row.dijital_id || row.id || 'TR-IA',
      name: row.dijital_id || row.name || row.id || 'TR-IA',
      role: row.rol || row.role || 'Kürsüde',
      city: row.sehir || row.city || ''
    };
  }

  return getLocalSpeaker();
}

function updateStageButtons(speaker = null) {
  const user = getCurrentUser();
  const requestBtn = $('btn-soz-iste');
  const leaveBtn = $('btn-kursuyu-birak');

  const currentUserIsSpeaker =
    Boolean(user?.uid && speaker?.uid && user.uid === speaker.uid) ||
    Boolean(isOnStage);

  if (requestBtn) {
    requestBtn.classList.toggle('hidden', currentUserIsSpeaker);
  }

  if (leaveBtn) {
    leaveBtn.classList.toggle('hidden', !currentUserIsSpeaker);
  }
}

async function renderCurrentSpeaker() {
  try {
    const speaker = await fetchCurrentSpeaker();

    if (speaker) {
      renderStageSpeaker(speaker);
      updateStageButtons(speaker);
      return;
    }

    renderStageSpeaker(null);
    updateStageButtons(null);
  } catch (error) {
    console.warn('Kürsü bilgisi alınamadı:', error);
    renderStageSpeaker(null);
    updateStageButtons(null);
  }
}

async function requestSpeak() {
  const user = getCurrentUser();

  if (!user?.uid) {
    showToast('Söz istemek için giriş yapmalısınız.', 'error');
    return;
  }

  const speaker = {
    uid: user.uid,
    dijital_id: getDigitalId(user),
    id: getDigitalId(user),
    name: getDigitalId(user),
    rol: getUserRole(user),
    role: getUserRole(user),
    sehir: getUserCity(user),
    city: getUserCity(user),
    aktif: true,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  const button = $('btn-soz-iste');
  const oldText = button ? button.innerHTML : '';

  if (button) {
    button.disabled = true;
    button.innerHTML = 'Söz Alınıyor...';
  }

  try {
    try {
      await tryInsertIntoTables(
        ['me26_stadyum_kursu', 'stadyum_kursu', 'stadium_stage'],
        speaker
      );
    } catch (error) {
      console.warn('Kürsü tablosuna yazılamadı, local fallback kullanılıyor:', error);
    }

    setLocalSpeaker(speaker);
    isOnStage = true;

    renderStageSpeaker(speaker);
    updateStageButtons(speaker);

    showToast('Söz aldınız. Kürsü sizde.', 'success');
  } catch (error) {
    console.error('Söz alma hatası:', error);
    showToast(error?.message || 'Söz alınamadı.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = oldText || 'Söz İste';
    }
  }
}

async function leaveStage() {
  const user = getCurrentUser();

  if (!user?.uid) {
    isOnStage = false;
    clearLocalSpeaker();
    renderStageSpeaker(null);
    updateStageButtons(null);
    return;
  }

  const button = $('btn-kursuyu-birak');
  const oldText = button ? button.innerHTML : '';

  if (button) {
    button.disabled = true;
    button.innerHTML = 'İniliyor...';
  }

  try {
    await tryUpdateTables(
      ['me26_stadyum_kursu', 'stadyum_kursu', 'stadium_stage'],
      { uid: user.uid },
      {
        aktif: false,
        updated_at: nowIso()
      }
    );

    const localSpeaker = getLocalSpeaker();

    if (localSpeaker?.uid === user.uid) {
      clearLocalSpeaker();
    }

    isOnStage = false;

    renderStageSpeaker(null);
    updateStageButtons(null);

    showToast('Kürsüden indiniz.', 'info');
  } catch (error) {
    console.warn('Kürsüden inme update başarısız, local temizleniyor:', error);

    clearLocalSpeaker();
    isOnStage = false;

    renderStageSpeaker(null);
    updateStageButtons(null);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = oldText || 'Kürsüden İn';
    }
  }
}

// ------------------------------------------------------
// EVENT BAĞLAMA
// ------------------------------------------------------

function bindStadiumEvents() {
  const chatButton = $('btn-chat-gonder');

  if (chatButton && chatButton.dataset.me26StadiumChatBound !== '1') {
    chatButton.dataset.me26StadiumChatBound = '1';
    chatButton.addEventListener('click', sendChatMessage);
  }

  const chatInput = $('input-chat-mesaj');

  if (chatInput && chatInput.dataset.me26StadiumInputBound !== '1') {
    chatInput.dataset.me26StadiumInputBound = '1';

    chatInput.addEventListener('input', () => {
      if (chatInput.value.length > 80) {
        chatInput.value = chatInput.value.slice(0, 80);
      }
    });

    chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }

  const requestButton = $('btn-soz-iste');

  if (requestButton && requestButton.dataset.me26StadiumSpeakBound !== '1') {
    requestButton.dataset.me26StadiumSpeakBound = '1';
    requestButton.addEventListener('click', requestSpeak);
  }

  const leaveButton = $('btn-kursuyu-birak');

  if (leaveButton && leaveButton.dataset.me26StadiumLeaveBound !== '1') {
    leaveButton.dataset.me26StadiumLeaveBound = '1';
    leaveButton.addEventListener('click', leaveStage);
  }

  document.querySelectorAll('.nav-menu-btn[data-target="view-stadium"]').forEach((button) => {
    if (button.dataset.me26StadiumNavBound === '1') return;

    button.dataset.me26StadiumNavBound = '1';

    button.addEventListener('click', () => {
      setTimeout(() => {
        loadStadium();
        loadChatMessages();
        renderCurrentSpeaker();
      }, 200);
    });
  });
}

// ------------------------------------------------------
// BAŞLAT / DURDUR
// ------------------------------------------------------

export function initStadium() {
  if (stadiumStarted) return;

  stadiumStarted = true;

  bindStadiumEvents();
  startPresenceHeartbeat();
  startStadiumRefresh();
  startChatRefresh();
  startCooldownTimer();
  renderCurrentSpeaker();

  console.info('ME26 stadium.js temiz final sürüm yüklendi.');
}

export function stopStadium() {
  if (presenceTimer) clearInterval(presenceTimer);
  if (stadiumTimer) clearInterval(stadiumTimer);
  if (chatTimer) clearInterval(chatTimer);
  if (cooldownTimer) clearInterval(cooldownTimer);

  presenceTimer = null;
  stadiumTimer = null;
  chatTimer = null;
  cooldownTimer = null;
}

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------

window.ME26_STADIUM = {
  initStadium,
  stopStadium,
  loadStadium,
  loadChatMessages,
  sendChatMessage,
  requestSpeak,
  leaveStage,
  renderCurrentSpeaker
};

window.loadStadium = loadStadium;
window.stadyumuYukle = loadStadium;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStadium);
} else {
  initStadium();
}
