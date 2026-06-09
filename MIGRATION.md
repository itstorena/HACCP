## Come Eseguire la Migration SQL su Supabase

Copia ed esegui questo script nel **SQL Editor** di Supabase:

1. Vai su: https://supabase.com/dashboard/project/kqpguexaexwtfwizsaxq/sql
2. Incolla il contenuto del file `supabase/migrations/001_initial_schema.sql`
3. Clicca **Run**

Oppure usa la connessione diretta con la password del DB (disponibile in Project Settings → Database → Connection string):

```bash
supabase db push --db-url "postgresql://postgres.kqpguexaexwtfwizsaxq:[TUA-PASSWORD-DB]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

La password del database la trovi in:
Supabase Dashboard → Project Settings → Database → Connection string
