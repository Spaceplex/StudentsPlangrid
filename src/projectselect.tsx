import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { BaseHtml, UserChip } from "./layout";
import * as sql from "./sql";

export const ProjectList = async () => {
  const projects = await sql.getProjects();

  return (
    <div id="project-list" class="mt-4 grid gap-3 sm:grid-cols-2">
      {projects.length === 0 ? (
        <p class="muted col-span-full rounded-xl border border-dashed border-zinc-800 p-8 text-center">
          No buildings yet. Add one to get started.
        </p>
      ) : (
        projects
          .map((proj) => (
            <a
              href={`/projects/${proj.id}`}
              class="card group flex items-center justify-between px-5 py-4 transition-colors duration-150 hover:border-zinc-600 hover:bg-zinc-800/60"
            >
              <span class="truncate font-medium">{proj.name}</span>
              <span class="text-zinc-500 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent">
                →
              </span>
            </a>
          ))
      )}
    </div>
  );
};

export const NewProjectButton = () => (
  <div id="new-project-container" class="flex justify-end">
    <button
      class="btn btn-primary"
      hx-get="/projects/new-form"
      hx-target="#new-project-container"
      hx-swap="outerHTML"
    >
      + New building
    </button>
  </div>
);

export const ProjectSelectPage = async ({ currentUser }: { currentUser: string }) => (
  <BaseHtml title="Buildings">
    <body class="min-h-screen">
      <header class="border-b border-zinc-800 bg-zinc-900/60">
        <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span class="font-semibold">StudentsPlangrid</span>
          <UserChip name={currentUser} />
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-10">
        <div class="mb-6">
          <h1 class="text-2xl font-semibold">Buildings</h1>
          <p class="muted mt-1">Pick a building to open its floor plans and tasks.</p>
        </div>

        {/* WRAPPER ADDED HERE SO HTMX HAS A MATCHING TARGET ON PAGE LOAD */}
        <div id="project-section">
          <NewProjectButton />
          {await ProjectList()}
        </div>
      </main>
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
      class="flex items-center justify-end gap-2"
      hx-post="/projects"
      hx-target="#project-section"
      hx-swap="outerHTML"
    >
      <input
        type="text"
        name="name"
        placeholder="Building name"
        class="input max-w-xs"
        required
        autofocus
      />
      <button type="submit" class="btn btn-primary">
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
          {errorMessage && <p class="mt-3 text-sm text-red-400">{errorMessage}</p>}
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
