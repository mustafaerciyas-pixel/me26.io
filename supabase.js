/* ==========================================================================
   ME26 AĞI - SUPABASE KÖPRÜSÜ (supabase.js)
   Temiz Final Sürüm

   Görev:
   - Supabase client
   - Kullanıcı kayıt / giriş RPC
   - Telefon onayı
   - Belge inceleme kuyruğu
   - Şehir güncelleme
   - Önerge / destek / oy
   - Soru / cevap
   - Koruma hattı
   - Tribün ligi
========================================================================== */

import { ME26_CONFIG } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ------------------------------------------------------
// SUPABASE CLIENT
// ------------------------------------------------------

export const supabase = createClient(
  ME26_CONFIG.supabaseUrl,
  ME26_CONFIG.supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

// ------------------------------------------------------
// YARDIMCILAR
// ------------------------------------------------------

const cleanText = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const normalizeErrorMessage = (error) => {
  if (!error) return 'Bilinmeyen Supabase hatası.';

  const message =
    error.message ||
    error.details ||
    error.hint ||
    error.code ||
    String(error);

  return cleanText(message, 'Bilinmeyen Supabase hatası.');
};

async function callRpc(functionName, params = {}) {
  const { data, error } = await supabase.rpc(functionName, params);

  if (error) {
    throw error;
  }

  return data;
}

async function tryRpcList(rpcCalls = []) {
  let lastError = null;

  for (const call of rpcCalls) {
    try {
      return await callRpc(call.name, call.params || {});
    } catch (error) {
      lastError = error;
      console.warn(`RPC çalışmadı: ${call.name}`, error);
    }
  }

  throw lastError || new Error('RPC çağrısı tamamlanamadı.');
}

async function maybeSingle(table, column, value) {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function insertIntoFirstAvailableTable(tableNames = [], payload = {}) {
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
      console.warn(`Insert başarısız: ${table}`, error);
    }
  }

  throw lastError || new Error('Kayıt oluşturulamadı.');
}

async function updateFirstAvailable(tableNames = [], match = {}, updates = {}) {
  let lastError = null;

  for (const table of tableNames) {
    try {
      let query = supabase.from(table).update(updates).select();

      Object.entries(match).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`Update başarısız: ${table}`, error);
    }
  }

  throw lastError || new Error('Güncelleme yapılamadı.');
}

// ------------------------------------------------------
// KULLANICI
// ------------------------------------------------------

export async function sistemeGiris(payload = {}) {
  if (!isObject(payload)) {
    throw new Error('missing_user_payload');
  }

  const uid = cleanText(payload.uid);

  if (!uid) {
    throw new Error('missing_uid');
  }

  try {
    return await callRpc('me26_sistem_giris', {
      p_payload: payload
    });
  } catch (rpcError) {
    console.warn('me26_sistem_giris RPC çalışmadı, users fallback deneniyor:', rpcError);
  }

  const existingUser = await kullaniciGetir(uid);

  if (existingUser) {
    return mevcutKullaniciGuncelle(uid, {
      g_isim: payload.g_isim || payload.isim || payload.name || 'İsimsiz',
      mail: payload.mail || payload.email || null,
      foto: payload.foto || payload.photo || null
    });
  }

  const userPayload = {
    id: uid,
    g_isim: payload.g_isim || payload.isim || payload.name || 'İsimsiz',
    mail: payload.mail || payload.email || null,
    foto: payload.foto || payload.photo || null,
    m_durum: payload.m_durum || payload.role || 'Belirsiz',
    sehir: payload.sehir || payload.city || null,
    d_kod: payload.d_kod || payload.davet_kodu || `ME26-${uid.slice(0, 8).toUpperCase()}`,
    ref: payload.ref || null,
    belge_durumu: 'Bekliyor',
    oy_gucu: 0,
    is_vip: false,
    davet_edilen_kisi_sayisi: 0
  };

  const { data, error } = await supabase
    .from('users')
    .insert([userPayload])
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function kullaniciGetir(uid) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) {
    throw new Error('missing_uid');
  }

  return maybeSingle('users', 'id', cleanUid);
}

export async function mevcutKullaniciGuncelle(uid, updates = {}) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) {
    throw new Error('missing_uid');
  }

  const safeUpdates = {};

  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value !== undefined) safeUpdates[key] = value;
  });

  if (Object.keys(safeUpdates).length === 0) {
    return kullaniciGetir(cleanUid);
  }

  const { data, error } = await supabase
    .from('users')
    .update(safeUpdates)
    .eq('id', cleanUid)
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function sehirGuncelle(uid, sehir) {
  const cleanUid = cleanText(uid);
  const cleanCity = cleanText(sehir);

  if (!cleanUid) throw new Error('missing_uid');
  if (!cleanCity) throw new Error('missing_city');

  try {
    return await tryRpcList([
      {
        name: 'me26_sehir_guncelle',
        params: {
          p_uid: cleanUid,
          p_sehir: cleanCity
        }
      },
      {
        name: 'me26_kullanici_sehir_guncelle',
        params: {
          p_uid: cleanUid,
          p_sehir: cleanCity
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Şehir RPC çalışmadı, users update fallback deneniyor:', rpcError);
  }

  return mevcutKullaniciGuncelle(cleanUid, {
    sehir: cleanCity
  });
}

// ------------------------------------------------------
// TELEFON
// ------------------------------------------------------

export async function telefonuOnayla(uid, phone) {
  const cleanUid = cleanText(uid);
  const cleanPhone = cleanText(phone);

  if (!cleanUid) throw new Error('missing_uid');
  if (!cleanPhone) throw new Error('missing_phone');

  try {
    return await tryRpcList([
      {
        name: 'me26_telefonu_onayla',
        params: {
          p_uid: cleanUid,
          p_telefon: cleanPhone
        }
      },
      {
        name: 'me26_telefon_onayla',
        params: {
          p_uid: cleanUid,
          p_telefon: cleanPhone
        }
      },
      {
        name: 'me26_telefon_onay',
        params: {
          p_uid: cleanUid,
          p_phone: cleanPhone
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Telefon RPC çalışmadı, users update fallback deneniyor:', rpcError);
  }

  const updateTries = [
    { telefon: cleanPhone, telefon_onayli: true },
    { telefon: cleanPhone, has_phone: true },
    { phone: cleanPhone, hasPhone: true },
    { telefon: cleanPhone }
  ];

  let lastError = null;

  for (const updates of updateTries) {
    try {
      return await mevcutKullaniciGuncelle(cleanUid, updates);
    } catch (error) {
      lastError = error;
      console.warn('Telefon update fallback başarısız:', updates, error);
    }
  }

  throw lastError || new Error('Telefon onayı kaydedilemedi.');
}

// ------------------------------------------------------
// BELGE
// ------------------------------------------------------

export async function belgeyiSirayaAl(uid, belgeData = {}) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) throw new Error('missing_uid');

  const belge = {
    dosya_adi: belgeData.dosya_adi || belgeData.fileName || belgeData.name || 'belge.pdf',
    tur: belgeData.tur || belgeData.type || 'application/pdf',
    belge_durumu: belgeData.belge_durumu || 'Onay Bekliyor',
    yuklenme_tarihi: new Date().toISOString()
  };

  try {
    return await tryRpcList([
      {
        name: 'me26_belge_yukle',
        params: {
          p_uid: cleanUid,
          p_belge: belge
        }
      },
      {
        name: 'me26_belgeyi_siraya_al',
        params: {
          p_uid: cleanUid,
          p_belge: belge
        }
      },
      {
        name: 'me26_belge_basvurusu',
        params: {
          p_uid: cleanUid,
          p_payload: belge
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Belge RPC çalışmadı, tablo fallback deneniyor:', rpcError);
  }

  try {
    return await insertIntoFirstAvailableTable(
      ['me26_belge_basvurulari', 'belge_basvurulari', 'belgeler'],
      {
        uid: cleanUid,
        kullanici_uid: cleanUid,
        ...belge
      }
    );
  } catch (insertError) {
    console.warn('Belge tablo insert başarısız, users update deneniyor:', insertError);
  }

  return mevcutKullaniciGuncelle(cleanUid, {
    belge_durumu: 'Onay Bekliyor'
  });
}

// ------------------------------------------------------
// ÖNERGE
// ------------------------------------------------------

export async function onergeGonder(payload = {}) {
  const uid = cleanText(payload.uid || payload.yazar_uid);
  const baslik = cleanText(payload.baslik || payload.title);
  const sorun = cleanText(payload.sorun || payload.problem);
  const cozum = cleanText(payload.cozum || payload.solution);
  const hedefKitle = cleanText(payload.hedef_kitle || payload.hedefKitle || 'Herkes');
  const sure = toNumber(payload.sure || payload.duration, 2);

  if (!uid) throw new Error('missing_uid');
  if (baslik.length < 15) throw new Error('title_too_short');
  if (sorun.length < 20) throw new Error('problem_too_short');
  if (cozum.length < 20) throw new Error('solution_too_short');

  try {
    return await tryRpcList([
      {
        name: 'me26_onerge_gonder',
        params: {
          p_uid: uid,
          p_baslik: baslik,
          p_sorun: sorun,
          p_cozum: cozum,
          p_hedef_kitle: hedefKitle,
          p_sure: sure
        }
      },
      {
        name: 'me26_onerge_olustur',
        params: {
          p_payload: {
            uid,
            baslik,
            sorun,
            cozum,
            hedef_kitle: hedefKitle,
            sure
          }
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Önerge RPC çalışmadı, tablo fallback deneniyor:', rpcError);
  }

  return insertIntoFirstAvailableTable(
    ['onergeler', 'me26_onergeler'],
    {
      yazar_uid: uid,
      baslik,
      sorun,
      cozum,
      hedef_kitle: hedefKitle,
      destek_sayisi: 0,
      durum: 'bekliyor'
    }
  );
}

export async function onergeleriGetir() {
  try {
    return await callRpc('me26_onergeleri_getir');
  } catch (rpcError) {
    console.warn('Önergeler RPC çalışmadı, tablo fallback deneniyor:', rpcError);
  }

  const tableTries = ['onergeler', 'me26_onergeler'];
  let lastError = null;

  for (const table of tableTries) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('olusturulma_tarihi', { ascending: false });

      if (error) throw error;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      lastError = error;
      console.warn(`Önergeler alınamadı: ${table}`, error);
    }
  }

  throw lastError || new Error('Önergeler alınamadı.');
}

export async function destekVer(uid, onergeId) {
  const cleanUid = cleanText(uid);
  const cleanOnergeId = cleanText(onergeId);

  if (!cleanUid) throw new Error('missing_uid');
  if (!cleanOnergeId) throw new Error('missing_proposal_id');

  return tryRpcList([
    {
      name: 'me26_destek_ver',
      params: {
        p_uid: cleanUid,
        p_onerge_id: cleanOnergeId
      }
    },
    {
      name: 'me26_onerge_destekle',
      params: {
        p_uid: cleanUid,
        p_onerge_id: cleanOnergeId
      }
    }
  ]);
}

export async function oyKullan(uid, onergeId, oy, oyGucu = 1) {
  const cleanUid = cleanText(uid);
  const cleanOnergeId = cleanText(onergeId);
  const cleanVote = cleanText(oy);

  if (!cleanUid) throw new Error('missing_uid');
  if (!cleanOnergeId) throw new Error('missing_proposal_id');
  if (!cleanVote) throw new Error('missing_vote');

  try {
    return await tryRpcList([
      {
        name: 'me26_oy_kullan',
        params: {
          p_uid: cleanUid,
          p_onerge_id: cleanOnergeId,
          p_oy: cleanVote,
          p_oy_gucu: toNumber(oyGucu, 1)
        }
      },
      {
        name: 'me26_onerge_oyla',
        params: {
          p_uid: cleanUid,
          p_onerge_id: cleanOnergeId,
          p_oy: cleanVote,
          p_oy_gucu: toNumber(oyGucu, 1)
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Oy RPC çalışmadı, tablo fallback deneniyor:', rpcError);
  }

  return insertIntoFirstAvailableTable(
    ['me26_oylar', 'oylar', 'onerge_oylari'],
    {
      uid: cleanUid,
      kullanici_uid: cleanUid,
      onerge_id: cleanOnergeId,
      oy: cleanVote,
      oy_gucu: toNumber(oyGucu, 1)
    }
  );
}

// ------------------------------------------------------
// SORU / CEVAP
// ------------------------------------------------------

export async function soruGonder(payload = {}) {
  const uid = cleanText(payload.uid || payload.yazar_uid);
  const yazarDijitalId = cleanText(payload.yazar_dijital_id || payload.digitalId || 'TR-IA-BEKLEYEN');
  const baslik = cleanText(payload.baslik || payload.title);
  const icerik = cleanText(payload.icerik || payload.content);
  const hedefKitle = cleanText(payload.hedef_kitle || payload.hedefKitle || 'Herkes');

  if (!uid) throw new Error('missing_uid');
  if (baslik.length < 15) throw new Error('title_too_short');
  if (icerik.length < 50) throw new Error('content_too_short');

  try {
    return await tryRpcList([
      {
        name: 'me26_soru_gonder',
        params: {
          p_uid: uid,
          p_yazar_dijital_id: yazarDijitalId,
          p_baslik: baslik,
          p_icerik: icerik,
          p_hedef_kitle: hedefKitle
        }
      }
    ]);
  } catch (rpcError) {
    console.warn('Soru RPC çalışmadı, tablo fallback deneniyor:', rpcError);
  }

  return insertIntoFirstAvailableTable(
    ['me26_sorular', 'sorular'],
    {
      yazar_uid: uid,
      yazar_dijital_id: yazarDijitalId,
      baslik,
      icerik,
      hedef_kitle: hedefKitle,
      cozuldu_mu: false
    }
  );
}

export async function sorulariGetir(filter = 'bekleyen') {
  const solved = filter === 'kutuphane' || filter === 'cozuldu';

  const tableTries = ['me26_sorular', 'sorular'];
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
      console.warn(`Sorular alınamadı: ${table}`, error);
    }
  }

  throw lastError || new Error('Sorular alınamadı.');
}

export async function cevapGonder(payload = {}) {
  const uid = cleanText(payload.uid || payload.yazar_uid);
  const soruId = cleanText(payload.soru_id || payload.question_id);
  const icerik = cleanText(payload.icerik || payload.content);

  if (!uid) throw new Error('missing_uid');
  if (!soruId) throw new Error('missing_question_id');
  if (icerik.length < 20) throw new Error('content_too_short');

  return insertIntoFirstAvailableTable(
    ['me26_cevaplar', 'cevaplar', 'soru_cevaplari'],
    {
      yazar_uid: uid,
      soru_id: soruId,
      icerik
    }
  );
}

// ------------------------------------------------------
// KORUMA HATTI
// ------------------------------------------------------

export async function korumaBildir(payload = {}) {
  const bildirim = {
    bildiren_uid: payload.bildiren_uid || payload.uid || 'TR-IA-ZIYARETCI',
    bildirim_turu: payload.bildirim_turu || payload.tur || 'Diğer',
    sikayet_edilen: payload.sikayet_edilen || payload.kisi || payload.kurum || null,
    baglanti: payload.baglanti || payload.link || null,
    aciklama: payload.aciklama || payload.description || '',
    ad_soyad: payload.ad_soyad || payload.adSoyad || null,
    iletisim: payload.iletisim || null,
    anonim_mi: Boolean(payload.anonim_mi || payload.anonim)
  };

  if (!cleanText(bildirim.sikayet_edilen)) {
    throw new Error('missing_report_target');
  }

  if (cleanText(bildirim.aciklama).length < 20) {
    throw new Error('content_too_short');
  }

  return insertIntoFirstAvailableTable(
    ['me26_koruma_hatti', 'koruma_hatti'],
    bildirim
  );
}

// ------------------------------------------------------
// TRİBÜN / STADYUM
// ------------------------------------------------------

export async function tribunLigiGetir() {
  try {
    return await callRpc('me26_tribun_ligi_getir');
  } catch (rpcError) {
    console.warn('Tribün ligi RPC çalışmadı, users fallback deneniyor:', rpcError);
  }

  const { data, error } = await supabase
    .from('users')
    .select('sehir, city, oy_gucu, vote_power');

  if (error) throw error;

  const map = new Map();

  (data || []).forEach((row) => {
    const city = cleanText(row.sehir || row.city || 'Belirsiz');
    const power = toNumber(row.oy_gucu || row.vote_power, 0);

    if (!map.has(city)) {
      map.set(city, {
        sehir: city,
        guc: 0,
        kisi_sayisi: 0
      });
    }

    const current = map.get(city);
    current.guc += power;
    current.kisi_sayisi += 1;
  });

  return Array.from(map.values()).sort((a, b) => b.guc - a.guc);
}

export async function stadyumDurumuGetir() {
  try {
    return await callRpc('me26_stadyum_durumu_getir');
  } catch (error) {
    console.warn('Stadyum durumu RPC çalışmadı:', error);
    return {
      total: 0,
      mezun: 0,
      ogrenci: 0,
      lider: 'Bekleniyor'
    };
  }
}

export async function stadyumMesajGonder(payload = {}) {
  const mesaj = cleanText(payload.mesaj || payload.text || payload.content);

  if (!mesaj) {
    throw new Error('missing_message');
  }

  return insertIntoFirstAvailableTable(
    ['me26_stadyum_mesajlari', 'stadyum_mesajlari'],
    {
      uid: payload.uid || null,
      dijital_id: payload.dijital_id || payload.digitalId || 'TR-IA',
      sehir: payload.sehir || payload.city || null,
      mesaj
    }
  );
}

// ------------------------------------------------------
// VIP / KURUCU NO
// ------------------------------------------------------

export async function standartNumaraAl(uid) {
  const cleanUid = cleanText(uid);

  if (!cleanUid) throw new Error('missing_uid');

  return tryRpcList([
    {
      name: 'me26_standart_numara_al',
      params: {
        p_uid: cleanUid
      }
    },
    {
      name: 'me26_kurucu_no_al',
      params: {
        p_uid: cleanUid
      }
    }
  ]);
}

export async function vipNumaraRezerveEt(uid, number) {
  const cleanUid = cleanText(uid);
  const selectedNumber = toNumber(number, 0);

  if (!cleanUid) throw new Error('missing_uid');
  if (!selectedNumber) throw new Error('missing_number');

  return tryRpcList([
    {
      name: 'me26_vip_numara_rezerve_et',
      params: {
        p_uid: cleanUid,
        p_numara: selectedNumber
      }
    },
    {
      name: 'me26_vip_no_al',
      params: {
        p_uid: cleanUid,
        p_numara: selectedNumber
      }
    }
  ]);
}

// ------------------------------------------------------
// DB NESNESİ
// ------------------------------------------------------

export const DB = {
  supabase,

  // Kullanıcı
  sistemeGiris,
  kullaniciGetir,
  mevcutKullaniciGuncelle,
  sehirGuncelle,

  // Telefon / belge
  telefonuOnayla,
  belgeyiSirayaAl,

  // Önerge
  onergeGonder,
  onergeleriGetir,
  destekVer,
  oyKullan,

  // Soru
  soruGonder,
  sorulariGetir,
  cevapGonder,

  // Koruma
  korumaBildir,

  // Tribün / stadyum
  tribunLigiGetir,
  stadyumDurumuGetir,
  stadyumMesajGonder,

  // VIP
  standartNumaraAl,
  vipNumaraRezerveEt
};

// Eski dosyalar window.DB bekliyorsa çalışsın.
window.DB = {
  ...(window.DB || {}),
  ...DB
};

window.ME26_DB = DB;
window.ME26_SUPABASE = supabase;

console.info('ME26 supabase.js temiz final sürüm yüklendi.');
