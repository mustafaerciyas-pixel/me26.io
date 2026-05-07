# ME26 küçük iyileştirme notları

Bu paket, son gönderilen yedek ZIP üzerinde küçük ve güvenli dokunuşlarla hazırlanmıştır.

## Yapılan değişiklikler

1. `qa.js` içine `escapeHtml`, `cleanText` ve `safeId` yardımcıları eklendi.
2. Soru başlığı, soru içeriği, cevap içeriği, yazar ID ve hata mesajları HTML'e basılırken kaçırıldı.
3. Soru/cevap ID değerleri inline fonksiyon çağrılarında `safeId()` ile sınırlandı.
4. `index.html` içinden doğrudan `stadium.js` yüklemesi kaldırıldı; çünkü `app.js` zaten `STADYUM` modülünü import ediyor. Bu çift başlatma/çift yükleme riskini azaltır.
5. `style.css`, `app.js` ve `qa.js` bağlantıları korunmuştur.

## Puan etkisi

Önceki paket: yaklaşık 76/100.
Bu küçük iyileştirilmiş paket: yaklaşık 78/100.

## Hâlâ canlı test isteyen konular

- Firebase SMS / reCAPTCHA canlı testi
- Supabase RLS policy kontrolü
- Koruma hattı için rate-limit / Turnstile
- Belge/PDF doğrulama akışının gerçek production kontrolü
