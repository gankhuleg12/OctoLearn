# OctoLearn

Video course платформын prototype: Duolingo маягийн сургалтын зам, богино видео хичээл, 5 хичээл тутамд шалгалт, XP/streak/статистик.

| Хэсэг | Технологи | Дэлгэрэнгүй |
|---|---|---|
| [`mobile/`](mobile/) | React Native (Expo SDK 58) + TypeScript, Expo Router, Zustand, expo-video, Reanimated | [mobile/README.md](mobile/README.md) |
| [`backend/`](backend/) | Node.js + TypeScript + Express 5, PostgreSQL (эсвэл суулгалтгүй PGlite), JWT, zod | [backend/README.md](backend/README.md) |

Backend нь **app REST API** болон **админ веб панел** (хэрэглэгч хянах, XP чансаа, бүлэг/хичээл/шалгалт удирдах) хоёрыг агуулна.

## Хурдан эхлэх

```bash
# 1. Backend — http://localhost:4000 (админ: admin@octolearn.mn / admin1234)
cd backend && npm install && npm run dev

# 2. App — шинэ terminal дээр
cd mobile && npm install && npm start      # Expo Go, эсвэл `npm run web`
```

App дээр **"Demo-гоор турших"** дарвал `demo@octolearn.mn / demo1234`-ээр нэвтэрнэ.

## Хийсэн зүйлс

- **P0:** pathway (zigzag, 3 төлөв, шалгалтын цэг, түгжээний мэдэгдэл), прогресс бар + XP, видео хичээл (тоглуулах/гүйлгэх, ≥ 90% үзсэний дараа "Дуусгах", +XP feedback), MCQ шалгалт (ногоон/улаан, үр дүн, дахин өгөх, ≥ 60% тэнцэнэ), профайлын статистик, доод навигаци, ахиц хадгалалт
- **P1:** идэвхтэй хичээл рүү автоматаар гүйлгэх, streak, анимэйшнтэй прогресс бар, бүтэн дэлгэцийн видео, түвшин, ахиц reset
- **P2:** Node.js API + PostgreSQL, нэвтрэлт (имэйл + нууц үг, JWT), streak/түвшний логик, dark mode, вэб хувилбар (Expo Web), backend unit/integration тест (39), офлайн үед кэшээр харуулах, Zustand state management, XP чансаа, 7 хоногийн идэвхийн график, админ панел

## Даалгаварт тодорхойгүй байсан шийдвэрүүд

Дэлгэрэнгүйг [backend/README.md](backend/README.md#дүрмүүд-даалгаварт-тодорхойгүй-байсан-зүйлс)-ээс үзнэ үү. Товчоор: тэнцэх босго ≥ 60%; хичээл 10 XP, шалгалтын XP (зөв хариулт бүрт 5 + бонус 20) зөвхөн анх тэнцэхэд олгоно; 100 XP = 1 түвшин; streak-ийг Улаанбаатарын цагаар тоолно; "90% үзсэн" нь бодитоор үзсэн хугацаа (seek тоологдохгүй).
