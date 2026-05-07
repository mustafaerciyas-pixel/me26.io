/* ==========================================================================
   ME26 AĞI - ANA MOTOR VE SAAS YÖNLENDİRİCİSİ (app.js)
   Canlı Production Uyumlu Sürüm

   Görev:
   - Google oturum yönlendirme
   - SaaS sekme ve buton bağlantıları
   - Önerge / soru gönderimi
   - Destekle butonu
   - Oy kullanma ve katılım sayısı
   - Tribün Ligi canlı verisi
   - İçmimar Koruma Hattı bildirimi
========================================================================== */

import { STATE } from './state.js';
import { UI } from './ui.js';
import { DB, supabase } from './supabase.js';
import { auth } from './config.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

import {
  googleIleGiris,
  sistemdenCikis,
  eDevletBelgesiOku,
  gercekSmsGonder,
  gercekSmsDogrula
} from './auth.js';

import { VIP } from './vip.js';
import { STADYUM } from './stadium.js';

// ------------------------------------------------------
// KISA YARDIMCILAR
// ------------------------------------------------------

const $ = (id) => document.getElementById(id);

const bind = (id, event, fn) => {
  const el = $(id);
  if (!el) return;
  el.addEventListener(event, fn);
};

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const safeValue = (id, fallback = '') => {
  const el = $(id);
  if (!el) return fallback;
  if (typeof el.value === 'undefined') return fallback;
  return el.value;
};

const safeTrimValue = (id, fallback = '') => {
  return cleanText(safeValue(id, fallback));
};

const safeChecked = (id) => {
  const el = $(id);
  return Boolean(el && el.checked === true);
};

const setButtonLoading = (btn, text = 'İŞLENİYOR...') => {
  if (!btn) return '';
  const oldText = btn.innerHTML;
  btn.innerHTML = text;
  btn.disabled = true;
  btn.classList.add('opacity-70', 'cursor-wait');
  return oldText;
};

const restoreButton = (btn, oldText = '') => {
  if (!btn) return;
  btn.innerHTML = oldText || btn.innerHTML;
  btn.disabled = false;
  btn.classList.remove('opacity-70', 'cursor-wait');
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getVotePowerNumber = (user) => {
  const raw = user?.votePower || user?.vote_power || user?.oy_gucu || '0';
  const parsed = parseFloat(String(raw).replace('x', ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const isValidPhoneNumber = (phoneValue) => {
  const digits = String(phoneValue || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

const isPdfFile = (file) => {
  if (!file) return false;

  const fileName = cleanText(file.name).toLowerCase();
  const fileType = cleanText(file.type).toLowerCase();

  return fileType === 'application/pdf' || fileName.endsWith('.pdf');
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

const createFallbackInviteCode = () => {
  try {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);

    return `ME26-TR-${randomArray[0]
      .toString(36)
      .toUpperCase()
      .slice(0, 6)}`;
  } catch {
    return `ME26-TR-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }
};

const getDigitalId = (user = {}) => {
  if (user.userNo && user.userNo !== 'BEKLEYEN') {
    return `TR-IA-${user.userNo}`;
  }

  if (user.user_no && user.user_no !== 'BEKLEYEN') {
    return `TR-IA-${user.user_no}`;
  }

  if (user.digitalId) return user.digitalId;
  if (user.digital_id) return user.digital_id;

  return 'TR-IA-BEKLEYEN';
};

const mapAuthStage = (dbUser = {}) => {
  const belgeDurumu = cleanText(dbUser.belge_durumu).toLowerCase();

  if (
    belgeDurumu.includes('onaylandı') ||
    belgeDurumu.includes('onaylandi') ||
    belgeDurumu.includes('approved')
  ) {
    return 'pdf_verified';
  }

  if (
    belgeDurumu.includes('bekliyor') ||
    belgeDurumu.includes('inceleme') ||
    belgeDurumu.includes('pending')
  ) {
    return 'document_pending';
  }

  if (dbUser.telefon || dbUser.hasPhone || dbUser.has_phone) {
    return 'phone_verified';
  }

  return 'registered';
};

const normalizeDbUserForState = (dbUser = {}) => {
  return {
    uid: dbUser.id || dbUser.uid,
    name: dbUser.isim || dbUser.g_isim || dbUser.name || 'İsimsiz',
    email: dbUser.email || dbUser.mail || null,
    photo: dbUser.foto || dbUser.photo || '',
    city: dbUser.sehir || dbUser.city || 'Belirsiz',
    role: dbUser.mesleki_durum || dbUser.m_durum || dbUser.role || 'Belirsiz',
    votePower: `${dbUser.oy_gucu || dbUser.vote_power || 0}x`,
    userNo: dbUser.vip_kurucu_no || dbUser.kurucu_no || dbUser.userNo || 'BEKLEYEN',
    davetKodu: dbUser.kendi_davet_kodu || dbUser.davetKodu || dbUser.d_kod || null,
    hasPhone: Boolean(dbUser.telefon || dbUser.hasPhone || dbUser.has_phone),
    authStage: mapAuthStage(dbUser),
    inviteCount: parseNumber(
      dbUser.davet_edilen_kisi_sayisi || dbUser.inviteCount || dbUser.invite_count,
      0
    ),
    isVip: Boolean(dbUser.is_vip || dbUser.isVip)
  };
};

const syncCityGate = () => {
  const user = STATE.getUser();
  const cityGate = $('ui-city-selector-container');
  const proposalsContainer = $('proposals-container');

  const needsCity =
    !user.city ||
    user.city === 'Belirsiz' ||
    user.city === 'Seçilmedi' ||
    user.city === 'TRİBÜN SEÇİLMEDİ';

  if (cityGate) cityGate.classList.toggle('hidden', !needsCity);

  if (proposalsContainer) {
    proposalsContainer.classList.remove('hidden');
  }
};

const clearFormFields = (ids = []) => {
  ids.forEach((id) => {
    const el = $(id);
    if (el && typeof el.value !== 'undefined') el.value = '';
  });
};

const getReadableError = (error, fallback = 'İşlem sırasında bir hata oluştu.') => {
  const message = cleanText(error?.message || error);

  const map = {
    already_voted: 'Bu önergeye zaten oy verdiniz. Sistem ikinci oyu engeller.',
    already_supported: 'Bu önergeyi zaten desteklediniz.',
    duplicate_record: 'Bu işlem daha önce yapılmış görünüyor.',
    missing_uid: 'Oturum kimliği bulunamadı. Lütfen tekrar giriş yapın.',
    missing_city: 'Lütfen bir şehir / tribün seçin.',
    missing_phone: 'Telefon numarası okunamadı.',
    missing_document_payload: 'Belge bilgisi okunamadı.',
    missing_document_name: 'Belge adı okunamadı.',
    missing_proposal_id: 'Önerge kimliği okunamadı.',
    missing_question_id: 'Soru kimliği okunamadı.',
    missing_problem: 'Sorun alanı boş bırakılamaz.',
    missing_solution: 'Çözüm alanı boş bırakılamaz.',
    missing_koruma_payload: 'Koruma Hattı bildirimi okunamadı.',
    missing_koruma_type: 'Bildirim türü seçilmelidir.',
    missing_koruma_target: 'Bildirilen kişi veya kurum yazılmalıdır.',
    koruma_description_too_short: 'Durum açıklaması en az 20 karakter olmalıdır.',
    title_too_short: 'Başlık en az 15 karakter olmalıdır.',
    title_too_long: 'Başlık 150 karakterden uzun olamaz.',
    problem_too_short: 'Sorun alanı en az 20 karakter olmalıdır.',
    solution_too_short: 'Çözüm alanı en az 20 karakter olmalıdır.',
    content_too_short: 'İçerik yeterince uzun değil.',
    content_too_long: 'İçerik çok uzun.',
    user_not_found: 'Kullanıcı kaydı bulunamadı.',
    proposal_not_found: 'Önerge bulunamadı.',
    invalid_vote_power: 'Oy gücü okunamadı. Profil yetkinizi kontrol edin.',
    invalid_vote_choice: 'Oy seçimi okunamadı.',
    invalid_vip_number: 'VIP numara geçersiz.',
    vip_number_taken: 'Bu VIP numara az önce başka biri tarafından alınmış.',
    not_enough_invites: 'VIP numara için gerekli gerçek davet sayısına henüz ulaşılmadı.',
    already_has_number: 'Bu hesap için kurucu numara zaten atanmış.'
  };

  return map[message] || message || fallback;
};

const setContainerLoading = (id, text = 'Yükleniyor...') => {
  const container = $(id);
  if (!container) return;

  container.innerHTML = `
    <div class="text-center py-10 border border-slate-800 rounded-2xl text-gray-500 text-xs font-bold uppercase tracking-widest bg-black/20">
      ${text}
    </div>
  `;
};

const calculateVoteStatsFromRows = (rows = []) => {
  const list = Array.isArray(rows) ? rows : [];

  let yes = 0;
  let no = 0;
  let abstain = 0;

  let yesPower = 0;
  let noPower = 0;
  let abstainPower = 0;

  list.forEach((row) => {
    const choice = cleanText(row.kullanilan_oy);
    const power = parseNumber(row.oy_gucu, 0);

    if (choice === 'yes') {
      yes += 1;
      yesPower += power;
    }

    if (choice === 'no') {
      no += 1;
      noPower += power;
    }

    if (choice === 'abstain') {
      abstain += 1;
      abstainPower += power;
    }
  });

  const total = yes + no + abstain;
  const totalPower = yesPower + noPower + abstainPower;

  return {
    evet_sayisi: yes,
    kabul_sayisi: yes,
    ret_sayisi: no,
    cekimser_sayisi: abstain,
    katilim_sayisi: total,
    toplam_oy: total,

    yes_count: yes,
    no_count: no,
    abstain_count: abstain,
    total_votes: total,

    yes_power: yesPower,
    no_power: noPower,
    abstain_power: abstainPower,
    total_power: totalPower
  };
};

const disableVoteButtonsAfterChoice = (container, choice) => {
  if (!container) return;

  container.querySelectorAll('.vote-btn').forEach((button) => {
    button.disabled = true;
    button.classList.add('opacity-30', 'cursor-not-allowed');
    button.classList.remove(
      'hover:border-green-500',
      'hover:border-yellow-500',
      'hover:border-red-500'
    );
  });

  const selectedButton = container.querySelector(`.vote-btn[data-vote="${choice}"]`);

  if (!selectedButton) return;

  selectedButton.classList.remove('opacity-30', 'bg-slate-800');

  if (choice === 'yes') {
    selectedButton.classList.add('bg-green-900/60', 'border-green-500', 'text-green-400');
  }

  if (choice === 'abstain') {
    selectedButton.classList.add('bg-yellow-900/60', 'border-yellow-500', 'text-yellow-400');
  }

  if (choice === 'no') {
    selectedButton.classList.add('bg-red-900/60', 'border-red-500', 'text-red-400');
  }
};

const userHasVoted = (votes = [], uid = '') => {
  return votes.some((vote) => cleanText(vote.user_id) === cleanText(uid));
};

const getUserVoteChoice = (votes = [], uid = '') => {
  const found = votes.find((vote) => cleanText(vote.user_id) === cleanText(uid));
  return found ? cleanText(found.kullanilan_oy) : null;
};

// ======================================================
// 1. EVRENSEL MECLİS KALEMİ - ŞİMDİLİK PASİF
// ======================================================

window.evrenselGeminiDuzelt = function () {
  UI.showToast(
    'Meclis Kalemi yakında aktif olacak. API bağlantısı güvenli backend üzerinden kurulacak.',
    'info'
  );
};

// ======================================================
// 2. KULLANICIYI VERİTABANINDAN YENİLE
// ======================================================

async function refreshCurrentUser(uid = null) {
  const currentUid = uid || STATE.getUser()?.uid || auth.currentUser?.uid;

  if (!currentUid) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', currentUid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  STATE.setUser(normalizeDbUserForState(data));

  return STATE.getUser();
}

async function ensureDbUser(firebaseUser) {
  if (!firebaseUser || !firebaseUser.uid) return null;

  let dbUser = null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', firebaseUser.uid)
    .maybeSingle();

  if (error) throw error;

  dbUser = data;

  if (!dbUser) {
    const created = await DB.sistemeGiris({
      uid: firebaseUser.uid,
      g_isim: firebaseUser.displayName || 'İsimsiz',
      mail: firebaseUser.email || null,
      foto: firebaseUser.photoURL || '',
      m_durum: 'Belirsiz',
      sehir: null,
      d_kod: createFallbackInviteCode(),
      ref: getRefFromUrl()
    });

    dbUser = created;
  }

  STATE.setUser(normalizeDbUserForState(dbUser));

  return STATE.getUser();
}

// ======================================================
// 3. ORTAK KÜRSÜ - ÖNERGE + SORU GÖNDERİMİ
// ======================================================

window.ortakKursuGonder = async function () {
  if (!UI.triggerVerificationGate()) return;

  const user = STATE.getUser();

  if (!user || !user.uid) {
    UI.showToast('Güvenlik hatası: Oturum kimliği doğrulanamadı.', 'error');
    return;
  }

  const mod = STATE.aktifKursuModu || 'onerge';

  const baslik = safeTrimValue('input-kursu-title');
  const hedefKitle = safeValue('input-kursu-audience', 'Herkes');
  const sorumlulukOnay = safeChecked('input-kursu-responsibility');

  if (!sorumlulukOnay) {
    UI.showToast('Sorumluluk beyanını onaylamanız gerekmektedir.', 'error');
    return;
  }

  if (baslik.length < 15 || baslik.length > 150) {
    UI.showToast('Başlık 15 ile 150 karakter arasında olmalıdır.', 'error');
    return;
  }

  const btn = $('btn-submit-kursu');
  const oldText = setButtonLoading(btn, 'İŞLENİYOR...');

  try {
    if (mod === 'onerge') {
      const sorun = safeTrimValue('input-kursu-problem');
      const cozum = safeTrimValue('input-kursu-solution');
      const sureRaw = safeValue('input-kursu-duration', '2');
      const sure = parseInteger(sureRaw, 2);

      if (sorun.length < 20) {
        throw new Error('problem_too_short');
      }

      if (cozum.length < 20) {
        throw new Error('solution_too_short');
      }

      await DB.onergeGonder(user.uid, baslik, sorun, cozum, hedefKitle, sure);

      UI.showToast('Önergeniz başarıyla meclise sunuldu.', 'success');

      clearFormFields([
        'input-kursu-title',
        'input-kursu-problem',
        'input-kursu-solution',
        'input-kursu-content'
      ]);

      const responsibility = $('input-kursu-responsibility');
      if (responsibility) responsibility.checked = false;

      UI.closeModal('ortak-kursu-modal');

      await Me26VotingSystem.loadProposals();

      UI.switchSaasTab('view-sandik');

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }

      return;
    }

    if (mod === 'soru') {
      const icerik = safeTrimValue('input-kursu-content');

      if (icerik.length < 50 || icerik.length > 3000) {
        throw new Error(
          icerik.length < 50 ? 'content_too_short' : 'content_too_long'
        );
      }

      const dijitalId = getDigitalId(user);

      if (typeof DB.soruGonder === 'function') {
        await DB.soruGonder(user.uid, dijitalId, baslik, icerik, hedefKitle);
      } else {
        const { error } = await supabase.from('me26_sorular').insert([
          {
            yazar_uid: user.uid,
            yazar_dijital_id: dijitalId,
            hedef_kitle: hedefKitle,
            baslik,
            icerik,
            cozuldu_mu: false,
            sikayet_sayisi: 0
          }
        ]);

        if (error) throw error;
      }

      UI.showToast('Sorunuz ortak akla başarıyla iletildi.', 'success');

      clearFormFields([
        'input-kursu-title',
        'input-kursu-problem',
        'input-kursu-solution',
        'input-kursu-content'
      ]);

      const responsibility = $('input-kursu-responsibility');
      if (responsibility) responsibility.checked = false;

      UI.closeModal('ortak-kursu-modal');

      if (typeof window.qaSorulariGetir === 'function') {
        window.qaSorulariGetir();
      }

      UI.switchSaasTab('view-kursu');

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }
    }
  } catch (error) {
    console.error('Ortak Kürsü gönderim hatası:', error);
    UI.showToast(getReadableError(error, 'Gönderim sırasında bir hata oluştu.'), 'error');
  } finally {
    restoreButton(btn, oldText || 'Gönder');
  }
};

// ======================================================
// 4. KİMLİK DOĞRULAMA KÖPRÜSÜ
// ======================================================

export const AUTH = {
  loginWithGoogle: async () => {
    try {
      const userData = await googleIleGiris();

      if (!userData) return;

      if (auth.currentUser?.uid) {
        await refreshCurrentUser(auth.currentUser.uid);
      } else {
        STATE.setUser(normalizeDbUserForState(userData));
      }

      UI.showView('saas');
      UI.switchSaasTab('view-lobi');
      UI.renderProfile();
      syncCityGate();

      await Me26VotingSystem.loadProposals();

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }
    } catch (error) {
      console.error('Google giriş yönlendirme hatası:', error);
      UI.showToast('Google giriş sonrası oturum bilgileri alınamadı.', 'error');
    }
  },

  logout: sistemdenCikis,

  resetPhoneModal: () => {
    const step1 = $('phone-step-1');
    const step2 = $('phone-step-2');
    const phoneInput = $('input-phone-number');
    const otpInput = $('input-otp-code');
    const btnPhone = $('btn-submit-phone');
    const btnOtp = $('btn-verify-otp');

    if (step1) {
      step1.style.display = 'block';
      step1.classList.remove('hidden');
    }

    if (step2) {
      step2.style.display = 'none';
      step2.classList.add('hidden');
    }

    if (phoneInput) phoneInput.value = '';
    if (otpInput) otpInput.value = '';

    if (btnPhone) {
      btnPhone.innerHTML = 'SMS GÖNDER';
      btnPhone.disabled = false;
      btnPhone.classList.remove('opacity-70', 'cursor-wait');
    }

    if (btnOtp) {
      btnOtp.innerHTML = 'KODU ONAYLA';
      btnOtp.disabled = false;
      btnOtp.classList.remove('opacity-70', 'cursor-wait');
    }
  },

  verifyPhone: async () => {
    const phoneValue = safeValue('input-phone-number', '');

    if (!isValidPhoneNumber(phoneValue)) {
      UI.showToast('Lütfen geçerli bir telefon numarası girin.', 'error');
      return;
    }

    const btn = $('btn-submit-phone');
    const oldText = setButtonLoading(btn, 'SMS GÖNDERİLİYOR...');

    try {
      await gercekSmsGonder(phoneValue);

      UI.showToast('Kod gönderildi. Lütfen ekrana girin.', 'success');

      const step1 = $('phone-step-1');
      const step2 = $('phone-step-2');

      if (step1) {
        step1.style.display = 'none';
        step1.classList.add('hidden');
      }

      if (step2) {
        step2.style.display = 'block';
        step2.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Telefon doğrulama gönderim hatası:', error);
      UI.showToast(error.message || 'SMS gönderilemedi. Lütfen tekrar deneyin.', 'error');
      restoreButton(btn, oldText || 'SMS GÖNDER');
    }
  },

  verifyOtp: async () => {
    const rawValue = safeValue('input-otp-code', '');
    const otpValue = String(rawValue).replace(/\s+/g, '');

    if (!otpValue || otpValue.length < 6) {
      UI.showToast('6 haneli kodu eksiksiz girin.', 'error');
      return;
    }

    const user = STATE.getUser();

    if (!user || !user.uid) {
      UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      return;
    }

    const phoneValue = safeValue('input-phone-number', '');

    if (!isValidPhoneNumber(phoneValue)) {
      UI.showToast('Telefon numarası okunamadı. Lütfen işlemi yeniden başlatın.', 'error');
      return;
    }

    const btn = $('btn-verify-otp');
    const oldText = setButtonLoading(btn, 'DOĞRULANIYOR...');

    try {
      await gercekSmsDogrula(otpValue, user.uid, phoneValue);

      try {
        await refreshCurrentUser(user.uid);
      } catch {
        STATE.setPhoneVerified();
      }

      UI.showToast('Telefon başarıyla onaylandı.', 'success');
      UI.closeModal('phone-modal');
      UI.renderProfile();
      syncCityGate();

      await Me26VotingSystem.loadProposals();
    } catch (error) {
      console.error('OTP doğrulama hatası:', error);
      UI.showToast(error.message || 'Hatalı kod girdiniz.', 'error');
      restoreButton(btn, oldText || 'KODU ONAYLA');
    }
  },

  verifyPdf: async () => {
    const fileInput = $('input-pdf-file');

    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      UI.showToast('Önce bir PDF belge seçin.', 'error');
      return;
    }

    const selectedFile = fileInput.files[0];

    if (!isPdfFile(selectedFile)) {
      UI.showToast('Lütfen yalnızca PDF formatında belge yükleyin.', 'error');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      UI.showToast('PDF dosyası 10 MB’dan küçük olmalıdır.', 'error');
      return;
    }

    const user = STATE.getUser();

    if (!user || !user.uid) {
      UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      return;
    }

    const btn = $('btn-submit-pdf');
    const isTerfi = user.authStage === 'pdf_verified';

    const oldText = setButtonLoading(
      btn,
      isTerfi ? 'UNVAN GÜNCELLENİYOR...' : 'İNCELEMEYE GÖNDERİLİYOR...'
    );

    try {
      await eDevletBelgesiOku(selectedFile, user.uid);

      try {
        await refreshCurrentUser(user.uid);
      } catch {
        STATE.setDocumentPending();
      }

      if (isTerfi) {
        UI.showToast(
          'Belgeniz incelemeye alındı. Onay sonrası unvanınız güncellenecektir.',
          'success'
        );
      } else {
        UI.showToast('Belge başvurunuz inceleme kuyruğuna alındı.', 'success');
      }

      UI.closeModal('pdf-modal');
      UI.renderProfile();
      syncCityGate();

      await Me26VotingSystem.loadProposals();

      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('PDF doğrulama hatası:', error);
      UI.showToast(error.message || 'Belge gönderilirken bir hata oluştu.', 'error');
      restoreButton(btn, oldText || 'BELGE İNCELEME BAŞVURUSU GÖNDER');
    }
  }
};

// ======================================================
// 5. OTONOM SANDIK - ÖNERGE / DESTEK / OY MOTORU
// ======================================================

export const Me26VotingSystem = {
  voteCache: new Map(),

  init: async function () {
    await this.loadProposals();
  },

  loadProposals: async function () {
    try {
      setContainerLoading('proposals-container', 'Önergeler yükleniyor...');
      setContainerLoading('gundem-container', 'Gündem yükleniyor...');

      const onergeler = await DB.onergeleriGetir();

      if (!Array.isArray(onergeler) || onergeler.length === 0) {
        this.voteCache.clear();
        UI.renderProposals([]);
        return [];
      }

      const enriched = await Promise.all(
        onergeler.map(async (onerge) => {
          try {
            const oylar = await DB.oySonuclariniGetir(onerge.id);
            const stats = calculateVoteStatsFromRows(oylar);

            this.voteCache.set(String(onerge.id), oylar || []);

            return {
              ...onerge,
              ...stats
            };
          } catch (error) {
            console.warn('Oy sonuçları alınamadı:', onerge.id, error);
            this.voteCache.set(String(onerge.id), []);

            return {
              ...onerge,
              ...calculateVoteStatsFromRows([])
            };
          }
        })
      );

      UI.renderProposals(enriched);

      this.markCurrentUserVotes();

      return enriched;
    } catch (error) {
      console.error('Önergeler yüklenemedi:', error);
      UI.showToast('Önergeler yüklenemedi. Lütfen sayfayı yenileyin.', 'error');

      UI.renderProposals([]);

      return [];
    }
  },

  markCurrentUserVotes: function () {
    const user = STATE.getUser();

    if (!user || !user.uid) return;

    this.voteCache.forEach((votes, onergeId) => {
      if (!userHasVoted(votes, user.uid)) return;

      const choice = getUserVoteChoice(votes, user.uid);
      const container = document
        .querySelector(`[data-onerge-card="${onergeId}"]`)
        ?.querySelector('.vote-buttons-container');

      if (container && choice) {
        disableVoteButtonsAfterChoice(container, choice);
      }
    });
  },

  handleVote: async function (btnEl) {
    if (!STATE.isLoggedIn()) {
      UI.showToast('Oy kullanmak için giriş yapmalısınız.', 'error');
      return;
    }

    const user = STATE.getUser();

    if (!user || !user.uid) {
      UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      return;
    }

    if (!user.hasPhone) {
      UI.showToast(
        'Oy kullanmadan önce Profil sekmesinden telefonunuzu onaylatmalısınız.',
        'error'
      );
      UI.switchSaasTab('view-profil');
      return;
    }

    if (user.authStage !== 'pdf_verified') {
      UI.showToast(
        'Oy kullanabilmek için mesleki belge başvurunuzun onaylanmış olması gerekir.',
        'error'
      );
      UI.switchSaasTab('view-profil');
      return;
    }

    const container = btnEl.closest('.vote-buttons-container');

    if (!container) {
      UI.showToast('Oylama alanı bulunamadı.', 'error');
      return;
    }

    const userRole = cleanText(user.role).toLowerCase();
    const requiredAuth = cleanText(container.getAttribute('data-auth'));

    if (
      requiredAuth === 'icmimar' &&
      !userRole.includes('içmimar') &&
      !userRole.includes('icmimar') &&
      !userRole.includes('mezun') &&
      !userRole.includes('mimar')
    ) {
      UI.showToast('Bu sandığı sadece İçmimarlık Mezunları oylayabilir.', 'error');
      return;
    }

    if (
      requiredAuth === 'ogrenci' &&
      !userRole.includes('öğrenci') &&
      !userRole.includes('ogrenci') &&
      !userRole.includes('student')
    ) {
      UI.showToast('Bu sandık sadece İçmimarlık Öğrencileri içindir.', 'error');
      return;
    }

    const currentPower = getVotePowerNumber(user);

    if (currentPower <= 0) {
      UI.showToast(
        'Profil panelinden mesleki belgenizi yükleyip tam erişim almalısınız.',
        'error'
      );
      UI.switchSaasTab('view-profil');
      return;
    }

    const onergeId =
      btnEl.getAttribute('data-onerge-id') ||
      btnEl.getAttribute('data-id') ||
      btnEl.closest('[data-onerge-card]')?.getAttribute('data-onerge-card');

    const choice = btnEl.getAttribute('data-vote');

    if (!onergeId || !choice) {
      UI.showToast('Oylama kimliği okunamadı.', 'error');
      return;
    }

    const cachedVotes = this.voteCache.get(String(onergeId)) || [];

    if (userHasVoted(cachedVotes, user.uid)) {
      const oldChoice = getUserVoteChoice(cachedVotes, user.uid);
      disableVoteButtonsAfterChoice(container, oldChoice);

      UI.showToast('Bu önergeye zaten oy verdiniz. Sistem ikinci oyu engeller.', 'info');
      return;
    }

    const originalHtml = btnEl.innerHTML;
    setButtonLoading(btnEl, '...');

    try {
      await DB.oyKullan(user.uid, onergeId, choice, currentPower);

      const updatedVotes = await DB.oySonuclariniGetir(onergeId);
      const stats = calculateVoteStatsFromRows(updatedVotes);

      this.voteCache.set(String(onergeId), updatedVotes || []);

      if (typeof UI.updateVoteCardStats === 'function') {
        UI.updateVoteCardStats(onergeId, stats);
      }

      btnEl.innerHTML = originalHtml;

      disableVoteButtonsAfterChoice(container, choice);

      UI.showToast('Oyunuz başarıyla mühürlendi.', 'success');

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }
    } catch (error) {
      console.error('Oy gönderim hatası:', error);

      btnEl.innerHTML = originalHtml;
      btnEl.disabled = false;
      btnEl.classList.remove('opacity-70', 'cursor-wait');

      if (
        error.message === 'already_voted' ||
        error.message === 'duplicate_record'
      ) {
        UI.showToast('Bu önergeye zaten oy verdiniz. Sistem ikinci oyu engeller.', 'info');
        disableVoteButtonsAfterChoice(container, choice);
        return;
      }

      UI.showToast(getReadableError(error, 'Oy gönderilirken bir hata oluştu.'), 'error');
    }
  }
};

// ======================================================
// 6. DESTEKLE MOTORU
// ======================================================

async function handleDestekle(destekBtn) {
  if (!STATE.isLoggedIn()) {
    UI.showToast('Destek vermek için giriş yapmalısınız.', 'error');
    return;
  }

  const user = STATE.getUser();

  if (!user || !user.uid) {
    UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
    return;
  }

  if (!user.hasPhone || user.authStage !== 'pdf_verified') {
    UI.showToast(
      'Önergeyi destekleyebilmek için Profil sekmesinden telefon ve mesleki belge onaylarınızı tamamlamalısınız.',
      'error'
    );
    UI.switchSaasTab('view-profil');
    return;
  }

  const onergeId =
    destekBtn.getAttribute('data-onerge-id') ||
    destekBtn.getAttribute('data-id') ||
    destekBtn.closest('[data-onerge-card]')?.getAttribute('data-onerge-card');

  if (!onergeId) {
    UI.showToast('Önerge kimliği okunamadı.', 'error');
    return;
  }

  const originalText = destekBtn.innerHTML;
  setButtonLoading(destekBtn, '...');

  try {
    await DB.destekVer(user.uid, onergeId);

    UI.showToast('Önergeye destek verdiniz.', 'success');

    await Me26VotingSystem.loadProposals();

    if (typeof window.loadTribunLigiData === 'function') {
      window.loadTribunLigiData();
    }
  } catch (error) {
    console.error('Destek verme hatası:', error);

    if (
      error.message === 'already_supported' ||
      error.message === 'duplicate_record'
    ) {
      destekBtn.innerHTML = 'DESTEKLENDİ';
      destekBtn.disabled = true;
      destekBtn.classList.remove('bg-slate-800', 'border-slate-600');
      destekBtn.classList.add('bg-green-900/50', 'text-green-400', 'border-green-500');

      UI.showToast('Bu önergeyi zaten desteklediniz.', 'info');
      return;
    }

    restoreButton(destekBtn, originalText || 'Destekle');

    UI.showToast(
      getReadableError(error, 'Destek gönderilirken bir hata oluştu.'),
      'error'
    );
  }
}

// ======================================================
// 7. TRİBÜN LİGİ
// ======================================================

async function loadTribunLigiData() {
  try {
    if (typeof DB.tribunLigiGetir !== 'function') return;

    const realCityData = await DB.tribunLigiGetir();

    if (typeof UI.renderTribunLigi === 'function') {
      UI.renderTribunLigi(realCityData || []);
    } else if (typeof UI.renderLeague === 'function') {
      UI.renderLeague(realCityData || []);
    }
  } catch (error) {
    console.error('Tribün Ligi canlı verileri çekilemedi:', error);
  }
}

window.loadTribunLigiData = loadTribunLigiData;

// ======================================================
// 8. İÇMİMAR KORUMA HATTI
// ======================================================

function getKorumaSubmitButton() {
  return $('btn-submit-koruma');
}

function resetKorumaForm() {
  clearFormFields([
    'input-koruma-kisi',
    'input-koruma-link',
    'input-koruma-aciklama',
    'input-koruma-ad',
    'input-koruma-iletisim'
  ]);

  const anonim = $('input-koruma-anonim');
  const kvkk = $('input-koruma-kvkk');

  if (anonim) anonim.checked = false;
  if (kvkk) kvkk.checked = false;
}

function getKorumaPayload() {
  const user = STATE.getUser();

  const tur = safeValue('input-koruma-turu', '');
  const kisiKurum = safeTrimValue('input-koruma-kisi');
  const link = safeTrimValue('input-koruma-link');
  const aciklama = safeTrimValue('input-koruma-aciklama');
  const adSoyad = safeTrimValue('input-koruma-ad');
  const iletisim = safeTrimValue('input-koruma-iletisim');
  const anonimMi = safeChecked('input-koruma-anonim');
  const kvkkOnay = safeChecked('input-koruma-kvkk');

  if (!kisiKurum) {
    throw new Error('missing_koruma_target');
  }

  if (!aciklama || aciklama.length < 20) {
    throw new Error('koruma_description_too_short');
  }

  if (!kvkkOnay) {
    throw new Error(
      'Bu bildirimde sunduğunuz bilgi ve belgelerin doğru olduğunu onaylamalısınız.'
    );
  }

  return {
    bildiren_uid: STATE.isLoggedIn() ? getDigitalId(user) : 'TR-IA-ZİYARETÇİ',
    bildirim_turu: tur || 'Diğer',
    sikayet_edilen: kisiKurum,
    baglanti: link || null,
    aciklama,
    ad_soyad: anonimMi ? null : adSoyad || null,
    iletisim: anonimMi ? null : iletisim || null,
    anonim_mi: anonimMi
  };
}

async function handleKorumaSubmit() {
  const btn = getKorumaSubmitButton();

  if (!btn) return;

  const oldText = setButtonLoading(btn, 'ŞİFRELENİYOR...');

  try {
    const payload = getKorumaPayload();

    if (typeof DB.korumaBildir === 'function') {
      await DB.korumaBildir(payload);
    } else {
      const { error } = await supabase.from('me26_koruma_hatti').insert([payload]);
      if (error) throw error;
    }

    UI.showToast('Bildiriminiz güvenli ağa iletildi.', 'success');

    resetKorumaForm();

    const formArea = $('koruma-form-alan');
    if (formArea) formArea.classList.add('hidden');
  } catch (error) {
    console.error('Koruma Hattı gönderim hatası:', error);
    UI.showToast(
      getReadableError(error, 'Bildirim iletilemedi. Lütfen bağlantınızı kontrol edin.'),
      'error'
    );
  } finally {
    restoreButton(btn, oldText || 'BİLDİRİMİ GÜVENLİ AĞA İLET');
  }
}

function bindKorumaListeners() {
  const btn = getKorumaSubmitButton();

  if (btn) {
    const clone = btn.cloneNode(true);

    clone.removeAttribute('onclick');
    clone.addEventListener('click', (event) => {
      event.preventDefault();
      handleKorumaSubmit();
    });

    btn.replaceWith(clone);
  }

  [
    'btn-open-koruma-form',
    'btn-koruma-form-ac',
    'btn-koruma-bildirim-olustur'
  ].forEach((id) => {
    bind(id, 'click', () => {
      const formArea = $('koruma-form-alan');
      if (formArea) formArea.classList.remove('hidden');
    });
  });
}

window.korumaBildir = handleKorumaSubmit;

// ======================================================
// 9. STATİK BUTON DİNLEYİCİLERİ
// ======================================================

function bindStaticListeners() {
  [
    'btn-register-hero',
    'btn-register-nav',
    'btn-login-hero',
    'btn-login-nav'
  ].forEach((id) => {
    bind(id, 'click', AUTH.loginWithGoogle);
  });

  document.querySelectorAll('.nav-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const targetId = event.currentTarget.getAttribute('data-target');

      if (!targetId) return;

      UI.switchSaasTab(targetId);

      if (targetId === 'view-tribun' && typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }

      if (targetId === 'view-sandik') {
        Me26VotingSystem.loadProposals();
      }

      if (targetId === 'view-kursu' && typeof window.qaSorulariGetir === 'function') {
        window.qaSorulariGetir();
      }

      if (window.innerWidth < 768) {
        document.querySelectorAll('.nav-menu-btn i').forEach((icon) => {
          icon.classList.remove('text-kaos');
        });

        event.currentTarget.querySelector('i')?.classList.add('text-kaos');
      }
    });
  });

  bind('btn-save-profile-city', 'click', async () => {
    const selectedCity = safeValue('input-profile-city', '');

    if (!selectedCity) {
      UI.showToast('Tribün seçimi yapmalısınız.', 'error');
      return;
    }

    const user = STATE.getUser();

    if (!user || !user.uid) {
      UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      return;
    }

    const btn = $('btn-save-profile-city');
    const oldText = setButtonLoading(btn, 'KAYDEDİLİYOR...');

    try {
      await DB.sehirGuncelle(user.uid, selectedCity);

      try {
        await refreshCurrentUser(user.uid);
      } catch {
        STATE.setCity(selectedCity);
      }

      UI.renderProfile();
      syncCityGate();

      UI.showToast(`Harika. ${selectedCity} tribününe katıldın.`, 'success');

      await Me26VotingSystem.loadProposals();

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }
    } catch (error) {
      console.error('Şehir kaydetme hatası:', error);
      UI.showToast(getReadableError(error, 'Şehir kaydedilemedi.'), 'error');
    } finally {
      restoreButton(btn, oldText || 'KAYDET');
    }
  });

  bind('btn-standart-numara', 'click', async () => {
    const user = STATE.getUser();

    if (!user || !user.uid) {
      UI.showToast('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
      return;
    }

    if (
      user.userNo &&
      user.userNo !== 'BEKLEYEN' &&
      !confirm('Bu hesapta zaten numara görünüyor. Yine de devam edilsin mi?')
    ) {
      return;
    }

    if (!confirm('Sıradaki boş numarayı otomatik almak istediğine emin misin?')) {
      return;
    }

    const btn = $('btn-standart-numara');
    const oldText = setButtonLoading(btn, 'NUMARA ALINIYOR...');

    try {
      const yeniNo = await DB.standartNumaraAl(user.uid);

      try {
        await refreshCurrentUser(user.uid);
      } catch {
        STATE.setStandardNumber(yeniNo);
      }

      UI.renderProfile();

      UI.showToast(`Numaran atandı: TR-IA-${yeniNo}`, 'success');
    } catch (error) {
      console.error('Standart numara alma hatası:', error);
      UI.showToast(getReadableError(error, 'Numara alınamadı.'), 'error');
    } finally {
      restoreButton(btn, oldText || 'Sıradan Numarayı Al');
    }
  });

  bind('btn-open-proposal-modal', 'click', () => {
    UI.openKursuModal();
    UI.switchKursuTab('onerge');
  });

  bind('btn-open-qa-modal', 'click', () => {
    UI.openKursuModal();
    UI.switchKursuTab('soru');
  });

  bind('btn-close-kursu-modal', 'click', () => UI.closeModal('ortak-kursu-modal'));

  bind('tab-btn-onerge', 'click', () => UI.switchKursuTab('onerge'));
  bind('tab-btn-soru', 'click', () => UI.switchKursuTab('soru'));

  bind('btn-submit-kursu', 'click', window.ortakKursuGonder);

  bind('btn-open-phone-modal', 'click', () => {
    AUTH.resetPhoneModal();
    UI.openModal('phone-modal');
  });

  bind('btn-close-phone-modal', 'click', () => UI.closeModal('phone-modal'));

  bind('btn-open-pdf-modal', 'click', () => UI.openModal('pdf-modal'));
  bind('btn-close-pdf-modal', 'click', () => UI.closeModal('pdf-modal'));
  bind('btn-submit-pdf', 'click', AUTH.verifyPdf);

  bind('btn-open-vip-modal', 'click', () => {
    UI.openModal('vip-modal');

    if (VIP && typeof VIP.updateModalState === 'function') {
      VIP.updateModalState();
    }
  });

  bind('btn-close-vip-modal', 'click', () => UI.closeModal('vip-modal'));

  bind('btn-claim-vip-number', 'click', async () => {
    if (VIP && typeof VIP.claimNumber === 'function') {
      await VIP.claimNumber();

      const user = STATE.getUser();

      if (user?.uid) {
        try {
          await refreshCurrentUser(user.uid);
          UI.renderProfile();
        } catch {}
      }
    }
  });

  bind('btn-whatsapp-share', 'click', () => {
    if (VIP && typeof VIP.handleShare === 'function') {
      VIP.handleShare(true);
    }
  });

  bind('btn-copy-invite', 'click', () => {
    if (VIP && typeof VIP.handleShare === 'function') {
      VIP.handleShare(false);
    } else if (typeof UI.copyInviteLink === 'function') {
      UI.copyInviteLink();
    }
  });

  bind('btn-logout', 'click', AUTH.logout);

  bindKorumaListeners();
}

// ======================================================
// 10. DİNAMİK BUTON DİNLEYİCİLERİ
// ======================================================

function bindDynamicListeners() {
  document.body.addEventListener('click', (event) => {
    const target = event.target;
    const clickedEl = target instanceof Element ? target : null;

    if (!clickedEl) return;

    const phoneSubmitBtn = clickedEl.closest('#btn-submit-phone');
    const otpSubmitBtn = clickedEl.closest('#btn-verify-otp');
    const voteBtn = clickedEl.closest('.vote-btn');
    const destekBtn = clickedEl.closest('.btn-destekle');

    if (phoneSubmitBtn) {
      event.preventDefault();
      AUTH.verifyPhone();
      return;
    }

    if (otpSubmitBtn) {
      event.preventDefault();
      AUTH.verifyOtp();
      return;
    }

    if (voteBtn) {
      event.preventDefault();
      Me26VotingSystem.handleVote(voteBtn);
      return;
    }

    if (destekBtn) {
      event.preventDefault();
      handleDestekle(destekBtn);
    }
  });
}

// ======================================================
// 11. OTURUM ROUTER'I
// ======================================================

function authRouterKur() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      STATE.clearSession();
      UI.showView('landing');
      return;
    }

    try {
      await ensureDbUser(firebaseUser);

      UI.showView('saas');
      UI.switchSaasTab('view-lobi');
      UI.renderProfile();
      syncCityGate();

      await Me26VotingSystem.loadProposals();

      if (typeof window.qaSorulariGetir === 'function') {
        window.qaSorulariGetir();
      }

      if (typeof window.loadTribunLigiData === 'function') {
        window.loadTribunLigiData();
      }

      if (STADYUM && typeof STADYUM.baslat === 'function') {
        STADYUM.baslat();
      }
    } catch (error) {
      console.error('Oturum yönlendirme hatası:', error);

      UI.showToast(
        'Oturum bilgileri alınamadı. Lütfen sayfayı yenileyin.',
        'error'
      );
    }
  });
}

// ======================================================
// 12. GLOBAL ERİŞİMLER
// ======================================================

window.AUTH = AUTH;
window.Me26VotingSystem = Me26VotingSystem;

window.onergeleriGetir = async () => {
  return await Me26VotingSystem.loadProposals();
};

window.destekVer = async (button) => {
  if (button instanceof Element) {
    await handleDestekle(button);
  }
};

window.oyKullan = async (button) => {
  if (button instanceof Element) {
    await Me26VotingSystem.handleVote(button);
  }
};

// ======================================================
// 13. BAŞLATMA
// ======================================================

let me26AppStarted = false;

function santiyeyiBaslat() {
  if (me26AppStarted) return;

  me26AppStarted = true;

  bindStaticListeners();
  bindDynamicListeners();
  authRouterKur();

  try {
    Me26VotingSystem.init();
  } catch (error) {
    console.error('Sandık motoru başlatılamadı:', error);
  }

  try {
    loadTribunLigiData();
  } catch (error) {
    console.error('Tribün motoru başlatılamadı:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', santiyeyiBaslat);
} else {
  santiyeyiBaslat();
}
