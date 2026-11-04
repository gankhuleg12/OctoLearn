# OctoLearn — Backend (Админ веб + App API)

Node.js + TypeScript + Express 5 + PostgreSQL. Хоёр хэсэгтэй:

- **Админ веб панел** (`/`) — зөвхөн `admin` эрхтэй хэрэглэгч нэвтэрнэ. Хэрэглэгч хянах, XP чансаа, бүлэг/хичээл/шалгалт удирдах.
- **App REST API** (`/api/*`) — Expo mobile app ашиглана.

## Ажиллуулах

```bash
cd backend
npm install
cp .env.example .env     # шаардлагатай бол засна
npm run dev              # http://localhost:4000
```

Сервер асахдаа migration-ийг ажиллуулна. Demo контентыг **зөвхөн DB хоосон үед** оруулна, иймээс админ панелд хийсэн засвар restart хийхэд алга болохгүй.

**Өгөгдлийн сан**: хоёр горимтой, хоёулаа ижил SQL ашиглана.

| Горим | Тохиргоо | Хэзээ |
|---|---|---|
| PostgreSQL | `.env`-д `DATABASE_URL=postgres://...` | Production. `docker compose up -d` хийвэл local Postgres асна. |
| PGlite (embedded Postgres, WASM) | `DATABASE_URL`-г хоосон орхино | Юу ч суулгалгүй шууд туршихад. Өгөгдөл `./data/pglite`-д хадгалагдана. |

Demo бүртгэлүүд: `admin@octolearn.mn / admin1234` (админ панел), `demo@octolearn.mn / demo1234` (суралцагч, app).

```bash
npm test            # unit + API integration тест (in-memory PGlite)
npm run typecheck
npm run build && npm start
npm run db:seed     # seed контентыг id-аар нь дахин upsert хийнэ (засварыг дарна)
npm run db:reset    # схемийг устгаад дахин migrate + seed
```

## Админ панел

| Хуудас | Боломж |
|---|---|
| Хяналт | Суралцагчийн тоо, 7 хоногийн идэвх, дууссан хичээл, шалгалтын тэнцэлтийн хувь, топ 10, контентын тоо |
| Хэрэглэгчид | Хайлттай жагсаалт (XP, хичээл, шалгалт, сүүлийн идэвх). Дэлгэрэнгүй: статистик, 7 хоногийн график, сургалтын зам дээрх байршил, шалгалтын оролдлого, сүүлийн хичээлүүд. Ахиц тэглэх, хэрэглэгч устгах |
| XP чансаа | Суралцагчдыг XP-ээр эрэмбэлсэн топ 100 |
| Контент | Бүлэг нэмэх/засах/устгах/дараалал өөрчлөх/нийтлэх (ноорог). Бүлэг дотор хичээл нэмэх/засах/устгах/дараалал (видео нь **URL** эсвэл **Bunny Stream-д upload** — файлаа чирж оруулна, encode-ийн төлөв харагдана). Бүлэг бүрт шалгалт үүсгэх/засах/устгах: асуулт, 2–6 сонголт, зөв хариулт, тэнцэх босго. Курсыг JSON-оор экспорт/импорт хийх |
| Тохиргоо | Bunny Stream: Library ID, API key, CDN hostname, API хаяг; холболт шалгах; webhook URL. Цайвар / Бараан / Систем горим (анхдагч: цайвар, sidebar дээр ч бий) |

Шинэ бүлэг **ноорог** төлөвтэй үүснэ. Админ "Нийтлэх" дартал app-д харагдахгүй. Хоосон бүлэг болон асуултгүй шалгалт app-ийн замд орохгүй.

## App API

Бүх endpoint (`/api/auth/*`-аас бусад) `Authorization: Bearer <token>` шаардана. Алдааны хэлбэр: `{ "error": { "code", "message", "details?" } }`. `message` нь Монгол хэлээр тул app шууд харуулж болно.

| Method | Path | Тайлбар |
|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` → `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/me` | Профайл + статистик (XP, түвшин, streak, дундаж оноо, 7 хоногийн идэвх) |
| PATCH | `/api/me` | `{name?, avatarUrl?}` |
| POST | `/api/me/reset-progress` | Ахицыг тэглэнэ (204) |
| GET | `/api/courses` | Курсын жагсаалт |
| GET | `/api/courses/:courseId/pathway` | Бүлэг, хичээл, шалгалт, тус бүрийн төлөв (`completed/active/locked`), `activeNode`, `summary` (прогресс бар) |
| POST | `/api/lessons/:lessonId/complete` | Хичээл дуусгах → `{xpEarned, alreadyCompleted, nextNode, summary}` |
| GET | `/api/quizzes/:quizId` | Асуултууд (зөв хариултгүй) |
| POST | `/api/quizzes/:quizId/check` | `{questionId, answerIndex}` → `{correct, correctIndex}` ("Шалгах" товч) |
| POST | `/api/quizzes/:quizId/submit` | `{answers:[{questionId, answerIndex}]}` → оноо, XP, `unlockedUnitId`, `summary` |
| GET | `/api/leaderboard?limit=20` | Топ суралцагчид + `me` (өөрийн байр) |
| GET | `/api/health` | Health check |

Түгжээтэй хичээл/шалгалт руу хандвал `423 LOCKED` буцаана ("Өмнөх хичээлээ эхлээд дуусгана уу.").

### Admin API (`/api/admin/*`, admin эрх шаардана)

`GET overview`, `GET leaderboard`, `GET users`, `GET users/:id`, `POST users/:id/reset-progress`, `DELETE users/:id`,
`GET courses`, `GET|PATCH courses/:id`, `GET courses/:id/export`, `POST courses/import`,
`POST courses/:id/units`, `PUT courses/:id/units/order`, `PATCH|DELETE units/:id`,
`POST units/:id/lessons`, `PUT units/:id/lessons/order`, `PATCH|DELETE lessons/:id`,
`PUT|DELETE units/:id/quiz`,
`GET|PUT|DELETE settings/bunny`, `POST settings/bunny/test`, `POST bunny/uploads`, `GET bunny/videos/:id`, `POST lessons/:id/sync-video`.

Webhook (нэвтрэлтгүй): `POST /api/webhooks/bunny` — зөвхөн тохируулсан library-ийн видеог Bunny API-аас дахин уншина.

## Өгөгдлийн бүтэц

Даалгаварт санал болгосон бүтцийг суурь болгож, дараах байдлаар сайжруулсан:

```jsonc
{
  "course": { "id": "eng-a1", "title": "Англи хэл — Анхан шат", "description": "…" },
  "units": [{
    "id": "u1", "title": "Бүлэг 1: Танилцах", "description": "…",
    "published": true,                                   // + ноорог/нийтлэгдсэн
    "lessons": [{ "id": "u1-l1", "title": "Мэндчилгээ", "description": "…",
                  "videoUrl": "https://…mp4", "durationSec": 15, "xp": 10 }],   // + тайлбар, xp
    "quiz": { "id": "u1-quiz", "title": "…", "passPercent": 60,
              "questions": [{ "id": "u1-q1", "text": "…", "options": ["…"], "answerIndex": 1 }] }
  }]
}
```

- Энэ хэлбэрээр seed хийж ([course.json](src/db/seed-data/course.json)), админ панелаас экспорт/импорт хийнэ.
- App-д очих `pathway` хариу ч мөн энэ бүтэцтэй, дээр нь `state` болон `summary` нэмэгдэнэ. Харин `answerIndex` app рүү очихгүй (шалгалтыг сервер дүгнэнэ), асуултууд `GET /quizzes/:id`-ээр тусдаа ирнэ.
- `user` нь JSON-д биш, `users` хүснэгтэд байна. Ахиц `lesson_completions`, `quiz_attempts` хүснэгтэд хадгалагдана.

## Архитектур

```
src/
  domain/        Цэвэр бизнес дүрэм (I/O-гүй, unit тесттэй): түгжээ, XP, түвшин, streak
  repositories/  SQL query-ууд
  services/      Use case-ууд (transaction, түгжээ шалгах, XP олгох, контент засвар)
  routes/        HTTP + zod validation (app, admin)
  http/          JWT auth middleware, алдааны handler
  db/            pg/PGlite адаптер, migration runner, seed
public/          Админ панел (vanilla JS ES modules, build алхамгүй)
test/            API integration тест (supertest)
```

Гол шийдвэрүүд:

- **Түгжээг сервер шийднэ.** Курс нь нэг шугаман зам: `u1-l1 … u1-l5, u1-quiz, u2-l1 …`. Дуусаагүй эхний цэг нь `active`, бусад дуусаагүй цэг `locked`, дууссан цэг үргэлж `completed`. Админ замын дунд шинэ хичээл нэмбэл суралцагч түүнийг дараагийнхаа хичээл болгон үзнэ, гэхдээ өмнө нь дуусгасан ахиц нь түгжигдэхгүй.
- **XP давхар олгогдохгүй.** `lesson_completions` нь `(user_id, lesson_id)` PK-тай, `ON CONFLICT DO NOTHING` ашиглана. Ахиц бичих бүрт transaction дотор хэрэглэгчийн мөрийг `FOR UPDATE`-ээр түгжинэ.
- **Шалгалтыг сервер дүгнэнэ**, зөв хариулт клиент рүү урьдчилж очихгүй.
- **Шалгалт засахад** асуултын id хадгалагдана: байгаа асуулт шинэчлэгдэж, хасагдсан нь устаж, шинэ нь id авна.
- **Хичээл/бүлэг устгахад** холбогдох ахиц ба XP cascade-аар устна. Админ панел үүнийг баталгаажуулах цонхонд анхааруулна.

## Видео: Bunny Stream

1. **Тохиргоо → Bunny Stream** хэсэгт Library ID, API key, CDN hostname-аа оруулж "Холболт шалгах" дарна. API key нь AES-256-GCM-ээр шифрлэгдэж `app_settings` хүснэгтэд хадгалагдах ба буцаж хэзээ ч ирэхгүй (зөвхөн сүүлийн 4 тэмдэгт).
2. **Контент → Хичээл → ☁️ Bunny upload** дээр файлаа сонгоно. Сервер Bunny дээр видео үүсгээд TUS upload-ын signature (`SHA256(library + key + expire + videoId)`, 6 цаг хүчинтэй) өгнө; **файл браузерээс шууд Bunny руу** (resumable) upload хийгдэнэ — манай серверээр дамжихгүй, key браузерт очихгүй.
3. Хичээл `processing` төлөвтэй хадгалагдана. Bunny encode дуусахад **webhook** (Library → Webhook-д `/api/webhooks/bunny`) эсвэл Контент хуудасны 10 сек тутмын шалгалтаар `ready` болж, үргэлжлэх хугацаа, HLS URL (`playlist.m3u8`), MP4 fallback (`play_720p.mp4`) автоматаар бичигдэнэ.
4. App нь HLS-ээр тоглуулна (вэб дээр MP4 fallback); `processing` үед "Видео бэлтгэгдэж байна" гэж харуулна. MP4 fallback-д library-ийн **Enable MP4 Fallback** тохиргоо асаалттай байх хэрэгтэй.

## Дүрмүүд (даалгаварт тодорхойгүй байсан зүйлс)

- **Тэнцэх босго**: `passPercent` (default 60%) **ба түүнээс дээш** бол тэнцэнэ (5-аас 3 = 60% → тэнцэнэ).
- **XP**: хичээл = 10 XP (админ өөрчилж болно). Шалгалт = зөв хариулт бүрт 5 XP + тэнцсэн бонус 20 XP, **зөвхөн анх тэнцэхэд**. Унасан болон давтан өгсөн оролдлого 0 XP.
- **Түвшин**: 100 XP тутамд 1 түвшин (1-ээс эхэлнэ).
- **Streak**: `Asia/Ulaanbaatar` цагийн бүсээр, идэвхтэй (хичээл дуусгасан эсвэл шалгалт өгсөн) дараалсан өдрүүдийг тоолно. Өнөөдөр хараахан идэвхгүй ч өчигдөр идэвхтэй байсан бол streak хадгалагдана.
- **Курсын ахиц %** = (дууссан хичээл + тэнцсэн шалгалт) / (нийт хичээл + шалгалт).
- **Шалгалтын дундаж оноо** = өгсөн шалгалт бүрийн хамгийн өндөр онооны дундаж.
- **XP чансаа**: зөвхөн суралцагчид орно. Тэнцсэн XP-тэй хүмүүс ижил байр эзэлнэ (1, 2, 2, 4).

## Хийгээгүй / сайжруулах

- Login rate limiting, refresh token, нууц үг сэргээх
- Олон курс үүсгэх UI (API нь олон курс дэмждэг, UI нэг курсыг сонгож засна)
- Bunny-гийн token authentication (signed playback URL) — одоогоор library-ийн CDN нь нээлттэй гэж үзсэн
- Хичээл устгахад Bunny дээрх видеог автоматаар устгах
- Видео үзсэн хувийг серверт баталгаажуулах (90%-ийн дүрмийг клиент хэрэгжүүлнэ)
