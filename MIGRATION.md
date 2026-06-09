## Come Eseguire la Migration SQL su Supabase

Copia ed esegui questi script nel **SQL Editor** di Supabase, in ordine:

1. Vai su: https://supabase.com/dashboard/project/kqpguexaexwtfwizsaxq/sql
2. Incolla il contenuto del file `supabase/migrations/001_initial_schema.sql`
3. Clicca **Run**
4. Incolla il contenuto del file `supabase/migrations/002_haccp_operating_system.sql`
5. Clicca **Run**

La migration `002_haccp_operating_system.sql` aggiunge:
- piano HACCP con CCP/PRP, limiti critici e azioni correttive;
- profili abbattitore configurabili;
- attrezzature e registro temperature;
- controlli operativi per pulizie, allergeni, infestanti, manutenzione, olio e formazione;
- tracciabilità ingredienti-lotti;
- registro non conformità e audit trail.

Oppure usa la connessione diretta con la password del DB (disponibile in Project Settings → Database → Connection string):

```bash
supabase db push --db-url "postgresql://postgres.kqpguexaexwtfwizsaxq:[TUA-PASSWORD-DB]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

La password del database la trovi in:
Supabase Dashboard → Project Settings → Database → Connection string
