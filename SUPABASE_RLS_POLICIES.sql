-- ME26 Başlangıç RLS Taslağı
-- Bu dosya doğrudan çalıştırılmadan önce tablo/kolon adları Supabase projenize göre kontrol edilmelidir.
-- Amaç: frontend anon key açıkken verinin RLS ile korunmasını sağlamak.

-- Örnek:
-- alter table public.users enable row level security;
-- alter table public.onergeler enable row level security;
-- alter table public.me26_sorular enable row level security;
-- alter table public.me26_cevaplar enable row level security;
-- alter table public.me26_koruma_hatti enable row level security;

-- Public okunabilir içerikler için örnek SELECT politikası:
-- create policy "public_read_onergeler" on public.onergeler
-- for select using (true);

-- Auth kullanıcısının kendi kaydını görmesi için örnek:
-- create policy "users_read_own" on public.users
-- for select using (auth.uid()::text = firebase_uid);

-- Auth kullanıcısının kendi kaydını güncellemesi için örnek:
-- create policy "users_update_own" on public.users
-- for update using (auth.uid()::text = firebase_uid)
-- with check (auth.uid()::text = firebase_uid);

-- Koruma hattı insert örneği: anonim başvuru gerekiyorsa rate-limit/backend ile birlikte kullanılmalı.
-- create policy "koruma_insert_limited" on public.me26_koruma_hatti
-- for insert with check (true);

-- DİKKAT:
-- Service role key asla frontend'e konmaz.
-- Koruma hattı, SMS ve belge doğrulama için ideal çözüm Cloudflare Worker / Edge Function üzerinden rate-limit uygulamaktır.
