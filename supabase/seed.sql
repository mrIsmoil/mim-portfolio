-- ============================================
-- MIM Portfolio — seed data
-- Run AFTER schema.sql, once, in Supabase Studio → SQL Editor.
-- Populates the 4 projects currently live on the site and the 10 skills
-- currently hardcoded in script.js, so the public site can be switched over
-- to reading from the database with zero visual change.
--
-- cover_image_url is left NULL for all 4 — the site falls back to each
-- project's existing hand-built CSS preview (keyed by slug) until a real
-- screenshot is uploaded later through the admin panel or Storage.
-- ============================================

insert into public.projects
  (slug, title_en, title_uz, summary_en, summary_uz, description_en, description_uz,
   tech_tags, category, live_url, code_url, featured, is_published, sort_order)
values
  ($$tonsor$$, $$Tonsor$$, $$Tonsor$$,
   $$An exclusive digital platform connecting elite barbers with their clients — booking, profiles, and business tools in one place.$$,
   $$Sartaroshlar va ularning mijozlarini bog'lovchi eksklyuziv raqamli platforma — bron qilish, profil va biznes vositalari bir joyda.$$,
   $$An exclusive digital platform connecting elite barbers with their clients — booking, profiles, and business tools in one place.$$,
   $$Sartaroshlar va ularning mijozlarini bog'lovchi eksklyuziv raqamli platforma — bron qilish, profil va biznes vositalari bir joyda.$$,
   array['HTML','CSS','JavaScript','Python','Django'], $$Booking Platform$$,
   $$https://mim.pythonanywhere.com$$, $$https://github.com/mrIsmoil/Tonsor$$,
   true, true, 0),

  ($$ozbekiston$$, $$O'zbekiston$$, $$O'zbekiston$$,
   $$An immersive web experience showcasing the history, culture, and regions of Uzbekistan — built with cinematic design.$$,
   $$O'zbekistonning tarixi, madaniyati va hududlarini kinematografik dizayn bilan taqdim etuvchi veb-tajriba.$$,
   $$An immersive web experience showcasing the history, culture, and regions of Uzbekistan — built with cinematic design.$$,
   $$O'zbekistonning tarixi, madaniyati va hududlarini kinematografik dizayn bilan taqdim etuvchi veb-tajriba.$$,
   array['HTML','CSS','JavaScript','Next.js'], $$Cultural / Marketing$$,
   $$https://uzculture.vercel.app$$, $$https://github.com/mrIsmoil/uzbek$$,
   true, true, 1),

  ($$mim-logistic$$, $$MIM Logistic$$, $$MIM Logistic$$,
   $$A professional website for logistics companies — clean design with tracking, routing, and service showcase features.$$,
   $$Logistika kompaniyalari uchun professional veb-sayt — yuk kuzatish, marshrutlash va xizmatlarni namoyish qilish.$$,
   $$A professional website for logistics companies — clean design with tracking, routing, and service showcase features.$$,
   $$Logistika kompaniyalari uchun professional veb-sayt — yuk kuzatish, marshrutlash va xizmatlarni namoyish qilish.$$,
   array['HTML','CSS','JavaScript','WIP'], $$Business / Logistics$$,
   $$https://mimlogistic.netlify.app$$, null,
   true, true, 2),

  ($$maison-aura$$, $$Maison Aura$$, $$Maison Aura$$,
   $$A classic-style online boutique with luxury aesthetics — elegant product showcase, smooth UI, and refined shopping experience.$$,
   $$Klassik uslubdagi onlayn butik — elegantlik, silliq interfeys va professional xarid tajribasi.$$,
   $$A classic-style online boutique with luxury aesthetics — elegant product showcase, smooth UI, and refined shopping experience.$$,
   $$Klassik uslubdagi onlayn butik — elegantlik, silliq interfeys va professional xarid tajribasi.$$,
   array['HTML','CSS','JavaScript'], $$E-commerce$$,
   $$https://mimshoping.netlify.app/$$, null,
   true, true, 3)
on conflict (slug) do nothing;


insert into public.skills
  (category_en, category_uz, name, proficiency_pct, note_en, note_uz, sort_order)
values
  ($$Frontend$$, $$Frontend$$, $$HTML / CSS$$, 80,
   $$Semantic markup, responsive layouts, CSS animations, Grid & Flexbox.$$,
   $$Semantik belgilash, moslashuvchan layout, CSS animatsiyalar.$$, 0),

  ($$Frontend$$, $$Frontend$$, $$JavaScript$$, 40,
   $$ES6+, DOM manipulation, async/await and modern JS patterns.$$,
   $$ES6+, DOM boshqaruvi, async/await va zamonaviy JS usullari.$$, 1),

  ($$Frontend$$, $$Frontend$$, $$React$$, 10,
   $$Component architecture, hooks, state management & routing.$$,
   $$Komponent arxitekturasi, hooklar va holat boshqaruvi.$$, 2),

  ($$Backend$$, $$Backend$$, $$Python$$, 50,
   $$Scripting, automation, data processing and backend development.$$,
   $$Skriptlar, avtomatlashtirish va backend dasturlash.$$, 3),

  ($$Backend$$, $$Backend$$, $$Django$$, 90,
   $$Full-stack web framework — models, views, templates, REST APIs.$$,
   $$To'liq stekli freymvork — modellar, ko'rinishlar, REST API.$$, 4),

  ($$Tools$$, $$Asboblar$$, $$Git / GitHub$$, 65,
   $$Version control, branching, CI/CD workflows and pull requests.$$,
   $$Versiya nazorati, tarmoqlash, CI/CD va pull requestlar.$$, 5),

  ($$Languages$$, $$Tillar$$, $$English$$, 90,
   $$Fluent in reading, writing, and speaking — primary working language.$$,
   $$O'qish, yozish va gaplashishda ravon — asosiy ish tili.$$, 6),

  ($$Languages$$, $$Tillar$$, $$Russian$$, 10,
   $$Basic understanding — can follow simple conversations.$$,
   $$Boshlang'ich daraja — oddiy suhbatlarni tushuna olaman.$$, 7),

  ($$Languages$$, $$Tillar$$, $$French$$, 10,
   $$Beginner level — learning the fundamentals.$$,
   $$Boshlang'ich daraja — asoslarni o'rganmoqdaman.$$, 8),

  ($$Hobby$$, $$Qiziqish$$, $$Chess$$, 50,
   $$Strategic thinking, pattern recognition and competitive play.$$,
   $$Strategik fikrlash, naqshlarni tanish va musobaqa o'yinlari.$$, 9)
on conflict do nothing;


insert into public.site_settings (id, bio_en, bio_uz, available_for_work)
values (1,
  $$A 17-year-old developer and creator from Kokand, Uzbekistan, passionate about building useful and meaningful projects.$$,
  $$Qo'qon, O'zbekistonlik 17 yoshli dasturchi va ijodkorman, foydali va mazmunli loyihalar yaratishga katta qiziqishim bor.$$,
  true)
on conflict (id) do update set
  bio_en = excluded.bio_en,
  bio_uz = excluded.bio_uz,
  available_for_work = excluded.available_for_work;
