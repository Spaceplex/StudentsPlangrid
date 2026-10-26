# Students plangrid

To install dependencies:

```bash
bun install
```

To run:

Create a `.env` file with your existing Supabase connection settings:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-server-key
```

The database should use `supabase/schema.sql`. Keep the server key out of source control.

```bash
bun run src/index.tsx
```

Open `http://localhost:3000`. Select a project, select a sheet, then click a task
to see its description and attachments. These pages show existing database records;
sheet uploads and task editing are separate features.

To check the viewing routes:

```bash
bun test tests/views.test.ts
```

The tests use a local database API fixture and do not require Supabase credentials
or modify a real database.
