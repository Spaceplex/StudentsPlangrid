import * as elements from "typed-html";
import { BaseHtml } from "./layout";

// typed-html escapes attributes, but leaves text children unchanged.
export const escapeHtml = (text: string) => text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export const ViewPage = ({ title, backHref, backLabel, children }: {
  title: string;
  backHref: string;
  backLabel: string;
  children?: JSX.Element | JSX.Element[];
}) => (
  <BaseHtml>
    <body class="bg-black p-4 text-gray-100 sm:p-6" style="font-family:'Patrick Hand',cursive">
      <main class="mx-auto max-w-3xl border border-gray-300 p-4 sm:p-6">
        <a href={backHref} class="text-violet-300 underline">{escapeHtml(backLabel)}</a>
        <h1 class="my-4 break-words text-3xl">{escapeHtml(title)}</h1>
        {children}
      </main>
    </body>
  </BaseHtml>
);

export const MessagePage = ({ title, message }: { title: string; message: string }) => (
  <ViewPage title={title} backHref="/projects" backLabel="Back to projects">
    <p>{escapeHtml(message)}</p>
  </ViewPage>
);

export const TaskColor = ({ color }: { color: string }) => (
  <span class="inline-flex items-center gap-2 whitespace-nowrap">
    {/^#[0-9a-f]{6}$/i.test(color) ? (
      <span class="inline-block h-4 w-4 rounded-full border border-gray-300" style={`background-color:${color}`} aria-hidden="true"></span>
    ) : ""}
    {escapeHtml(color)}
  </span>
);
