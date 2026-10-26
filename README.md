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
to see its description and attachments. The task page includes Edit and Delete
actions. Editing supports the name, description, assignee, status, and color;
leave the assignee blank to unassign a task. Sheet uploads are a separate feature.

Statuses are `todo`, `in_progress`, `done`, and `verified`. The existing `open`
status remains supported for older records.

Deletion asks for confirmation, removes the task's files from the `task-media`
bucket, then deletes the task. Attachment records are deleted by the schema's
foreign-key cascade. Storage and database operations are separate: if file cleanup
succeeds but the database delete fails, the task remains with a retry message;
some attachment files may already be gone. Retry to finish deleting the task.

To check the task routes:

```bash
bun test tests/views.test.ts
```

The tests use a local database API fixture and do not require Supabase credentials
or modify a real database.
