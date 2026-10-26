import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { BaseHtml } from "./layout";
import * as sql from "./sql";

const lattice = (line: string, base: string) =>
  [
    `background-color:${base}`,
    `background-image:repeating-linear-gradient(45deg, ${line} 0 1px, transparent 1px 9px), repeating-linear-gradient(-45deg, ${line} 0 1px, transparent 1px 9px)`,
  ].join(";");

export const ProjectList = async () => {
  const projects = await sql.getProjects();

  return (
    <div id="project-list" class="mt-4 flex flex-col gap-4">
      {projects.map((proj) => (
        <a
          href={`/projects/${proj.id}`}
          class="flex w-full items-center justify-between border border-gray-300 px-4 py-4 text-left text-xl text-gray-100 hover:brightness-125"
          style={lattice("rgba(150,90,220,.35)", "#2a1240")}
        >
          <span>{proj.name}</span>
          <span class="text-gray-200">...</span>
        </a>
      ))}
    </div>
  );
};

export const NewProjectButton = () => (
  <div id="new-project-container" class="mt-6 flex justify-end">
    <button
      class="border border-gray-300 px-6 py-2 text-xl text-gray-100 hover:bg-white/10"
      hx-get="/projects/new-form"
      hx-target="#new-project-container"
      hx-swap="outerHTML"
    >
      + NEW
    </button>
  </div>
);

export const ProjectSelectPage = async ({ currentUser }: { currentUser: string }) => (
  <BaseHtml>
    <body class="bg-black p-6" style="font-family:'Patrick Hand',cursive">
      <div class="mx-auto max-w-3xl border border-gray-300 p-4">
        <header class="flex items-center justify-between border border-gray-300 px-6 py-4">
          <h1 class="text-2xl text-gray-100">StudentsPlangrid</h1>
          <span class="rounded-full border border-gray-300 px-4 py-1 text-sm text-gray-100">
            {currentUser.toUpperCase()}
          </span>
        </header>

        {/* WRAPPER ADDED HERE SO HTMX HAS A MATCHING TARGET ON PAGE LOAD */}
        <div id="project-section">
          <NewProjectButton />
          {await ProjectList()}
        </div>
      </div>
    </body>
  </BaseHtml>
);

export const projectRoutes = new Elysia()
  .get("/projects", async ({ cookie: { auth_user }, redirect }) => {
    const username = auth_user.value;
    if (!username) return redirect("/");

    return await ProjectSelectPage({ currentUser: username });
  })

  .get("/projects/new-form", () => (
    <form
      id="new-project-container"
      class="mt-6 flex items-center justify-end gap-2"
      hx-post="/projects"
      hx-target="#project-section"
      hx-swap="outerHTML"
    >
      <input
        type="text"
        name="name"
        placeholder="Building Name..."
        class="border border-gray-300 bg-black px-4 py-2 text-white"
        required
      />
      <button
        type="submit"
        class="border border-gray-300 bg-white/10 px-6 py-2 text-xl text-gray-100 hover:bg-white/20"
      >
        Save
      </button>
    </form>
  ))

  .post(
    "/projects",
    async ({ body }) => {
      const projectName = body.name.trim();
      let errorMessage: string | null = null;
      if (projectName && !(await sql.addProject(projectName))) {
        errorMessage = "Could not save project. Please try again.";
      }
      return (
        <div id="project-section">
          <NewProjectButton />
          {errorMessage && <p class="mt-2 text-red-400">{errorMessage}</p>}
          {await ProjectList()}
        </div>
      );
    },
    {
      body: t.Object({
        name: t.String(),
      }),
    }
  );
