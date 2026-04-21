# 🚀 Deploy Aura Academy on Vercel

## Guide en Darija/Français - كيفاش deployi علا Vercel

---

## الخطوة 1: سجل ف Vercel / Étape 1 : Inscrivez-vous sur Vercel

1. راح لـ **https://vercel.com** و سجل بحساب GitHub ديالك
2. (Sign up at https://vercel.com with your GitHub account)

---

## الخطوة 2: زاد قاعدة البيانات / Étape 2 : Créer la Base de Données

### Option A : Vercel Postgres (Neon) - الأسهل ⭐

1. فـ Vercel Dashboard، راح لـ **Storage** tab
2. كليكي علا **Create Database** > **Postgres (Neon)**
3. فال region اختار **eu-west-1** (أقرب للمغرب) أو **us-east-1**
4. ضع اسم ديال القاعدة (ex: `aura-academy`)
5. كليكي **Create**
6. Vercel غدي يزودلك 2 متغيرات تلقائيا:
   - `DATABASE_URL` (مع pgbouncer=true - للإنتاج)
   - `DIRECT_URL` (بدون pgbouncer - للـ migrations)

### Option B : Neon مباشرة / Direct Neon

1. راح لـ **https://neon.tech** و سجل
2. زاد مشروع جديد (Create Project)
3. اختار region: **eu-west-1** (Frankfurt)
4. خد الـ connection string:
   - Pooled connection → `DATABASE_URL` (ف Vercel زود `&pgbouncer=true`)
   - Direct connection → `DIRECT_URL`
5. فـ Vercel Dashboard > Settings > Environment Variables:
   - زاد `DATABASE_URL` مع القيمة
   - زاد `DIRECT_URL` مع القيمة

---

## الخطوة 3: ارفع الكود / Étape 3 : Upload le Code

### الطريقة 1: من GitHub (المفضلة) ⭐

1. ارفع الكود لـ GitHub repo جديد:
   ```bash
   cd aura-academy
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/aura-academy.git
   git push -u origin main
   ```

2. فـ Vercel Dashboard:
   - كليكي **"Add New..."** > **Project**
   - اختار الـ GitHub repo
   - Framework: **Next.js** (غيتعرف تلقائيا)
   - كليكي **Deploy**

### الطريقة 2: بالـ CLI

```bash
npm i -g vercel
cd aura-academy
vercel
```

### الطريقة 3: Drag & Drop

1. حمّل الـ zip ديال الكود
2. فك الضغط (unzip)
3. راح لـ https://vercel.com/new
4. اسحب المجلد و ضعه فالصفحة

---

## الخطوة 4: ضبط الـ Environment Variables / Étape 4 : Variables d'Environnement

فـ Vercel Dashboard > Your Project > **Settings** > **Environment Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgres://...?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | `postgres://...?sslmode=require` |

- اختار **Production**, **Preview**, و **Development** (الثلاثة)
- كليكي **Save**

---

## الخطوة 5: شغّل الـ Seed / Étape 5 : Exécuter le Seed

باش تزود البيانات الأساسية (admin, services, classrooms):

### بعد أول deploy ناجح:

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Link to your project (just once)
cd aura-academy
vercel link

# Pull env variables locally
vercel env pull .env.local

# Push schema to database
npx prisma db push

# Run seed
npx prisma db seed
```

أو من الـ Vercel Dashboard:
- Settings > General > **Connect to Database** > Execute SQL

---

## الخطوة 6: Redeploy / Étape 6 : Redéployer

بعد ما تشغل الـ seed، الـ deploy الجديد غيشتغل مع البيانات:

```bash
vercel --prod
```

أو من الـ Dashboard: **Deployments** > كليكي علا **...** > **Redeploy**

---

## 🔑 معلومات الدخول / Identifiants de Connexion

| Role | Email | Password |
|------|-------|----------|
| Admin | `auraadmin@gmail.com` | `admin123` |
| Secrétaire | `secr@gmail.com` | `secretary123` |

⚠️ **بعد ما تدخل، بدّل الباسوورد فورا!** (Change passwords immediately!)

---

## 💰 الأسعار / Tarifs

### Vercel (Hobby - مجاني):
- ✅ 100GB bandwidth / شهر
- ✅ Serverless functions
- ✅ Auto SSL
- ✅ Custom domain

### Neon (Free tier):
- ✅ 0.5 GB storage
- ✅ Enough for a small academy

### إذا بغيتي أكثر:
- Neon Pro: $19/شهر (10GB)
- Vercel Pro: $20/شهر

---

## 🛠️ ملاحظات مهمة / Notes Importantes

1. **الداتابيز** مابقاتش SQLite - دابا PostgreSQL (Neon)
2. **الملفات** (uploads) ماتخزنّاش فـ Vercel (ephemeral filesystem)
3. إذا بغيتي تزود upload ديال الصور، تحتاج:
   - Cloudinary (مجاني)
   - أو AWS S3
   - أو Vercel Blob
4. **الـ Sessions** كتخدم بـ cookies + database
5. الـ app كيدير auto-redeploy كي تشوف فـ GitHub

---

## ❓ المشاكل المتكررة / Problèmes Courants

### Build Failed - Prisma Error
```
Error: P1001: Can't reach database server
```
→ تأكد أن `DATABASE_URL` و `DIRECT_URL` صحيحين فـ Environment Variables

### الصفحة البيضاء / White Page
→ راجع الـ logs: Vercel Dashboard > Your Project > **Logs**

### Database Connection Timeout
→ زاد `&connect_timeout=30` فـ الـ DATABASE_URL

### want to run seed but getting errors
```bash
# Make sure you're using the correct DATABASE_URL
vercel env pull .env.local
npx prisma db push
npx prisma db seed
```

---

## 📱 Local Development (التطوير المحلي)

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/aura-academy.git
cd aura-academy

# Install
npm install

# Setup env
cp .env.example .env
# Edit .env with your Neon database URL

# Push schema
npx prisma db push

# Seed
npx prisma db seed

# Run
npm run dev
```

---

Made with ❤️ for Aura Academy - Béni Mellal 🇲🇦
