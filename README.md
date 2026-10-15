# TestFlow Pro

Talabalar uchun shaxsiy test platformasi: fayldan test yuklash, mashq va imtihon rejimida yechish, xatolar ustida ishlash, statistika.

- Frontend: HTML5, CSS3, Vanilla JavaScript (framework yo‘q), SheetJS, Mammoth.js, Lucide
- Backend: PHP 8.2+ (REST API), PDO, MySQL / MariaDB
- Taymer, vaqt chegarasi yoki vaqtga asoslangan ball **yo‘q**

Dasturchi: **Rayimbek Sanjarovich** — Instagram [@23.sanjarovich](https://instagram.com/23.sanjarovich), Telegram [@Rayimbek_Sanjarovich](https://t.me/Rayimbek_Sanjarovich), tel: +998 93 478 77 62

## 1. Talablar

- PHP 8.2 yoki yuqori. Kengaytmalar: `pdo_mysql`, `mbstring`, `json`, `session` (odatda yoqilgan)
- MySQL 5.7+ yoki MariaDB 10.4+ (utf8mb4, InnoDB, JSON turi)
- Apache (`mod_rewrite`) yoki Nginx
- Composer **kerak emas**: loyiha PHP dependency'siz yozilgan
- Brauzer testlari uchun (ixtiyoriy): Node.js 18+; API testlari uchun PHP `curl` kengaytmasi

Frontend kutubxonalari CDN orqali yuklanadi (birinchi ochilishda internet kerak): SheetJS 0.18.5, Mammoth 1.8.0, Lucide 0.469.0, Inter shrifti.

## 2. Ishga tushirish (Windows + OSPanel)

1. `testflow` papkasini `OSPanel\domains\testflow\` ichiga joylang (hosil bo‘ladigan manzil: `http://testflow/`).
2. OSPanel'da modullarni tanlang: PHP 8.2+ va MySQL (yoki MariaDB), Apache (yoki Nginx), phpMyAdmin. Apache bo‘lsa `mod_rewrite` yoqilgan bo‘lishi kerak (OSPanel'da odatda yoqilgan).
3. **Bazani yarating:** phpMyAdmin → "Import" → `database/schema.sql` ni tanlang. Fayl `testflow_db` bazasini o‘zi yaratadi (`CREATE DATABASE IF NOT EXISTS`). Muhim: `schema.sql` jadvallarni yaratadi, mavjud jadvallarni o‘chirmaydi — qayta import qilishdan oldin bazani qo‘lda o‘chiring.
4. Ixtiyoriy: `database/seed.sql` ni import qiling — demo hisob (`demo@testflow.local` / `Demo12345`) va 6 savollik namunaviy test qo‘shiladi. Statistika baribir faqat real urinishlardan hisoblanadi.
5. Sozlamalar: `.env.example` ni `.env` deb nusxalang va tahrirlang (3-bo‘limga qarang).
6. Brauzerda `http://testflow/` ni oching.

Tekshirish: `http://testflow/api/health` — `{"success":true,...,"database":"up"}` qaytishi kerak.

### Oddiy PHP serveri bilan (OSPanelsiz)

```
cd testflow
php -S 127.0.0.1:8080 router.php
```

`router.php` `/api/*` so‘rovlarini `api/index.php` ga yo‘naltiradi va maxfiy papkalarni yopadi. Manzil: `http://127.0.0.1:8080/`.

## 3. Sozlamalar (`.env`)

| Kalit | Tavsif |
|---|---|
| `APP_ENV` | `local` yoki `production`. Productionda cookie `Secure` bo‘ladi va xato tafsilotlari yashiriladi |
| `APP_URL` | Parolni tiklash havolalari uchun asosiy manzil |
| `APP_TIMEZONE` | Standart `Asia/Tashkent` (PHP va MySQL sessiyasi uchun) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` | MySQL ulanishi. OSPanel'da odatda `root` va bo‘sh parol |
| `ALLOWED_ORIGINS` | Vergul bilan ajratilgan frontend origin'lari (faqat frontend alohida originda bo‘lsa) |
| `SESSION_LIFETIME` | Sessiya muddati, soniya (standart 604800 = 7 kun) |
| `MAX_QUESTIONS_PER_TEST` | Bitta testdagi maksimal savollar (standart 2000) |
| `MAIL_ENABLED`, `MAIL_FROM` | Parolni tiklash uchun email. Standart `false` |

`.env` quyidagi tartibda qidiriladi: `TESTFLOW_ENV` muhit o‘zgaruvchisi → veb-ildizdan **bir daraja yuqoridagi** `testflow.env` → loyiha ichidagi `.env`. Productionda faylni veb-ildizdan tashqariga qo‘ying. `.env` va `api/`, `database/`, `storage/`, `tests/` papkalari `.htaccess` orqali (Apache) va `router.php` orqali (dev server) tashqaridan yopiladi.

## 4. API manzili, origin, CORS, sessiya

Standart tuzilma — **bitta origin**: sahifalar ham, `/api` ham bir domendan beriladi. Shuning uchun CORS kerak emas va `assets/js/config.js` dagi `API_BASE` avtomatik aniqlanadi (`<loyiha papkasi>/api`). Loyiha pastki papkada (`http://localhost/testflow/`) bo‘lsa ham ishlaydi.

Frontend alohida originda bo‘lsa (masalan `http://localhost:5500` va `http://testflow`):

1. `assets/js/config.js` da `API_BASE: 'http://testflow/api'` ni qo‘ying.
2. `.env` da `ALLOWED_ORIGINS=http://localhost:5500` ni yozing. Wildcard (`*`) ishlatilmaydi.
3. Cookie `SameSite=Lax` bilan beriladi: bu bir sayt (same-site) ichidagi originlar (turli portlar) uchun ishlaydi. Butunlay boshqa domenlar uchun `SameSite=None; Secure` va HTTPS kerak — bu holatda `api/middleware/auth.php` dagi `samesite` ni o‘zgartiring.

Xavfsizlik: sessiya cookie `HttpOnly`, kirishdan keyin sessiya ID yangilanadi, barcha o‘zgartiruvchi so‘rovlarda `X-CSRF-Token` va `Origin` tekshiriladi. Parol faqat `password_hash()` bilan saqlanadi, `localStorage`da hech qanday token yoki parol saqlanmaydi.

### Nginx

```
location / { try_files $uri $uri/ =404; }
location ^~ /api/ { try_files $uri /api/index.php?$query_string; }
location ~ ^/(\.env|database/|storage/|tests/|api/(config|services|controllers|helpers|middleware|routes)/) { deny all; }
location ~ \.php$ { include fastcgi_params; fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name; fastcgi_pass 127.0.0.1:9000; }
```

## 5. Imkoniyatlar

- Ro‘yxatdan o‘tish, kirish, chiqish, profil va parolni o‘zgartirish. Parolni tiklash faqat `MAIL_ENABLED=true` bo‘lsa ishlaydi; aks holda API ochiq `501` javob qaytaradi (soxta "yuborildi" xabari yo‘q).
- Import: XLSX, XLS, CSV, DOCX, TXT. Brauzerda o‘qiladi, kontent imzosi tekshiriladi (kengaytmaga ishonilmaydi), varaq/jadval tanlash, ustunlarni moslash, yaroqsiz qatorlar sababi bilan ko‘rsatiladi, takroriy savollar belgilanadi (o‘chirilmaydi), saqlashdan oldin savol va variantlarni tahrirlash, serverda qayta validatsiya, tranzaksiyada saqlash.
- Kutubxona: qidiruv, fan filtri, saralash, nomini o‘zgartirish, savollarni tahrirlash (yangi versiya), o‘chirish, davom ettirish.
- Test: 25/30/50 savol (yetarli bo‘lmasa o‘chiriladi, "Barchasi" varianti bor), mashq va imtihon rejimi, savol va variantlar bir marta aralashtiriladi (CSPRNG), avtosaqlash, yangilangandan keyin davom ettirish, klaviatura (← →, 1–9, A–D, B), shrift o‘lchami, qorong‘i rejim.
- Natijalar: ball halqasi, javoblar tahlili, qayta urinish, chop etish / PDF.
- Xatolar ustida ishlash: o‘zlashtirilmagan xatolar bo‘yicha mashq, belgilangan savollar, belgini olib tashlash.
- Dashboard va statistika: barchasi bazadagi yozuvlardan hisoblanadi; yangi hisobda bo‘sh holat ko‘rsatiladi.

### Versiyalash

Test savollari tahrirlanganda eski savollar o‘zgartirilmaydi: `POST /api/tests/{id}/versions` yangi `test_versions` yozuvi va yangi `questions`/`question_options` qatorlarini yaratadi, `tests.current_version` ko‘tariladi. Har bir urinish o‘zining `test_version_id` va savol/variant snapshot'iga bog‘langan, shuning uchun eski natijalar va javoblar tahlili o‘zgarmaydi. Yangi urinishlar doim joriy versiyadan olinadi. Test o‘chirilganda u `deleted_at` bilan yashiriladi (soft delete) — urinishlar tarixi saqlanib qoladi. Xatolar ro‘yxati savol versiyasiga bog‘liq: tahrirdan keyin yangi savollar uchun xatolar noldan boshlanadi.

### Hisoblash

`foiz = to‘g‘ri / jami × 100`, eng yaqin butun songa yaxlitlanadi (PHP `round`, .5 yuqoriga). Har bir savol — 1 ball. Rasmiy natijani faqat server hisoblaydi; mijozdan kelgan `score`, `percentage`, `is_correct`, `user_id` e’tiborga olinmaydi. Practice rejimida to‘g‘ri javob faqat javob berilgandan keyin, imtihon rejimida faqat yakunlangandan keyin yuboriladi.

## 6. PDF / chop etish

Natijalar sahifasidagi "Hisobot / PDF" tugmasi serverdan hisobotni (`GET /api/attempts/{id}/report`) oladi va brauzerning chop etish oynasini ochadi. PDF olish uchun printer o‘rniga "PDF sifatida saqlash" ni tanlang. Alohida PDF kutubxonasi o‘rnatish shart emas. Hisobot faqat yakunlangan urinishlar uchun beriladi.

## 7. Testlar

Faqat quyidagilar **haqiqatan bajarilgan** (jonli PHP serveri + MariaDB 10.11, PHP 8.3, Node 22, `schema.sql` dan yangi bazada):

```
php tests/api_test.php http://127.0.0.1:8080/api        # 72 ta tekshiruv
cd tests && npm install && npm run parser                # import parser (docx fayl yo‘lini argument sifatida bering)
cd tests && npm run ui                                   # jsdom + jonli server, 44 ta tekshiruv
```

`api_test.php` qamrovi: ro‘yxatdan o‘tish, dublikat email, noto‘g‘ri parol, chiqish, autentifikatsiyasiz kirish, CSRF va begona Origin, validatsiya, SQL-injection urinishi, A foydalanuvchi B ma’lumotlariga kira olmasligi (test, urinish, javob, belgi), mijoz balli e’tiborga olinmasligi, javobda correctness oqib chiqmasligi, imtihon rejimida yashirinlik, birinchi javob yakuniyligi, davom ettirish, takroriy `finish`, xatolarni o‘zlashtirish, versiyalash, soft delete va tarix saqlanishi.

`import_parser_test.js` qamrovi: DOCX jadval, CSV (qo‘shtirnoq, sarlavha, takrorlar), ko‘p varaqli XLSX, o‘zgaruvchan variantlar soni, uzun Unicode, bo‘sh/noto‘g‘ri kengaytma/soxta kontent/buzilgan fayl, 2000 dan ortiq savol.

`ui_smoke.js` har bir sahifani jsdom'da jonli server bilan yuklaydi: landing, dashboard, kutubxona, test sozlamalari, mashq va imtihon rejimi, yangilash va davom ettirish, natijalar, sharh, chop etish, xatolar, statistika, sozlamalar, import (fayl → moslash → tahrir → saqlash), tahrir rejimi, autentifikatsiya sahifalari. Brauzerda JavaScript xatosi qayd etilmagan.

## 8. Muammolarni hal qilish

| Belgi | Yechim |
|---|---|
| `/api/health` → `database: down` | `.env` dagi `DB_*` ni tekshiring, MySQL ishlayotganini va `schema.sql` import qilinganini tekshiring |
| `/api/...` 404 | Apache'da `mod_rewrite` / `AllowOverride All` yoqilganini tekshiring yoki Nginx qoidasini qo‘shing |
| "Xavfsizlik tokeni yaroqsiz" (403) | Sahifani yangilang; cookie bloklanmaganini tekshiring; origin `ALLOWED_ORIGINS` da borligini tekshiring |
| Kirgandan keyin darrov chiqib ketadi | Cookie saqlanmayapti: HTTP da `APP_ENV=production` bo‘lsa `Secure` cookie yuborilmaydi — lokal uchun `APP_ENV=local` |
| Fayl yuklanmayapti | Hajm 10 MB dan oshmasin (`config.js` → `MAX_UPLOAD_MB`); kengaytma va haqiqiy format mos bo‘lsin |
| Excel/Word o‘qilmayapti | CDN kutubxonalari yuklanganini tekshiring (internet, brauzer konsoli) |
| Kirish "Juda ko‘p urinish" (429) | 15 daqiqada 8 ta noto‘g‘ri urinish: kuting yoki `rate_limits` jadvalini tozalang |
| 500 xatosi | PHP `error_log` ga qarang; lokal rejimda javobda `errors.debug` bo‘ladi |
| DOCX tuzilmasi aniqlanmadi | Savollarni jadval ko‘rinishida joylang yoki `.csv` shablondan foydalaning |

## 9. Productionga chiqarish (HTTPS)

1. `APP_ENV=production`, kuchli `DB_PASS`, alohida DB foydalanuvchisi (faqat `testflow_db` huquqi bilan).
2. `.env` ni veb-ildizdan tashqariga (`../testflow.env`) ko‘chiring yoki `TESTFLOW_ENV` o‘rnating.
3. HTTPS yoqing (sessiya cookie productionda `Secure`). `ALLOWED_ORIGINS` ni haqiqiy origin'ga cheklang.
4. `display_errors=Off`, `tests/` va `database/` papkalarini serverga yuklamang yoki yoping.
5. Parolni tiklash kerak bo‘lsa SMTP/`mail()` ni sozlab `MAIL_ENABLED=true` qiling.

## 10. Ma’lum cheklovlar

- Vizual ko‘rinish (dizayn, animatsiyalar, mobil maket) haqiqiy brauzerda **tekshirilmagan** — muhitda brauzer bo‘lmagan. Mantiq jsdom orqali tekshirilgan; yakuniy ko‘rinishni Chrome/Firefox va telefonda ko‘zdan kechiring.
- Apache `.htaccess` qoidalari sinab ko‘rilmagan (sinov PHP o‘rnatilgan serveri bilan o‘tkazilgan; unda xuddi shu yo‘llar `router.php` orqali yopiladi).
- SheetJS 0.18.5 (jsDelivr'dagi so‘nggi versiya) da ma’lum zaifliklar haqida hisobotlar bor. Fayl foydalanuvchining o‘z brauzerida o‘qiladi; baribir imkon bo‘lsa SheetJS'ning o‘z CDN'idagi yangi versiyasiga o‘ting (`pages/import.html` dagi `<script>` manzili).
- Yuklangan original fayllar saqlanmaydi (brauzerda o‘qiladi, serverga faqat tozalangan savollar yuboriladi), shuning uchun server tomonida fayl yuklash yuzasi yo‘q.
- Birinchi tanlangan javob ikkala rejimda ham yakuniy (imtihonda ham o‘zgartirib bo‘lmaydi).
- Chegara cheklovi (rate limit) MySQL jadvalida, IP va email bo‘yicha — proksi ortida `REMOTE_ADDR` ni to‘g‘ri sozlang.
- Parolni tiklash email sozlanmaguncha ishlamaydi (bu ataylab).
