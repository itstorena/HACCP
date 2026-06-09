# HACCP Digital — Documentazione Progetto

> **Aggiornato automaticamente ad ogni modifica.** Questo file è la fonte di verità del progetto.

---

## 📌 Panoramica

App Next.js 16 (App Router) per la digitalizzazione dei registri HACCP in un ristorante. Gestisce:
- 📦 **Tracciabilità fornitori** (lotti in ingresso)
- 🏷️ **Lotti interni** con etichette QR code stampabili
- 🧊 **Abbattitore termico** con timer realtime e verifica conformità
- 🌡️ **Registro temperature** frigo/freezer/attrezzature con non conformità automatiche
- 🧽 **Controlli operativi** pulizie, allergeni, infestanti, olio, manutenzione, formazione
- ⚠️ **Non conformità** con azioni correttive e chiusura manager
- 📋 **Piano HACCP** con CCP/PRP e profili abbattitore configurabili
- 👤 **Autenticazione staff** via PIN numerico (bcrypt)
- 📊 **Dashboard manager** con KPI e report mensile stampabile

---

## 🏗️ Architettura

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Next.js 16 (App Router) |
| Styling | Vanilla CSS (no Tailwind) — Design system custom |
| Backend | Supabase (PostgreSQL + Realtime + RLS) |
| Auth staff | PIN numerico + bcryptjs (sessionStorage) |
| Auth manager | Supabase Auth + `proxy.ts` |
| State | Zustand (staffStore, toastStore) |
| Forms | React Hook Form + Zod |
| QR Code | qrcode (generazione) + html5-qrcode (scansione camera) |

---

## 📁 Struttura File

```
haccp-app/
├── app/
│   ├── (kiosk)/                    # Layout kiosk (full-screen, touch)
│   │   ├── layout.tsx              # Kiosk layout con nav laterale
│   │   ├── login/page.tsx          # Login PIN staff (avatar grid)
│   │   ├── dashboard/page.tsx      # Hub principale con KPI
│   │   ├── fornitori/
│   │   │   ├── page.tsx            # Lista lotti fornitore (realtime)
│   │   │   └── nuovo/page.tsx      # Form nuovo fornitore (Zod)
│   │   ├── lotti/
│   │   │   ├── page.tsx            # Lista lotti interni + QR modal
│   │   │   ├── nuovo/page.tsx      # Form nuovo lotto + validità preset
│   │   │   └── scansiona/page.tsx  # Scanner QR via camera (html5-qrcode)
│   │   └── abbattimento/
│   │       ├── page.tsx            # Dashboard cicli + countdown realtime
│   │       ├── nuovo/page.tsx      # Avvia ciclo abbattitore
│   │       └── [id]/chiudi/page.tsx # Chiudi ciclo + verifica conformità
│   ├── (dashboard)/                # Layout dashboard manager
│   │   ├── layout.tsx              # Sidebar manager
│   │   └── manager/
│   │       ├── page.tsx            # Dashboard KPI
│   │       ├── staff/page.tsx      # Gestione staff + creazione
│   │       └── report/page.tsx     # Report mensile HACCP (stampabile)
│   ├── api/
│   │   ├── pin-login/route.ts      # POST: verifica PIN + restituisce staff
│   │   ├── qr/[token]/route.ts     # GET: lookup lotto da token QR
│   │   └── hash-pin/route.ts       # POST: hash PIN per creazione staff
│   └── globals.css                 # Design system completo (600+ righe)
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Supabase browser client
│   │   ├── server.ts               # Supabase server client (SSR)
│   │   └── admin.ts                # Supabase admin client (service role)
│   ├── auth/
│   │   └── pin.ts                  # hashPin() + verifyPin() con bcryptjs
│   └── utils/
│       ├── compliance.ts           # checkBlastCompliance() + getBatchExpiryStatus()
│       └── formatting.ts           # formatDate(), formatTemp(), RISK_LABELS ecc.
├── store/
│   ├── staffStore.ts               # Zustand: session staff corrente (persist)
│   └── toastStore.ts               # Zustand: toast notifications
├── types/
│   └── database.ts                 # Tipi TypeScript generati dallo schema Supabase
├── components/
│   └── ui/
│       └── Toast.tsx               # Componente toast UI animato
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema SQL completo + RLS + realtime
├── .env.local                      # Credenziali Supabase (gitignored)
├── .env.local.example              # Template variabili d'ambiente
├── MIGRATION.md                    # Guida esecuzione manuale migration SQL
├── next.config.ts                  # Configurazione Next.js
└── PROJECT.md                      # Questo file
```

---

## 🗄️ Schema Database

### Tabelle principali

| Tabella | Descrizione | Realtime |
|---------|-------------|----------|
| `staff_members` | Personale con PIN hash | ✅ |
| `supplier_batches` | Lotti fornitori in ingresso | ✅ |
| `internal_batches` | Preparazioni interne con QR token | ✅ |
| `blast_chiller_logs` | Cicli abbattitore termico | ✅ |
| `temperature_logs` | Registrazioni temperature equipment | ✅ |
| `haccp_plan_items` | Piano HACCP, CCP/PRP, limiti e azioni | - |
| `blast_chiller_profiles` | Profili abbattitore configurabili | - |
| `equipment` | Attrezzature monitorate | - |
| `operational_checks` | Pulizie, allergeni, infestanti, olio, manutenzioni | ✅ |
| `non_conformities` | Non conformità e azioni correttive | ✅ |
| `internal_batch_ingredients` | Collegamento lotti interni ↔ lotti fornitore | - |
| `audit_logs` | Audit trail applicativo | - |

### Regole di conformità abbattitore (Reg. CE 853/2004)
- **Positivo (+3°C):** Da +70°C → +3°C in max 90 minuti
- **Negativo (-18°C):** Da +70°C → -18°C in max 240 minuti

---

## 🚀 Setup & Avvio

### Prerequisiti
- Node.js 18+
- Account Supabase (già configurato)

### 1. Clonare e installare
```bash
cd c:\Users\Francesco\Desktop\HACCP\haccp-app
npm install
```

### 2. Variabili d'ambiente
Le credenziali sono già in `.env.local`. Template in `.env.local.example`.

### 3. Eseguire Migration SQL ⚠️
> Le migration devono essere eseguite manualmente via Supabase SQL Editor.
> Vedi [MIGRATION.md](./MIGRATION.md) per istruzioni dettagliate.
>
> URL: https://supabase.com/dashboard/project/kqpguexaexwtfwizsaxq/sql

### 4. Avviare il server dev
```bash
npm run dev
```
Apri: http://localhost:3000

### 5. Login
- Vai su `/login`
- Seleziona staff e inserisci PIN (default: 1234 per i seed data)
- Per il manager: `/manager`

---

## 🎨 Design System

Il design usa un tema **Kiosk Dark Navy/Amber**:

| Token CSS | Valore |
|-----------|--------|
| `--color-background` | `#0A0E1A` (Navy scuro) |
| `--color-surface` | `#111827` |
| `--color-primary` | `#F59E0B` (Amber) |
| `--color-success` | `#10B981` |
| `--color-danger` | `#EF4444` |
| `--color-warning` | `#F59E0B` |

**Font:** Inter (Google Fonts), peso 400/600/700/800  
**Touch targets:** Minimo 56px per Kiosk  
**Glassmorphism:** `backdrop-filter: blur(20px)` sulle card  

---

## 🔐 Autenticazione

### Staff (Kiosk)
1. Staff seleziona il suo avatar nella schermata login
2. Inserisce PIN (4-6 cifre) nel tastierino numerico
3. Il PIN viene verificato via `POST /api/pin-login` (bcrypt compare server-side)
4. La sessione viene salvata in `staffStore` (Zustand + sessionStorage)
5. Ogni navigazione del kiosk legge `currentStaff` dallo store

### Manager (Dashboard)
- Route group `(dashboard)` con layout sidebar separato
- TODO: aggiungere `middleware.ts` per proteggere le route manager

---

## 📡 Realtime

Supabase Realtime è abilitato su:
- `supplier_batches`
- `internal_batches`
- `blast_chiller_logs`
- `temperature_logs`

Pattern usato:
```typescript
const channel = supabase
  .channel('table-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tablename' }, (payload) => {
    // gestione INSERT/UPDATE/DELETE
  })
  .subscribe()
```

---

## 📋 API Routes

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/pin-login` | POST | Verifica PIN staff, ritorna dati staff |
| `/api/qr/[token]` | GET | Lookup lotto interno da token QR |
| `/api/hash-pin` | POST | Hash PIN per creazione nuovo staff |

---

## ✅ Conformità HACCP

Il modulo `lib/utils/compliance.ts` implementa:
- `checkBlastCompliance(cycleType, startTime, endTime, endTemp)` → boolean
- `getBatchExpiryStatus(expiresAt)` → 'ok' | 'expiring' | 'expired'
- `BLAST_CYCLE_TARGETS` con target regolamentari

---

## 🔮 TODO / Prossimi Sviluppi

- [x] Proxy Next.js per proteggere route `/manager`
- [x] Supabase Auth per manager (email + password)
- [x] Piano HACCP operativo con CCP/PRP
- [x] Registro temperature con non conformità automatiche
- [x] Registro controlli operativi
- [x] Gestione non conformità
- [ ] Edge Function `close-blast-cycle` per chiusura automatica
- [ ] Notifiche push per scadenze e non conformità
- [ ] Esportazione PDF report (jsPDF o React-PDF)
- [ ] Grafici dashboard manager (Recharts)
- [ ] Modalità offline (Service Worker + IndexedDB)
- [ ] Test E2E (Playwright)
- [ ] Audit trail automatico via trigger DB

---

## 👨‍💻 Per Continuare il Progetto

> Questo file è pensato per essere letto da qualsiasi AI o sviluppatore che riprenda il progetto.

**Stack principale:** Next.js 16 App Router, Supabase, Zustand, Zod, Vanilla CSS  
**Pattern chiave:** Route groups `(kiosk)` e `(dashboard)`, Supabase Realtime subscriptions, bcrypt PIN auth  
**Conversazione originale:** Session ID `e3dda721-daf2-4404-b7f0-a8d3b7707edb`

---

*Ultimo aggiornamento: 2026-06-09 — Generato da Antigravity AI*
