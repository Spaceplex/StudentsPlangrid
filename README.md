# Students plangrid

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
```

## Styles

The UI uses Tailwind, built ahead of time into `public/app.css` (no CDN script).
Shared classes like `.btn`, `.card`, `.input` and `.badge` live in `src/styles.css`.

After changing classes in any page or client script, rebuild the CSS:

```bash
bun run css         # one-off build
bun run css:watch   # rebuild on save
bun run dev         # build css, then run the server with --watch
```

`public/app.css` is committed so the Docker build works without the Tailwind CLI.
