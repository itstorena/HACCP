# HACCP Digital Register

Applicativo Next.js per digitalizzare i registri HACCP di un ristorante: ricevimento merci, lotti interni con QR, abbattitore, temperature, controlli operativi, non conformita e report manager.

## Stack

- Next.js 16 App Router
- React 19
- Supabase PostgreSQL, Auth, Realtime e RLS
- Zustand per sessione kiosk staff
- React Hook Form e Zod
- CSS custom, senza Tailwind

## Avvio locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`.

## Environment

Copia `.env.local.example` in `.env.local` e imposta:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Database

Esegui in Supabase SQL Editor, in ordine:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_haccp_operating_system.sql`

Vedi `MIGRATION.md`.

## Aree principali

- `/login` e `/dashboard`: kiosk staff con PIN.
- `/fornitori`: ricevimento merci, DDT, temperatura, accettazione/rifiuto.
- `/lotti`: preparazioni interne, QR, allergeni e collegamento materie prime.
- `/abbattimento`: cicli abbattitore con profili HACCP configurabili.
- `/temperature`: registro frigo/freezer/attrezzature e NC automatiche.
- `/controlli`: pulizie, olio, infestanti, allergeni, manutenzione, formazione.
- `/non-conformita`: segnalazione operativa problemi.
- `/manager`: dashboard manager protetta da Supabase Auth.
- `/manager/piano-haccp`: piano HACCP, CCP/PRP, profili e attrezzature.
- `/manager/non-conformita`: gestione e chiusura NC.
- `/manager/report`: report mensile stampabile.

## Note HACCP

I limiti critici sono configurabili nel piano HACCP e nei profili abbattitore. Devono essere validati dal responsabile HACCP o consulente dell'attivita prima dell'uso in produzione.
