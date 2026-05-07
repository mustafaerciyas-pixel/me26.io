/* ==========================================================================
   ME26 AĞI - SUPABASE VERİTABANI KÖPRÜSÜ (supabase.js)
   Cloudflare Workers Canlı Test Sürümü
   --------------------------------------------------------------------------
   Görev:
   - Frontend ile Supabase arasındaki güvenli köprü
   - Kullanıcı giriş/kayıt RPC
   - Telefon / belge / şehir / numara işlemleri
   - Önerge, soru, destek ve koruma hattı işlemleri
   - Oy, tribün ve canlı veri işlemleri

   KRİTİK:
   - Bu dosyada service_role key ASLA kullanılmaz.
   - Frontend'de yalnızca anon / publishable key kullanılabilir.
   - Önerge, soru, destek ve koruma hattı RPC üzerinden çalışır.
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { ME26_CONFIG } from './config.js';

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
// KISA YARDIMCILAR
// ------------------------------------------------------
const cleanString = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;

    return String(value).trim();
};

const cleanNullableString = (value) => {
    const cleaned = cleanString(value);

    return cleaned.length > 0 ? cleaned : null;
};

const cleanNumber = (value, fallback = 0) => {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanInteger = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value), 10);

    return Number.isFinite(parsed) ? parsed : fallback;
};

const cleanVoteChoice = (value) => {
    const choice = cleanString(value);

    if (!['yes', 'no', 'abstain'].includes(choice)) {
        throw new Error('invalid_vote_choice');
    }

    return choice;
};

const normalizeDbError = (error, fallbackMessage = 'database_error') => {
    if (!error) return new Error(fallbackMessage);

    const code = cleanString(error.code);
    const messageRaw = cleanString(error.message);
    const detailsRaw = cleanString(error.details);
    const hintRaw = cleanString(error.hint);

    const message = messageRaw.toLowerCase();
    const details = detailsRaw.toLowerCase();
    const hint = hintRaw.toLowerCase();

    if (code === '23505') {
        return new Error('duplicate_record');
    }

    if (
        message.includes('duplicate key') ||
        message.includes('unique constraint') ||
        details.includes('already exists')
    ) {
        return new Error('duplicate_record');
    }

    const knownMessages = [
        'missing_uid',
        'missing_city',
        'missing_phone',
        'missing_document_payload',
        'missing_document_name',
        'missing_user_payload',
        'missing_proposal_id',
        'missing_question_id',
        'missing_problem',
        'missing_solution',
        'missing_koruma_payload',
        'missing_koruma_type',
        'missing_koruma_target',
        'koruma_description_too_short',
        'title_too_short',
        'title_too_long',
        'problem_too_short',
        'solution_too_short',
        'content_too_short',
        'content_too_long',
        'user_not_found',
        'proposal_not_found',
        'already_voted',
        'already_supported',
        'vip_number_taken',
        'not_enough_invites',
        'already_has_number',
        'invalid_vip_number',
        'invalid_vote_power',
        'invalid_vote_choice'
    ];

    for (const known of knownMessages) {
        if (
            message.includes(known) ||
            details.includes(known) ||
            hint.includes(known)
        ) {
            return new Error(known);
        }
    }

    if (message.includes('already voted') || message.includes('zaten oy')) {
        return new Error('already_voted');
    }

    if (message.includes('already supported') || message.includes('zaten destek')) {
        return new Error('already_supported');
    }

    if (message.includes('number taken') || message.includes('vip numara')) {
        return new Error('vip_number_taken');
    }

    return error instanceof Error
        ? error
        : new Error(messageRaw || fallbackMessage);
};

const safeRpc = async (rpcName, params = {}) => {
    const { data, error } = await supabase.rpc(rpcName, params);

    if (error) {
        throw normalizeDbError(error, `${rpcName}_failed`);
    }

    return data;
};

const safeSelect = async (query, fallback = []) => {
    const { data, error } = await query;

    if (error) {
        throw normalizeDbError(error, 'select_failed');
    }

    return data || fallback;
};

const safeMaybeSingle = async (query) => {
    const { data, error } = await query;

    if (error) {
        throw normalizeDbError(error, 'single_select_failed');
    }

    return data || null;
};

// ======================================================
// DB MOTORU
// ======================================================
export const DB = {
    // --------------------------------------------------
    // 1. SİSTEME GİRİŞ
    // Google giriş sonrası kullanıcıyı bulur veya oluşturur.
    // --------------------------------------------------
    sistemeGiris: async (gizliPaket) => {
        if (!gizliPaket || !gizliPaket.uid) {
            throw new Error('missing_user_payload');
        }

        const uid = cleanString(gizliPaket.uid);

        if (!uid) {
            throw new Error('missing_uid');
        }

        const mevcutUser = await safeMaybeSingle(
            supabase
                .from('users')
                .select('*')
                .eq('id', uid)
                .maybeSingle()
        );

        if (mevcutUser) {
            return mevcutUser;
        }

        const payload = {
            uid,
            g_isim: cleanString(gizliPaket.g_isim, 'İsimsiz'),
            mail: cleanNullableString(gizliPaket.mail),
            foto: cleanNullableString(gizliPaket.foto),
            m_durum: cleanString(gizliPaket.m_durum, 'Belirsiz'),
            sehir: cleanNullableString(gizliPaket.sehir),
            d_kod: cleanString(gizliPaket.d_kod),
            ref: cleanNullableString(gizliPaket.ref)
        };

        return await safeRpc('me26_sistem_giris', {
            p_payload: payload
        });
    },

    // --------------------------------------------------
    // 2. TELEFON ONAY
    // --------------------------------------------------
    telefonuOnayla: async (uid, telNo) => {
        const temizUid = cleanString(uid);
        const temizTel = cleanString(telNo);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizTel) throw new Error('missing_phone');

        return await safeRpc('me26_telefon_onay', {
            p_uid: temizUid,
            p_tel: temizTel
        });
    },

    // --------------------------------------------------
    // 3. BELGE İNCELEME KUYRUĞU
    // --------------------------------------------------
    belgeyiSirayaAl: async (uid, belgeData) => {
        const temizUid = cleanString(uid);

        if (!temizUid) throw new Error('missing_uid');

        if (!belgeData || typeof belgeData !== 'object') {
            throw new Error('missing_document_payload');
        }

        const temizBelge = {
            dosya_adi: cleanString(belgeData.dosya_adi).slice(0, 180),
            tur: cleanString(belgeData.tur, 'application/pdf'),
            belge_durumu: cleanString(belgeData.belge_durumu, 'Onay Bekliyor')
        };

        if (!temizBelge.dosya_adi) {
            throw new Error('missing_document_name');
        }

        return await safeRpc('me26_belge_yukle', {
            p_uid: temizUid,
            p_data: temizBelge
        });
    },

    // --------------------------------------------------
    // 4. ŞEHİR / TRİBÜN GÜNCELLEME
    // --------------------------------------------------
    sehirGuncelle: async (uid, secilenSehir) => {
        const temizUid = cleanString(uid);
        const temizSehir = cleanString(secilenSehir);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizSehir) throw new Error('missing_city');

        return await safeRpc('me26_sehir_guncelle', {
            p_uid: temizUid,
            p_sehir: temizSehir
        });
    },

    // --------------------------------------------------
    // 5. STANDART NUMARA ALMA
    // --------------------------------------------------
    standartNumaraAl: async (uid) => {
        const temizUid = cleanString(uid);

        if (!temizUid) throw new Error('missing_uid');

        return await safeRpc('me26_standart_numara_al', {
            p_uid: temizUid
        });
    },

    // --------------------------------------------------
    // 6. VIP NUMARA ALMA
    // --------------------------------------------------
    vipNumaraAl: async (uid, vipNumber) => {
        const temizUid = cleanString(uid);
        const temizNo = cleanInteger(vipNumber, 0);

        if (!temizUid) throw new Error('missing_uid');
        if (temizNo <= 0) throw new Error('invalid_vip_number');

        try {
            return await safeRpc('me26_vip_numara_al', {
                p_uid: temizUid,
                p_vip_no: temizNo
            });
        } catch (error) {
            const normalized = normalizeDbError(error, 'vip_claim_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'vip_number_taken'
            ) {
                throw new Error('vip_number_taken');
            }

            throw normalized;
        }
    },

    // --------------------------------------------------
    // 7. ÖNERGE GÖNDERME
    // RPC: me26_onerge_gonder
    // --------------------------------------------------
    onergeGonder: async (uid, baslik, sorun, cozum, hedefKitle, sure) => {
        const temizUid = cleanString(uid);
        const temizBaslik = cleanString(baslik);
        const temizSorun = cleanString(sorun);
        const temizCozum = cleanString(cozum);
        const temizHedefKitle = cleanString(hedefKitle, 'Herkes');
        const temizSure = cleanInteger(sure, 2);

        if (!temizUid) throw new Error('missing_uid');
        if (temizBaslik.length < 15) throw new Error('title_too_short');
        if (temizBaslik.length > 150) throw new Error('title_too_long');
        if (temizSorun.length < 20) throw new Error('problem_too_short');
        if (temizCozum.length < 20) throw new Error('solution_too_short');

        return await safeRpc('me26_onerge_gonder', {
            p_uid: temizUid,
            p_baslik: temizBaslik,
            p_sorun: temizSorun,
            p_cozum: temizCozum,
            p_hedef_kitle: temizHedefKitle,
            p_sure: temizSure
        });
    },

    // --------------------------------------------------
    // 8. SORU GÖNDERME
    // RPC: me26_soru_gonder
    // --------------------------------------------------
    soruGonder: async (uid, yazarDijitalId, baslik, icerik, hedefKitle) => {
        const temizUid = cleanString(uid);
        const temizDijitalId = cleanString(yazarDijitalId, 'TR-IA-BEKLEYEN');
        const temizBaslik = cleanString(baslik);
        const temizIcerik = cleanString(icerik);
        const temizHedefKitle = cleanString(hedefKitle, 'Herkes');

        if (!temizUid) throw new Error('missing_uid');
        if (temizBaslik.length < 15) throw new Error('title_too_short');
        if (temizBaslik.length > 150) throw new Error('title_too_long');
        if (temizIcerik.length < 50) throw new Error('content_too_short');
        if (temizIcerik.length > 3000) throw new Error('content_too_long');

        return await safeRpc('me26_soru_gonder', {
            p_uid: temizUid,
            p_yazar_dijital_id: temizDijitalId,
            p_baslik: temizBaslik,
            p_icerik: temizIcerik,
            p_hedef_kitle: temizHedefKitle
        });
    },

    // --------------------------------------------------
    // 9. ÖNERGELERİ GETİRME
    // --------------------------------------------------
    onergeleriGetir: async () => {
        return await safeSelect(
            supabase
                .from('onergeler')
                .select('*')
                .order('olusturulma_tarihi', { ascending: false }),
            []
        );
    },

    // --------------------------------------------------
    // 10. ÖNERGEYE DESTEK VERME
    // RPC: me26_destek_ver
    // --------------------------------------------------
    destekVer: async (uid, onergeId) => {
        const temizUid = cleanString(uid);
        const temizOnergeId = cleanString(onergeId);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizOnergeId) throw new Error('missing_proposal_id');

        try {
            return await safeRpc('me26_destek_ver', {
                p_onerge_id: temizOnergeId,
                p_uid: temizUid
            });
        } catch (error) {
            const normalized = normalizeDbError(error, 'support_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'already_supported'
            ) {
                throw new Error('already_supported');
            }

            throw normalized;
        }
    },

    // --------------------------------------------------
    // 11. OY KULLANMA
    // Şimdilik direkt tablo insert.
    // İstersen bunu da sonraki adımda RPC’ye alırız.
    // --------------------------------------------------
    oyKullan: async (uid, onergeId, kullanilanOy, oyGucu) => {
        const temizUid = cleanString(uid);
        const temizOnergeId = cleanString(onergeId);
        const temizOy = cleanVoteChoice(kullanilanOy);
        const temizOyGucu = cleanNumber(oyGucu, 0);

        if (!temizUid) throw new Error('missing_uid');
        if (!temizOnergeId) throw new Error('missing_proposal_id');
        if (temizOyGucu <= 0) throw new Error('invalid_vote_power');

        const yeniOy = {
            onerge_id: temizOnergeId,
            user_id: temizUid,
            kullanilan_oy: temizOy,
            oy_gucu: temizOyGucu
        };

        const { error } = await supabase
            .from('me26_oylar')
            .insert([yeniOy]);

        if (error) {
            const normalized = normalizeDbError(error, 'vote_insert_failed');

            if (
                normalized.message === 'duplicate_record' ||
                normalized.message === 'already_voted'
            ) {
                throw new Error('already_voted');
            }

            throw normalized;
        }

        return true;
    },

    // --------------------------------------------------
    // 12. OY SONUÇLARI
    // --------------------------------------------------
    oySonuclariniGetir: async (onergeId) => {
        const temizOnergeId = cleanString(onergeId);

        if (!temizOnergeId) throw new Error('missing_proposal_id');

        return await safeSelect(
            supabase
                .from('me26_oylar')
                .select('kullanilan_oy, oy_gucu, user_id')
                .eq('onerge_id', temizOnergeId),
            []
        );
    },

    // --------------------------------------------------
    // 13. TRİBÜN LİGİ
    // --------------------------------------------------
    tribunLigiGetir: async () => {
        const users = await safeSelect(
            supabase
                .from('users')
                .select('id, sehir, mesleki_durum'),
            []
        );

        const onergeler = await safeSelect(
            supabase
                .from('onergeler')
                .select('yazar_uid'),
            []
        );

        const oylar = await safeSelect(
            supabase
                .from('me26_oylar')
                .select('user_id'),
            []
        );

        const sorular = await safeSelect(
            supabase
                .from('me26_sorular')
                .select('yazar_uid'),
            []
        );

        const cevaplar = await safeSelect(
            supabase
                .from('me26_cevaplar')
                .select('yazar_uid'),
            []
        );

        const cityMap = {};
        const userCityMap = {};

        users.forEach((user) => {
            const city = cleanString(user.sehir);

            userCityMap[user.id] = city;

            if (!city || city === 'Belirsiz' || city === 'Seçilmedi') return;

            if (!cityMap[city]) {
                cityMap[city] = {
                    city,
                    icmimar: 0,
                    ogrenci: 0,
                    onerge: 0,
                    oy: 0,
                    katki: 0,
                    weeklyGrowthPoints: 0,
                    weeklyGrowthPercent: 0
                };
            }

            const role = cleanString(user.mesleki_durum).toLowerCase();

            if (role.includes('öğrenci')) {
                cityMap[city].ogrenci += 1;
            } else {
                cityMap[city].icmimar += 1;
            }
        });

        onergeler.forEach((onerge) => {
            const city = userCityMap[onerge.yazar_uid];

            if (city && cityMap[city]) {
                cityMap[city].onerge += 1;
            }
        });

        oylar.forEach((oy) => {
            const city = userCityMap[oy.user_id];

            if (city && cityMap[city]) {
                cityMap[city].oy += 1;
            }
        });

        const katkilar = [
            ...(sorular || []),
            ...(cevaplar || [])
        ];

        katkilar.forEach((katki) => {
            const city = userCityMap[katki.yazar_uid];

            if (city && cityMap[city]) {
                cityMap[city].katki += 1;
            }
        });

        return Object
            .values(cityMap)
            .sort((a, b) => {
                const scoreA =
                    a.icmimar * 10 +
                    a.ogrenci * 5 +
                    a.onerge * 2 +
                    a.oy * 1 +
                    a.katki * 2;

                const scoreB =
                    b.icmimar * 10 +
                    b.ogrenci * 5 +
                    b.onerge * 2 +
                    b.oy * 1 +
                    b.katki * 2;

                return scoreB - scoreA;
            });
    },

    // --------------------------------------------------
    // 14. KORUMA HATTI BİLDİRİMİ
    // RPC: me26_koruma_bildir
    // --------------------------------------------------
    korumaBildir: async (payload) => {
        if (!payload || typeof payload !== 'object') {
            throw new Error('missing_koruma_payload');
        }

        const bildirim = {
            bildiren_uid: cleanString(payload.bildiren_uid, 'TR-IA-ZİYARETÇİ'),
            bildirim_turu: cleanString(payload.bildirim_turu),
            sikayet_edilen: cleanString(payload.sikayet_edilen),
            baglanti: cleanNullableString(payload.baglanti),
            aciklama: cleanString(payload.aciklama),
            ad_soyad: cleanNullableString(payload.ad_soyad),
            iletisim: cleanNullableString(payload.iletisim),
            anonim_mi: Boolean(payload.anonim_mi)
        };

        if (!bildirim.bildirim_turu) throw new Error('missing_koruma_type');
        if (!bildirim.sikayet_edilen) throw new Error('missing_koruma_target');
        if (bildirim.aciklama.length < 20) throw new Error('koruma_description_too_short');

        return await safeRpc('me26_koruma_bildir', {
            p_payload: bildirim
        });
    }
};
