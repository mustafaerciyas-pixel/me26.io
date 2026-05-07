/* ==========================================================================
   ME26 AĞI - ÇELİK KAPI MOTORU (auth.js)
   Temiz Final Sürüm

   Görev:
   - Google giriş / çıkış yardımcıları
   - Telefon doğrulama
   - Ülke kodu seçimi
   - Ülkeye göre telefon digit sınırı
   - Firebase invisible reCAPTCHA
   - PDF belge inceleme kuyruğu
   - app.js ile uyumlu window.ME26_AUTH köprüsü

   Kritik:
   - Importlar sadece dosyanın en üstündedir.
   - Dosyanın ortasında import yoktur.
   - Service role key yoktur.
========================================================================== */

import { STATE } from './state.js';
import { auth } from './config.js';
import { DB } from './supabase.js';

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  RecaptchaVerifier,
  linkWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// ------------------------------------------------------
// GLOBAL DURUM
// ------------------------------------------------------

let confirmationResult = null;
let recaptchaVerifier = null;
let googleLoginInProgress = false;
let lastFormattedPhone = null;

const SMS_LIMIT_KEY = 'me26_sms_limits';
const DEFAULT_COUNTRY_CODE = 'TR';

// ------------------------------------------------------
// ÜLKE TELEFON KURALLARI
// min/max: ülke kodu hariç ulusal numara digit sayısıdır.
// trunkPrefix: kullanıcı başta 0 / 8 / 1 yazarsa kırpılabilir.
// mobileStarts: varsa ilk digit/prefix kontrol edilir.
// ------------------------------------------------------

const PHONE_COUNTRIES = [
  {
    code: 'TR',
    flag: '🇹🇷',
    name: 'Türkiye',
    dial: '+90',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    mobileStarts: ['5'],
    placeholder: '5XXXXXXXXX',
    help: 'Türkiye için 5 ile başlayan 10 haneli GSM numarası girin.'
  },
  {
    code: 'CY',
    flag: '🇨🇾',
    name: 'Kıbrıs',
    dial: '+357',
    min: 8,
    max: 8,
    placeholder: 'XXXXXXXX',
    help: 'Kıbrıs için 8 haneli telefon numarası girin.'
  },
  {
    code: 'US',
    flag: '🇺🇸',
    name: 'ABD',
    dial: '+1',
    min: 10,
    max: 10,
    trunkPrefix: '1',
    placeholder: 'XXXXXXXXXX',
    help: 'ABD için alan kodu dahil 10 haneli numara girin.'
  },
  {
    code: 'CA',
    flag: '🇨🇦',
    name: 'Kanada',
    dial: '+1',
    min: 10,
    max: 10,
    trunkPrefix: '1',
    placeholder: 'XXXXXXXXXX',
    help: 'Kanada için alan kodu dahil 10 haneli numara girin.'
  },
  {
    code: 'GB',
    flag: '🇬🇧',
    name: 'Birleşik Krallık',
    dial: '+44',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '7XXXXXXXXX',
    help: 'Birleşik Krallık için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'DE',
    flag: '🇩🇪',
    name: 'Almanya',
    dial: '+49',
    min: 10,
    max: 11,
    trunkPrefix: '0',
    placeholder: '1XXXXXXXXX',
    help: 'Almanya için baştaki 0 olmadan 10-11 haneli numara girin.'
  },
  {
    code: 'FR',
    flag: '🇫🇷',
    name: 'Fransa',
    dial: '+33',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXX',
    help: 'Fransa için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'NL',
    flag: '🇳🇱',
    name: 'Hollanda',
    dial: '+31',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXX',
    help: 'Hollanda için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'BE',
    flag: '🇧🇪',
    name: 'Belçika',
    dial: '+32',
    min: 8,
    max: 9,
    trunkPrefix: '0',
    placeholder: '4XXXXXXXX',
    help: 'Belçika için baştaki 0 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'AT',
    flag: '🇦🇹',
    name: 'Avusturya',
    dial: '+43',
    min: 10,
    max: 13,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXXX',
    help: 'Avusturya için baştaki 0 olmadan 10-13 haneli numara girin.'
  },
  {
    code: 'CH',
    flag: '🇨🇭',
    name: 'İsviçre',
    dial: '+41',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '7XXXXXXXX',
    help: 'İsviçre için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'IT',
    flag: '🇮🇹',
    name: 'İtalya',
    dial: '+39',
    min: 9,
    max: 10,
    placeholder: '3XXXXXXXXX',
    help: 'İtalya için 9-10 haneli numara girin.'
  },
  {
    code: 'ES',
    flag: '🇪🇸',
    name: 'İspanya',
    dial: '+34',
    min: 9,
    max: 9,
    placeholder: '6XXXXXXXX',
    help: 'İspanya için 9 haneli numara girin.'
  },
  {
    code: 'PT',
    flag: '🇵🇹',
    name: 'Portekiz',
    dial: '+351',
    min: 9,
    max: 9,
    placeholder: '9XXXXXXXX',
    help: 'Portekiz için 9 haneli numara girin.'
  },
  {
    code: 'GR',
    flag: '🇬🇷',
    name: 'Yunanistan',
    dial: '+30',
    min: 10,
    max: 10,
    placeholder: '69XXXXXXXX',
    help: 'Yunanistan için 10 haneli numara girin.'
  },
  {
    code: 'BG',
    flag: '🇧🇬',
    name: 'Bulgaristan',
    dial: '+359',
    min: 8,
    max: 9,
    trunkPrefix: '0',
    placeholder: '8XXXXXXXX',
    help: 'Bulgaristan için baştaki 0 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'RO',
    flag: '🇷🇴',
    name: 'Romanya',
    dial: '+40',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '7XXXXXXXX',
    help: 'Romanya için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'RS',
    flag: '🇷🇸',
    name: 'Sırbistan',
    dial: '+381',
    min: 8,
    max: 9,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXX',
    help: 'Sırbistan için baştaki 0 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'BA',
    flag: '🇧🇦',
    name: 'Bosna Hersek',
    dial: '+387',
    min: 8,
    max: 8,
    trunkPrefix: '0',
    placeholder: '6XXXXXXX',
    help: 'Bosna Hersek için baştaki 0 olmadan 8 haneli numara girin.'
  },
  {
    code: 'MK',
    flag: '🇲🇰',
    name: 'Kuzey Makedonya',
    dial: '+389',
    min: 8,
    max: 8,
    trunkPrefix: '0',
    placeholder: '7XXXXXXX',
    help: 'Kuzey Makedonya için baştaki 0 olmadan 8 haneli numara girin.'
  },
  {
    code: 'AL',
    flag: '🇦🇱',
    name: 'Arnavutluk',
    dial: '+355',
    min: 8,
    max: 9,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXX',
    help: 'Arnavutluk için baştaki 0 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'ME',
    flag: '🇲🇪',
    name: 'Karadağ',
    dial: '+382',
    min: 8,
    max: 8,
    trunkPrefix: '0',
    placeholder: '6XXXXXXX',
    help: 'Karadağ için baştaki 0 olmadan 8 haneli numara girin.'
  },
  {
    code: 'HR',
    flag: '🇭🇷',
    name: 'Hırvatistan',
    dial: '+385',
    min: 8,
    max: 9,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXX',
    help: 'Hırvatistan için baştaki 0 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'SI',
    flag: '🇸🇮',
    name: 'Slovenya',
    dial: '+386',
    min: 8,
    max: 8,
    trunkPrefix: '0',
    placeholder: '3XXXXXXX',
    help: 'Slovenya için baştaki 0 olmadan 8 haneli numara girin.'
  },
  {
    code: 'HU',
    flag: '🇭🇺',
    name: 'Macaristan',
    dial: '+36',
    min: 8,
    max: 9,
    trunkPrefix: '06',
    placeholder: '20XXXXXXX',
    help: 'Macaristan için baştaki 06 olmadan 8-9 haneli numara girin.'
  },
  {
    code: 'PL',
    flag: '🇵🇱',
    name: 'Polonya',
    dial: '+48',
    min: 9,
    max: 9,
    placeholder: 'XXXXXXXXX',
    help: 'Polonya için 9 haneli numara girin.'
  },
  {
    code: 'CZ',
    flag: '🇨🇿',
    name: 'Çekya',
    dial: '+420',
    min: 9,
    max: 9,
    placeholder: 'XXXXXXXXX',
    help: 'Çekya için 9 haneli numara girin.'
  },
  {
    code: 'SK',
    flag: '🇸🇰',
    name: 'Slovakya',
    dial: '+421',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXX',
    help: 'Slovakya için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'UA',
    flag: '🇺🇦',
    name: 'Ukrayna',
    dial: '+380',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: 'XXXXXXXXX',
    help: 'Ukrayna için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'RU',
    flag: '🇷🇺',
    name: 'Rusya',
    dial: '+7',
    min: 10,
    max: 10,
    trunkPrefix: '8',
    placeholder: '9XXXXXXXXX',
    help: 'Rusya için baştaki 8 olmadan 10 haneli numara girin.'
  },
  {
    code: 'AZ',
    flag: '🇦🇿',
    name: 'Azerbaycan',
    dial: '+994',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '50XXXXXXX',
    help: 'Azerbaycan için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'GE',
    flag: '🇬🇪',
    name: 'Gürcistan',
    dial: '+995',
    min: 9,
    max: 9,
    placeholder: '5XXXXXXXX',
    help: 'Gürcistan için 9 haneli numara girin.'
  },
  {
    code: 'AM',
    flag: '🇦🇲',
    name: 'Ermenistan',
    dial: '+374',
    min: 8,
    max: 8,
    trunkPrefix: '0',
    placeholder: '9XXXXXXX',
    help: 'Ermenistan için baştaki 0 olmadan 8 haneli numara girin.'
  },
  {
    code: 'IR',
    flag: '🇮🇷',
    name: 'İran',
    dial: '+98',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXXX',
    help: 'İran için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'IQ',
    flag: '🇮🇶',
    name: 'Irak',
    dial: '+964',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '7XXXXXXXXX',
    help: 'Irak için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'SA',
    flag: '🇸🇦',
    name: 'Suudi Arabistan',
    dial: '+966',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '5XXXXXXXX',
    help: 'Suudi Arabistan için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'AE',
    flag: '🇦🇪',
    name: 'Birleşik Arap Emirlikleri',
    dial: '+971',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '5XXXXXXXX',
    help: 'BAE için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'QA',
    flag: '🇶🇦',
    name: 'Katar',
    dial: '+974',
    min: 8,
    max: 8,
    placeholder: 'XXXXXXXX',
    help: 'Katar için 8 haneli numara girin.'
  },
  {
    code: 'KW',
    flag: '🇰🇼',
    name: 'Kuveyt',
    dial: '+965',
    min: 8,
    max: 8,
    placeholder: 'XXXXXXXX',
    help: 'Kuveyt için 8 haneli numara girin.'
  },
  {
    code: 'EG',
    flag: '🇪🇬',
    name: 'Mısır',
    dial: '+20',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '1XXXXXXXXX',
    help: 'Mısır için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'MA',
    flag: '🇲🇦',
    name: 'Fas',
    dial: '+212',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '6XXXXXXXX',
    help: 'Fas için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'ZA',
    flag: '🇿🇦',
    name: 'Güney Afrika',
    dial: '+27',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '7XXXXXXXX',
    help: 'Güney Afrika için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'IN',
    flag: '🇮🇳',
    name: 'Hindistan',
    dial: '+91',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXXX',
    help: 'Hindistan için 10 haneli numara girin.'
  },
  {
    code: 'PK',
    flag: '🇵🇰',
    name: 'Pakistan',
    dial: '+92',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '3XXXXXXXXX',
    help: 'Pakistan için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'CN',
    flag: '🇨🇳',
    name: 'Çin',
    dial: '+86',
    min: 11,
    max: 11,
    placeholder: '1XXXXXXXXXX',
    help: 'Çin için 11 haneli numara girin.'
  },
  {
    code: 'JP',
    flag: '🇯🇵',
    name: 'Japonya',
    dial: '+81',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '90XXXXXXXX',
    help: 'Japonya için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'KR',
    flag: '🇰🇷',
    name: 'Güney Kore',
    dial: '+82',
    min: 9,
    max: 10,
    trunkPrefix: '0',
    placeholder: '10XXXXXXXX',
    help: 'Güney Kore için baştaki 0 olmadan 9-10 haneli numara girin.'
  },
  {
    code: 'SG',
    flag: '🇸🇬',
    name: 'Singapur',
    dial: '+65',
    min: 8,
    max: 8,
    placeholder: 'XXXXXXXX',
    help: 'Singapur için 8 haneli numara girin.'
  },
  {
    code: 'MY',
    flag: '🇲🇾',
    name: 'Malezya',
    dial: '+60',
    min: 9,
    max: 10,
    trunkPrefix: '0',
    placeholder: '1XXXXXXXX',
    help: 'Malezya için baştaki 0 olmadan 9-10 haneli numara girin.'
  },
  {
    code: 'ID',
    flag: '🇮🇩',
    name: 'Endonezya',
    dial: '+62',
    min: 9,
    max: 12,
    trunkPrefix: '0',
    placeholder: '8XXXXXXXXX',
    help: 'Endonezya için baştaki 0 olmadan 9-12 haneli numara girin.'
  },
  {
    code: 'TH',
    flag: '🇹🇭',
    name: 'Tayland',
    dial: '+66',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '8XXXXXXXX',
    help: 'Tayland için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'VN',
    flag: '🇻🇳',
    name: 'Vietnam',
    dial: '+84',
    min: 9,
    max: 10,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXX',
    help: 'Vietnam için baştaki 0 olmadan 9-10 haneli numara girin.'
  },
  {
    code: 'PH',
    flag: '🇵🇭',
    name: 'Filipinler',
    dial: '+63',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXXX',
    help: 'Filipinler için baştaki 0 olmadan 10 haneli numara girin.'
  },
  {
    code: 'AU',
    flag: '🇦🇺',
    name: 'Avustralya',
    dial: '+61',
    min: 9,
    max: 9,
    trunkPrefix: '0',
    placeholder: '4XXXXXXXX',
    help: 'Avustralya için baştaki 0 olmadan 9 haneli numara girin.'
  },
  {
    code: 'NZ',
    flag: '🇳🇿',
    name: 'Yeni Zelanda',
    dial: '+64',
    min: 8,
    max: 10,
    trunkPrefix: '0',
    placeholder: '2XXXXXXXX',
    help: 'Yeni Zelanda için baştaki 0 olmadan 8-10 haneli numara girin.'
  },
  {
    code: 'BR',
    flag: '🇧🇷',
    name: 'Brezilya',
    dial: '+55',
    min: 10,
    max: 11,
    trunkPrefix: '0',
    placeholder: '119XXXXXXXX',
    help: 'Brezilya için alan kodu dahil 10-11 haneli numara girin.'
  },
  {
    code: 'AR',
    flag: '🇦🇷',
    name: 'Arjantin',
    dial: '+54',
    min: 10,
    max: 10,
    trunkPrefix: '0',
    placeholder: '9XXXXXXXXX',
    help: 'Arjantin için 10 haneli numara girin.'
  },
  {
    code: 'CL',
    flag: '🇨🇱',
    name: 'Şili',
    dial: '+56',
    min: 9,
    max: 9,
    placeholder: '9XXXXXXXX',
    help: 'Şili için 9 haneli numara girin.'
  },
  {
    code: 'CO',
    flag: '🇨🇴',
    name: 'Kolombiya',
    dial: '+57',
    min: 10,
    max: 10,
    placeholder: '3XXXXXXXXX',
    help: 'Kolombiya için 10 haneli numara girin.'
  },
  {
    code: 'MX',
    flag: '🇲🇽',
    name: 'Meksika',
    dial: '+52',
    min: 10,
    max: 10,
    placeholder: 'XXXXXXXXXX',
    help: 'Meksika için 10 haneli numara girin.'
  }
];

// ------------------------------------------------------
// YARDIMCILAR
// ------------------------------------------------------

const $ = (id) => document.getElementById(id);

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const onlyDigits = (value) => {
  return cleanText(value).replace(/\D/g, '');
};

const safeStorageGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn('LocalStorage yazılamadı:', error);
  }
};

const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};

const showToast = (message, type = 'info') => {
  if (window.UI && typeof window.UI.showToast === 'function') {
    window.UI.showToast(message, type);
    return;
  }

  const container = $('toast-container');

  if (!container) {
    console.log(`[ME26 ${type}]`, message);
    return;
  }

  const toast = document.createElement('div');

  const variants = {
    success: 'bg-green-900/90 text-green-300 border-green-700',
    info: 'bg-blue-900/90 text-blue-300 border-blue-700',
    warning: 'bg-yellow-900/90 text-yellow-300 border-yellow-700',
    error: 'bg-red-900/90 text-red-300 border-red-700'
  };

  toast.className =
    'pointer-events-auto px-4 py-3 rounded-xl border shadow-lg text-xs font-bold uppercase tracking-widest max-w-sm ' +
    (variants[type] || variants.info);

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
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

const getCountryByCode = (countryCode = DEFAULT_COUNTRY_CODE) => {
  const code = cleanText(countryCode, DEFAULT_COUNTRY_CODE).toUpperCase();
  return PHONE_COUNTRIES.find((country) => country.code === code) || PHONE_COUNTRIES[0];
};

const getSelectedPhoneCountry = () => {
  const select = $('input-phone-country');
  return getCountryByCode(select?.value || DEFAULT_COUNTRY_CODE);
};

const stripDialAndTrunk = (rawPhone, country) => {
  let digits = onlyDigits(rawPhone);
  const dialDigits = onlyDigits(country.dial);

  if (dialDigits && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  if (country.trunkPrefix) {
    const trunkDigits = onlyDigits(country.trunkPrefix);

    if (trunkDigits && digits.startsWith(trunkDigits) && digits.length > country.min) {
      digits = digits.slice(trunkDigits.length);
    }
  }

  return digits;
};

export function normalizeInternationalPhone(phoneNumber, countryCode = null) {
  const country = getCountryByCode(countryCode || getSelectedPhoneCountry().code);
  const digits = stripDialAndTrunk(phoneNumber, country);

  if (digits.length < country.min || digits.length > country.max) {
    const expected =
      country.min === country.max
        ? `${country.min} haneli`
        : `${country.min}-${country.max} haneli`;

    throw new Error(`${country.name} için ülke kodu hariç ${expected} telefon numarası girin.`);
  }

  if (Array.isArray(country.mobileStarts) && country.mobileStarts.length > 0) {
    const isValidStart = country.mobileStarts.some((prefix) => digits.startsWith(prefix));

    if (!isValidStart) {
      throw new Error(`${country.name} için telefon numarası ${country.mobileStarts.join(' veya ')} ile başlamalıdır.`);
    }
  }

  return `${country.dial}${digits}`;
}

const isPdfFile = (file) => {
  if (!file) return false;

  const fileName = cleanText(file.name).toLowerCase();
  const fileType = cleanText(file.type).toLowerCase();

  return fileType === 'application/pdf' || fileName.endsWith('.pdf');
};

const getFirebaseErrorMessage = (error) => {
  const code = cleanText(error?.code);
  const message = cleanText(error?.message);

  const map = {
    'auth/popup-closed-by-user': 'Google giriş penceresi kapatıldı.',
    'auth/cancelled-popup-request': 'Aynı anda iki giriş isteği oluştu. Lütfen tekrar deneyin.',
    'auth/popup-blocked': 'Tarayıcı Google giriş penceresini engelledi. Popup izni verin.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.',
    'auth/unauthorized-domain': 'Bu domain Firebase Authentication içinde yetkilendirilmemiş.',
    'auth/invalid-api-key': 'Firebase API key geçersiz görünüyor.',
    'auth/invalid-phone-number': 'Telefon numarası geçersiz.',
    'auth/captcha-check-failed': 'Güvenlik doğrulaması başarısız oldu. Sayfayı yenileyin.',
    'auth/provider-already-linked': 'Bu hesapta telefon doğrulaması zaten yapılmış görünüyor.',
    'auth/credential-already-in-use': 'Bu telefon numarası başka bir hesaba bağlı görünüyor.',
    'auth/invalid-verification-code': 'Girdiğiniz doğrulama kodu hatalı.',
    'auth/code-expired': 'Doğrulama kodunun süresi dolmuş. Yeniden SMS isteyin.'
  };

  return map[code] || message || 'İşlem sırasında beklenmeyen bir hata oluştu.';
};

// ------------------------------------------------------
// TELEFON ÜLKE MENÜSÜ
// ------------------------------------------------------

function ensurePhoneCountrySelect() {
  const phoneInput = $('input-phone-number');

  if (!phoneInput) return null;

  let select = $('input-phone-country');

  if (!select) {
    const wrapper = document.createElement('div');
    wrapper.id = 'phone-country-wrapper';
    wrapper.className = 'grid grid-cols-1 gap-2 mb-3';

    const label = document.createElement('label');
    label.className = 'text-[10px] text-gray-500 font-black uppercase tracking-widest';
    label.textContent = 'Ülke Kodu';

    select = document.createElement('select');
    select.id = 'input-phone-country';
    select.className =
      'w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-kaos';

    PHONE_COUNTRIES.forEach((country) => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${country.flag} ${country.name} (${country.dial})`;
      select.appendChild(option);
    });

    select.value = DEFAULT_COUNTRY_CODE;

    wrapper.appendChild(label);
    wrapper.appendChild(select);

    phoneInput.parentNode.insertBefore(wrapper, phoneInput);
  }

  let help = $('phone-country-help');

  if (!help) {
    help = document.createElement('p');
    help.id = 'phone-country-help';
    help.className = 'text-[10px] text-gray-500 leading-relaxed mb-3 -mt-1';
    phoneInput.insertAdjacentElement('afterend', help);
  }

  phoneInput.setAttribute('inputmode', 'numeric');
  phoneInput.setAttribute('autocomplete', 'tel-national');

  const sync = () => {
    const country = getSelectedPhoneCountry();

    phoneInput.placeholder = country.placeholder || '';
    phoneInput.maxLength = country.max;

    const cleanDigits = stripDialAndTrunk(phoneInput.value, country).slice(0, country.max);
    phoneInput.value = cleanDigits;

    help.textContent = `${country.dial} · ${country.help}`;
  };

  if (select.dataset.me26CountryBound !== '1') {
    select.dataset.me26CountryBound = '1';
    select.addEventListener('change', sync);
  }

  if (phoneInput.dataset.me26PhoneMaskBound !== '1') {
    phoneInput.dataset.me26PhoneMaskBound = '1';

    phoneInput.addEventListener('input', () => {
      const country = getSelectedPhoneCountry();
      phoneInput.value = stripDialAndTrunk(phoneInput.value, country).slice(0, country.max);
    });
  }

  sync();

  return select;
}

export function telefonuUlkeMenusuHazirla() {
  return ensurePhoneCountrySelect();
}

// ------------------------------------------------------
// GOOGLE GİRİŞ / ÇIKIŞ
// ------------------------------------------------------

export async function googleIleGiris() {
  if (googleLoginInProgress) {
    console.warn('Google giriş isteği zaten devam ediyor.');
    return null;
  }

  googleLoginInProgress = true;

  try {
    const provider = new GoogleAuthProvider();

    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;

    if (!firebaseUser || !firebaseUser.uid) {
      throw new Error('Google hesabı doğrulanamadı.');
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

    const data = await DB.sistemeGiris(payload);

    if (STATE && typeof STATE.setUser === 'function') {
      STATE.setUser(data);
    }

    return data;
  } catch (error) {
    console.error('Google giriş hatası:', error);
    showToast(getFirebaseErrorMessage(error), 'error');
    return null;
  } finally {
    googleLoginInProgress = false;
  }
}

export async function sistemdenCikis() {
  try {
    await signOut(auth);

    if (STATE && typeof STATE.clearSession === 'function') {
      STATE.clearSession();
    }

    safeStorageRemove(SMS_LIMIT_KEY);
    window.location.reload();
  } catch (error) {
    console.error('Çıkış yapılırken hata oluştu:', error);
    showToast('Çıkış yapılırken hata oluştu.', 'error');
  }
}

// ------------------------------------------------------
// SMS LİMİT
// ------------------------------------------------------

function readSmsLimits() {
  const raw = safeStorageGet(SMS_LIMIT_KEY);

  if (!raw) {
    return {
      count: 0,
      date: new Date().toDateString(),
      lastAttempt: 0
    };
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      count: Number(parsed.count) || 0,
      date: parsed.date || new Date().toDateString(),
      lastAttempt: Number(parsed.lastAttempt) || 0
    };
  } catch {
    return {
      count: 0,
      date: new Date().toDateString(),
      lastAttempt: 0
    };
  }
}

function checkSmsLimits() {
  let limits = readSmsLimits();
  const today = new Date().toDateString();

  if (limits.date !== today) {
    limits = {
      count: 0,
      date: today,
      lastAttempt: 0
    };
  }

  const now = Date.now();
  const secondsSinceLastAttempt = Math.floor((now - limits.lastAttempt) / 1000);

  if (limits.count >= 5) {
    throw new Error('Günlük SMS gönderme limitinizi doldurdunuz. Lütfen yarın tekrar deneyin.');
  }

  if (limits.lastAttempt > 0 && secondsSinceLastAttempt < 60) {
    throw new Error(`Lütfen yeni SMS istemeden önce ${60 - secondsSinceLastAttempt} saniye bekleyin.`);
  }

  return limits;
}

function updateSmsLimits(limits) {
  const nextLimits = {
    count: Number(limits.count || 0) + 1,
    date: limits.date || new Date().toDateString(),
    lastAttempt: Date.now()
  };

  safeStorageSet(SMS_LIMIT_KEY, JSON.stringify(nextLimits));
}

// ------------------------------------------------------
// RECAPTCHA
// ------------------------------------------------------

function ensureRecaptchaContainer() {
  let container = $('recaptcha-container');

  if (!container) {
    container = document.createElement('div');
    container.id = 'recaptcha-container';
    container.style.display = 'none';
    document.body.appendChild(container);
  }

  return container;
}

function clearRecaptcha() {
  if (!recaptchaVerifier) return;

  try {
    recaptchaVerifier.clear();
  } catch (error) {
    console.warn('reCAPTCHA temizlenemedi:', error);
  }

  recaptchaVerifier = null;
}

async function createInvisibleRecaptcha() {
  clearRecaptcha();
  ensureRecaptchaContainer();

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    {
      size: 'invisible',
      callback: () => {
        console.info('reCAPTCHA doğrulandı.');
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA süresi doldu.');
        clearRecaptcha();
      }
    }
  );

  try {
    await recaptchaVerifier.render();
  } catch (error) {
    console.warn('reCAPTCHA render uyarısı:', error);
  }

  return recaptchaVerifier;
}

// ------------------------------------------------------
// SMS GÖNDER / DOĞRULA
// ------------------------------------------------------

export async function gercekSmsGonder(phoneNumber, countryCode = null) {
  try {
    ensurePhoneCountrySelect();

    if (!auth.currentUser) {
      throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }

    const selectedCountry = getCountryByCode(countryCode || getSelectedPhoneCountry().code);
    const formattedPhone = normalizeInternationalPhone(phoneNumber, selectedCountry.code);
    const limits = checkSmsLimits();
    const verifier = await createInvisibleRecaptcha();

    confirmationResult = await linkWithPhoneNumber(
      auth.currentUser,
      formattedPhone,
      verifier
    );

    lastFormattedPhone = formattedPhone;
    updateSmsLimits(limits);

    return {
      ok: true,
      phone: formattedPhone,
      country: selectedCountry.code
    };
  } catch (error) {
    console.error('SMS gönderme hatası:', error);
    clearRecaptcha();

    throw new Error(getFirebaseErrorMessage(error));
  }
}

export async function gercekSmsDogrula(code, uid, phoneValue, countryCode = null) {
  try {
    const cleanCode = cleanText(code).replace(/\s+/g, '');
    const cleanUid = cleanText(uid);

    if (!confirmationResult) {
      throw new Error('Önce SMS gönderilmelidir.');
    }

    if (!cleanUid) {
      throw new Error('Oturum kimliği bulunamadı.');
    }

    if (!cleanCode || cleanCode.length < 6) {
      throw new Error('Lütfen 6 haneli doğrulama kodunu girin.');
    }

    const formattedPhone =
      lastFormattedPhone ||
      normalizeInternationalPhone(phoneValue, countryCode);

    await confirmationResult.confirm(cleanCode);
    await DB.telefonuOnayla(cleanUid, formattedPhone);

    if (STATE && typeof STATE.setPhoneVerified === 'function') {
      STATE.setPhoneVerified(formattedPhone);
    }

    confirmationResult = null;
    lastFormattedPhone = null;
    clearRecaptcha();

    return true;
  } catch (error) {
    console.error('SMS doğrulama hatası:', error);
    throw new Error(getFirebaseErrorMessage(error));
  }
}

// ------------------------------------------------------
// PDF BELGE İNCELEME
// ------------------------------------------------------

export async function eDevletBelgesiOku(file, userUid) {
  const cleanUid = cleanText(userUid);

  if (!cleanUid) {
    throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
  }

  if (!file) {
    throw new Error('Lütfen incelenmesi için bir PDF dosyası seçin.');
  }

  if (!isPdfFile(file)) {
    throw new Error('Sadece PDF formatında mesleki belge yükleyebilirsiniz.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('PDF dosyası 10 MB altında olmalıdır.');
  }

  try {
    const belgeData = {
      dosya_adi: cleanText(file.name).slice(0, 180),
      tur: cleanText(file.type) || 'application/pdf',
      belge_durumu: 'Onay Bekliyor'
    };

    await DB.belgeyiSirayaAl(cleanUid, belgeData);

    if (STATE && typeof STATE.setDocumentPending === 'function') {
      STATE.setDocumentPending();
    }

    return true;
  } catch (error) {
    console.error('Belge inceleme kuyruğu hatası:', error);
    throw new Error('Belge inceleme kuyruğuna alınamadı. Lütfen tekrar deneyin.');
  }
}

// ------------------------------------------------------
// MODAL AKIŞI
// ------------------------------------------------------

function showPhoneStep(step) {
  const step1 = $('phone-step-1');
  const step2 = $('phone-step-2');

  if (step === 2) {
    if (step1) {
      step1.style.display = 'none';
      step1.classList.add('hidden');
    }

    if (step2) {
      step2.style.display = 'block';
      step2.classList.remove('hidden');
    }

    return;
  }

  if (step1) {
    step1.style.display = 'block';
    step1.classList.remove('hidden');
  }

  if (step2) {
    step2.style.display = 'none';
    step2.classList.add('hidden');
  }
}

async function handlePhoneSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const button = $('btn-submit-phone');
  const input = $('input-phone-number');

  if (!input) {
    showToast('Telefon alanı bulunamadı.', 'error');
    return;
  }

  const oldText = button ? button.textContent : '';

  if (button) {
    button.disabled = true;
    button.textContent = 'SMS GÖNDERİLİYOR...';
  }

  try {
    const result = await gercekSmsGonder(input.value);

    showToast(`${result.phone} numarasına doğrulama kodu gönderildi.`, 'success');
    showPhoneStep(2);
  } catch (error) {
    showToast(error?.message || 'SMS gönderilemedi.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || 'SMS Gönder';
    }
  }
}

async function handleOtpSubmit(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const button = $('btn-verify-otp');
  const codeInput = $('input-otp-code');
  const phoneInput = $('input-phone-number');

  const userUid =
    auth.currentUser?.uid ||
    STATE?.getUser?.()?.uid ||
    STATE?.user?.uid ||
    null;

  const oldText = button ? button.textContent : '';

  if (button) {
    button.disabled = true;
    button.textContent = 'DOĞRULANIYOR...';
  }

  try {
    await gercekSmsDogrula(codeInput?.value || '', userUid, phoneInput?.value || '');

    showToast('Telefon doğrulaması tamamlandı.', 'success');

    const modal = $('phone-modal');

    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    showPhoneStep(1);
  } catch (error) {
    showToast(error?.message || 'Telefon doğrulanamadı.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || 'Kodu Onayla';
    }
  }
}

function bindPhoneUi() {
  ensurePhoneCountrySelect();

  const sendButton = $('btn-submit-phone');
  const verifyButton = $('btn-verify-otp');

  if (sendButton && sendButton.dataset.me26AuthPhoneBound !== '1') {
    sendButton.dataset.me26AuthPhoneBound = '1';
    sendButton.addEventListener('click', handlePhoneSubmit, true);
  }

  if (verifyButton && verifyButton.dataset.me26AuthOtpBound !== '1') {
    verifyButton.dataset.me26AuthOtpBound = '1';
    verifyButton.addEventListener('click', handleOtpSubmit, true);
  }
}

// ------------------------------------------------------
// BAŞLAT
// ------------------------------------------------------

function initAuthUi() {
  bindPhoneUi();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthUi);
} else {
  initAuthUi();
}

const phoneUiObserver = new MutationObserver(() => {
  if ($('input-phone-number')) {
    bindPhoneUi();
  }
});

phoneUiObserver.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// ------------------------------------------------------
// GLOBAL KÖPRÜ
// ------------------------------------------------------

window.ME26_AUTH = {
  googleIleGiris,
  sistemdenCikis,

  gercekSmsGonder,
  gercekSmsDogrula,

  eDevletBelgesiOku,

  telefonuUlkeMenusuHazirla,
  normalizeInternationalPhone,
  getSelectedPhoneCountry,
  PHONE_COUNTRIES
};

console.info('ME26 auth.js temiz final sürüm yüklendi.');
