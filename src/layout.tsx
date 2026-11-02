import * as elements from "typed-html";

type BaseHtmlProps = {
  children?: string | Promise<string> | string[];
  head?: string;
  title?: string;
};

// typed-html does not escape text children, so user-entered names go through this.
export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const UserChip = ({ name }: { name: string }) => (
  <span class="inline-flex items-center gap-2 rounded-full border border-zinc-700 p-1 text-sm sm:pr-3 text-zinc-300">
    <span class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-zinc-950">
      {escapeHtml(name.slice(0, 1).toUpperCase())}
    </span>
    <span class="hidden sm:inline">{escapeHtml(name)}</span>
  </span>
);

export const BaseHtml =({ children, head = "", title }: BaseHtmlProps) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title ? `${escapeHtml(title)} · StudentsPlangrid` : "StudentsPlangrid"}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    ${head}
    <link rel="stylesheet" href="/app.css">
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.1/dist/htmx.min.js"></script>
  </head>
  ${children}
`;
