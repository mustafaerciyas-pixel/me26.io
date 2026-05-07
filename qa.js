/* ==========================================================================
   ME26 AĞI - SÖZ SENDE / QA MOTORU (qa.js)
   Temiz Final Sürüm

   Görev:
   - Söz Sende soru listesini yüklemek
   - Çözüm Bekleyenler / Kütüphane sekmeleri
   - Yeni soru gönderimi
   - Soruya cevap yazma
   - Çözüldü / kütüphaneye taşıma desteği

   Not:
   - Önerge gönderimini app.js yönetir.
   - Bu dosya sadece soru modundayken submit işlemini yakalar.
========================================================================== */

import { DB } from './supabase.js';
import {
  UI,
  escapeHtml,
  showToast,
  openModal,
  closeModal,
  setLoading,
  restoreButton
} from './ui.js';

// ------------------------------------------------------
// GLOBAL DURUM
// ------------------------------------------------------

let currentQaFilter = 'bekleyen';
let qaStarted = false;

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------

const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const isHidden = (el) => {
  if (!el) return true;
  return el.classList.contains('hidden') || el.style.display === 'none';
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

const getQuestionMode = () => {
  const soruFields = $('kursu-soru-fields');
  const onergeFields = $('kursu-onerge-fields');

  if (soruFields && !isHidden(soruFields)) return true;
  if (onergeFields && isHidden(onergeFields)) return true;

  return false;
};

const emptyState = (text) => {
  return `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${escapeHtml(text)}
    </div>
  `;
};

const errorState = (text) => {
  return `
    <div class="text-center py-10 border border-red-900/60 rounded-2xl text-red-300 text-xs font-bold uppercase tracking-widest bg-red-950/20">
      ${escapeHtml(text)}
    </div>
  `;
};

const loadingState = (text = 'Meclis kayıtları okunuyor...') => {
  return `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${escapeHtml(text)}
    </div>
  `;
};

// ------------------------------------------------------
// MODAL SORU MODU
// ------------------------------------------------------

function setKursuQuestionMode() {
  const onergeBtn = $('tab-btn-onerge');
  const soruBtn = $('tab-btn-soru');
  const onergeFields = $('kursu-onerge-fields');
  const soruFields = $('kursu-soru-fields');
  const submitBtn = $('btn-submit-kursu');
  const durationWrapper = $('input-kursu-duration')?.parentElement;

  onergeBtn?.classList.remove('bg-slate-800', 'text-white', 'shadow-md');
  onergeBtn?.classList.add('text-gray-500', 'bg-transparent');

  soruBtn?.classList.add('bg-slate-800', 'text-white', 'shadow-md');
  soruBtn?.classList.remove('text-gray-500', 'bg-transparent');

  onergeFields?.classList.add('hidden');
  soruFields?.classList.remove('hidden');

  if (durationWrapper) durationWrapper.classList.add('hidden');

  if (submitBtn) {
    submitBtn.textContent = 'SORUYU ORTAK AKLA GÖNDER';
  }
}

function setKursuProposalMode() {
  const onergeBtn = $('tab-btn-onerge');
  const soruBtn = $('tab-btn-soru');
  const onergeFields = $('kursu-onerge-fields');
  const soruFields = $('kursu-soru-fields');
  const submitBtn = $('btn-submit-kursu');
  const durationWrapper = $('input-kursu-duration')?.parentElement;

  soruBtn?.classList.remove('bg-slate-800', 'text-white', 'shadow-md');
  soruBtn?.classList.add('text-gray-500', 'bg-transparent');

  onergeBtn?.classList.add('bg-slate-800', 'text-white', 'shadow-md');
  onergeBtn?.classList.remove('text-gray-500', 'bg-transparent');

  soruFields?.classList.add('hidden');
  onergeFields?.classList.remove('hidden');

  if (durationWrapper) durationWrapper.classList.remove('hidden');

  if (submitBtn) {
    submitBtn.textContent = 'ÖNERGEYİ GÜNDEME GÖNDER';
  }
}

function openQuestionModal() {
  setKursuQuestionMode();
  openModal('ortak-kursu-modal');
}

// ------------------------------------------------------
// SORULARI GETİR
// ------------------------------------------------------

async function fetchQuestions(filter = 'bekleyen') {
  try {
    const data = await DB.sorulariGetir(filter);
    return Array.isArray(data) ? data : [];
  } catch (dbError) {
    console.warn('DB.sorulariGetir çalışmadı, direkt Supabase fallback deneniyor:', dbError);
  }

  const supabase = DB.supabase || window.ME26_SUPABASE;

  if (!supabase) {
    throw new Error('Supabase bağlantısı bulunamadı.');
  }

  const tableTries = ['me26_sorular', 'sorular'];
  const solved = filter === 'kutuphane' || filter === 'cozuldu';

  let lastError = null;

  for (const table of tableTries) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('cozuldu_mu', solved)
        .order('olusturulma_tarihi', { ascending: false });

      if (error) throw error;

      return Array.isArray(data) ? data : [];
    } catch (error) {
      lastError = error;
      console.warn(`Soru tablosu okunamadı: ${table}`, error);
    }
  }

  throw lastError || new Error('Sorular alınamadı.');
}

// ------------------------------------------------------
// RENDER
// ------------------------------------------------------

function renderQuestionCard(item = {}) {
  const id = item.id;
  const title = item.baslik || item.title || 'Başlıksız Soru';
  const content = item.icerik || item.content || item.aciklama || '';
  const author =
    item.yazar_dijital_id ||
    item.author_id ||
    item.yazar ||
    item.dijital_id ||
    'TR-IA-BEKLEYEN';

  const solved = Boolean(item.cozuldu_mu || item.solved);
  const answerCount =
    item.cevap_sayisi ||
    item.answer_count ||
    item.answers_count ||
    0;

  const createdAt =
    item.olusturulma_tarihi ||
    item.created_at ||
    item.tarih ||
    null;

  let dateText = '';

  if (createdAt) {
    try {
      dateText = new Date(createdAt).toLocaleDateString('tr-TR');
    } catch {
      dateText = '';
    }
  }

  return `
    <div class="bg-black/50 border border-slate-800 p-5 rounded-2xl shadow-lg" data-question-card="${escapeHtml(id)}">
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

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2 text-[10px] text-gray-500 font-black uppercase tracking-widest">
          <span>${Number(answerCount || 0).toLocaleString('tr-TR')} cevap</span>
          ${dateText ? `<span>· ${escapeHtml(dateText)}</span>` : ''}
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-id="${escapeHtml(id)}"
            class="btn-qa-cevapla bg-slate-800 border border-slate-600 hover:border-kaos hover:text-kaos text-white rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition"
          >
            Cevapla
          </button>

          ${!solved ? `
            <button
              type="button"
              data-id="${escapeHtml(id)}"
              class="btn-qa-cozuldu bg-slate-900 border border-slate-700 hover:border-green-500 hover:text-green-400 text-gray-300 rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition"
            >
              Kütüphaneye Taşı
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderQuestions(list = []) {
  const container = $('qa-listesi');

  if (!container) return;

  const items = Array.isArray(list) ? list : [];

  if (items.length === 0) {
    container.innerHTML =
      currentQaFilter === 'kutuphane'
        ? emptyState('Kütüphaneye taşınmış soru yok.')
        : emptyState('Henüz çözüm bekleyen soru yok.');

    return;
  }

  container.innerHTML = items.map(renderQuestionCard).join('');
}

// ------------------------------------------------------
// LİSTE YÜKLE
// ------------------------------------------------------

export async function loadQA(filter = currentQaFilter) {
  currentQaFilter = filter;

  const container = $('qa-listesi');

  if (container) {
    container.innerHTML = loadingState();
  }

  updateQaTabButtons();

  try {
    const questions = await fetchQuestions(filter);
    renderQuestions(questions);
  } catch (error) {
    console.error('QA listesi alınamadı:', error);

    if (container) {
      container.innerHTML = errorState('Söz Sende kayıtları alınamadı.');
    }

    showToast(error?.message || 'Söz Sende kayıtları alınamadı.', 'error');
  }
}

function updateQaTabButtons() {
  const bekleyenBtn = $('btn-qa-bekleyenler');
  const kutuphaneBtn = $('btn-qa-kutuphane');

  if (currentQaFilter === 'kutuphane') {
    bekleyenBtn?.classList.remove('bg-slate-800', 'text-white', 'border-slate-600');
    bekleyenBtn?.classList.add('bg-transparent', 'text-gray-500');

    kutuphaneBtn?.classList.add('bg-slate-800', 'text-white', 'border', 'border-slate-600');
    kutuphaneBtn?.classList.remove('bg-transparent', 'text-gray-500');

    return;
  }

  kutuphaneBtn?.classList.remove('bg-slate-800', 'text-white', 'border-slate-600');
  kutuphaneBtn?.classList.add('bg-transparent', 'text-gray-500');

  bekleyenBtn?.classList.add('bg-slate-800', 'text-white', 'border', 'border-slate-600');
  bekleyenBtn?.classList.remove('bg-transparent', 'text-gray-500');
}

// ------------------------------------------------------
// SORU GÖNDER
// ------------------------------------------------------

async function submitQuestion(event = null) {
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  const user = getCurrentUser();

  if (!user?.uid) {
    showToast('Soru göndermek için giriş yapmalısınız.', 'error');
    return;
  }

  const title = cleanText($('input-kursu-title')?.value);
  const content = cleanText($('input-kursu-content')?.value);
  const audience = cleanText($('input-kursu-audience')?.value, 'Herkes');
  const responsibility = $('input-kursu-responsibility')?.checked === true;

  if (!responsibility) {
    showToast('Sorumluluk beyanını onaylamalısınız.', 'error');
    return;
  }

  if (title.length < 15) {
    showToast('Başlık en az 15 karakter olmalıdır.', 'error');
    return;
  }

  if (content.length < 50) {
    showToast('Soru içeriği en az 50 karakter olmalıdır.', 'error');
    return;
  }

  const button = $('btn-submit-kursu');
  const oldText = setLoading(button, 'Soru gönderiliyor...');

  try {
    await DB.soruGonder({
      uid: user.uid,
      yazar_dijital_id: getDigitalId(user),
      baslik: title,
      icerik: content,
      hedef_kitle: audience
    });

    ['input-kursu-title', 'input-kursu-content'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });

    const responsibilityInput = $('input-kursu-responsibility');
    if (responsibilityInput) responsibilityInput.checked = false;

    closeModal('ortak-kursu-modal');

    showToast('Sorunuz ortak akla gönderildi.', 'success');

    currentQaFilter = 'bekleyen';
    await loadQA('bekleyen');
  } catch (error) {
    console.error('Soru gönderilemedi:', error);
    showToast(error?.message || 'Soru gönderilemedi.', 'error');
  } finally {
    restoreButton(button, oldText || 'SORUYU ORTAK AKLA GÖNDER');
  }
}

// ------------------------------------------------------
// CEVAP GÖNDER
// ------------------------------------------------------

async function answerQuestion(questionId) {
  const user = getCurrentUser();

  if (!user?.uid) {
    showToast('Cevap yazmak için giriş yapmalısınız.', 'error');
    return;
  }

  const answer = window.prompt('Cevabınızı yazın:');

  if (answer === null) return;

  const content = cleanText(answer);

  if (content.length < 20) {
    showToast('Cevap en az 20 karakter olmalıdır.', 'error');
    return;
  }

  try {
    await DB.cevapGonder({
      uid: user.uid,
      soru_id: questionId,
      icerik: content
    });

    await incrementAnswerCount(questionId);

    showToast('Cevabınız kaydedildi.', 'success');
    await loadQA(currentQaFilter);
  } catch (error) {
    console.error('Cevap gönderilemedi:', error);
    showToast(error?.message || 'Cevap gönderilemedi.', 'error');
  }
}

async function incrementAnswerCount(questionId) {
  const supabase = DB.supabase || window.ME26_SUPABASE;

  if (!supabase) return;

  const tableTries = ['me26_sorular', 'sorular'];

  for (const table of tableTries) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('cevap_sayisi')
        .eq('id', questionId)
        .maybeSingle();

      if (error) throw error;

      const current = Number(data?.cevap_sayisi || 0);

      await supabase
        .from(table)
        .update({ cevap_sayisi: current + 1 })
        .eq('id', questionId);

      return;
    } catch (error) {
      console.warn(`Cevap sayısı güncellenemedi: ${table}`, error);
    }
  }
}

// ------------------------------------------------------
// KÜTÜPHANEYE TAŞI
// ------------------------------------------------------

async function markQuestionSolved(questionId) {
  const supabase = DB.supabase || window.ME26_SUPABASE;

  if (!supabase) {
    showToast('Supabase bağlantısı bulunamadı.', 'error');
    return;
  }

  const ok = window.confirm('Bu soru kütüphaneye taşınsın mı?');

  if (!ok) return;

  const tableTries = ['me26_sorular', 'sorular'];

  let lastError = null;

  for (const table of tableTries) {
    try {
      const { error } = await supabase
        .from(table)
        .update({ cozuldu_mu: true })
        .eq('id', questionId);

      if (error) throw error;

      showToast('Soru kütüphaneye taşındı.', 'success');
      await loadQA(currentQaFilter);

      return;
    } catch (error) {
      lastError = error;
      console.warn(`Soru kütüphaneye taşınamadı: ${table}`, error);
    }
  }

  showToast(lastError?.message || 'Soru kütüphaneye taşınamadı.', 'error');
}

// ------------------------------------------------------
// EVENT BAĞLAMA
// ------------------------------------------------------

function bindQaEvents() {
  const openBtn = $('btn-open-qa-modal');

  if (openBtn && openBtn.dataset.me26QaOpenBound !== '1') {
    openBtn.dataset.me26QaOpenBound = '1';
    openBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openQuestionModal();
    }, true);
  }

  const soruTab = $('tab-btn-soru');

  if (soruTab && soruTab.dataset.me26QaTabBound !== '1') {
    soruTab.dataset.me26QaTabBound = '1';
    soruTab.addEventListener('click', () => {
      setKursuQuestionMode();
    });
  }

  const onergeTab = $('tab-btn-onerge');

  if (onergeTab && onergeTab.dataset.me26QaOnergeTabBound !== '1') {
    onergeTab.dataset.me26QaOnergeTabBound = '1';
    onergeTab.addEventListener('click', () => {
      setKursuProposalMode();
    });
  }

  const submitBtn = $('btn-submit-kursu');

  if (submitBtn && submitBtn.dataset.me26QaSubmitBound !== '1') {
    submitBtn.dataset.me26QaSubmitBound = '1';

    submitBtn.addEventListener('click', (event) => {
      if (!getQuestionMode()) return;
      submitQuestion(event);
    }, true);
  }

  const bekleyenBtn = $('btn-qa-bekleyenler');

  if (bekleyenBtn && bekleyenBtn.dataset.me26QaBekleyenBound !== '1') {
    bekleyenBtn.dataset.me26QaBekleyenBound = '1';
    bekleyenBtn.addEventListener('click', () => {
      loadQA('bekleyen');
    });
  }

  const kutuphaneBtn = $('btn-qa-kutuphane');

  if (kutuphaneBtn && kutuphaneBtn.dataset.me26QaKutuphaneBound !== '1') {
    kutuphaneBtn.dataset.me26QaKutuphaneBound = '1';
    kutuphaneBtn.addEventListener('click', () => {
      loadQA('kutuphane');
    });
  }

  document.body.addEventListener('click', (event) => {
    const answerBtn = event.target.closest('.btn-qa-cevapla');

    if (answerBtn) {
      event.preventDefault();
      const questionId = answerBtn.getAttribute('data-id');

      if (questionId) answerQuestion(questionId);
      return;
    }

    const solvedBtn = event.target.closest('.btn-qa-cozuldu');

    if (solvedBtn) {
      event.preventDefault();
      const questionId = solvedBtn.getAttribute('data-id');

      if (questionId) markQuestionSolved(questionId);
    }
  });
}

// ------------------------------------------------------
// BAŞLAT
// ------------------------------------------------------

export function initQA() {
  if (qaStarted) return;

  qaStarted = true;

  bindQaEvents();
  updateQaTabButtons();

  if ($('qa-listesi')) {
    loadQA('bekleyen');
  }

  console.info('ME26 qa.js temiz final sürüm yüklendi.');
}

// ------------------------------------------------------
// GLOBAL KÖPRÜLER
// ------------------------------------------------------

window.ME26_QA = {
  initQA,
  loadQA,
  openQuestionModal,
  submitQuestion,
  answerQuestion,
  markQuestionSolved
};

window.loadQA = loadQA;
window.sorulariYukle = loadQA;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQA);
} else {
  initQA();
}
