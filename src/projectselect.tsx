import { Elysia } from "elysia";
import * as elements from "typed-html";
import { BaseHtml } from "./layout";

const lattice = (line: string, base: string) =>
  [
    `background-color:${base}`,
    `background-image:repeating-linear-gradient(45deg, ${line} 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, ${line} 0 1px, transparent 1px 9px)`,
  ].join(";");

export const ProjectSelectPage = () => (
  <BaseHtml>
    <body class="bg-black p-6" style="font-family:'Patrick Hand',cursive">
      <div class="mx-auto max-w-3xl border border-gray-300 p-4">
        <header class="flex items-center justify-between border border-gray-300 px-6 py-4">
          <h1 class="text-2xl text-gray-100">StudentsPlangrid</h1>
          <span class="rounded-full border border-gray-300 px-4 py-1 text-sm text-gray-100">USER</span>
        </header>

        <div class="mt-6 flex justify-end">
          <button class="border border-gray-300 px-6 py-2 text-xl text-gray-100 hover:bg-white/10">+ NEW</button>
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <button
            class="flex w-full items-center justify-between border border-gray-300 px-4 py-4 text-left text-xl text-gray-100 hover:brightness-125"
            style={lattice("rgba(150,90,220,.35)", "#2a1240")}
          >
            <span>UMBC - Sondheim building</span>
            <span class="text-gray-200">...</span>
          </button>
          <button
            class="flex w-full items-center justify-between border border-gray-300 px-4 py-4 text-left text-xl text-gray-100 hover:brightness-125"
            style={lattice("rgba(40,150,90,.35)", "#04240f")}
          >
            <span>UMBC - Physics building</span>
            <span class="text-gray-200">...</span>
          </button>
        </div>
      </div>
    </body>
  </BaseHtml>
);

export const projectRoutes = new Elysia().get("/projects", () => <ProjectSelectPage />);
