import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { BaseHtml } from "./layout";
import * as sql from "./sql";

const Diamond = ({ children, color }: { children?: string; color: string }) => (
  <div
    class={`mx-auto flex h-28 w-28 items-center justify-center border text-center text-sm ${color}`}
  >
    <span class="whitespace-pre-line leading-tight">{children}</span>
  </div>
);

const Tab = ({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children?: string;
}) => (
  <a
    href={href}
    class={`block border px-4 py-2 text-left text-lg ${
      active
        ? "border-blue-400 text-blue-400"
        : "border-orange-400 text-orange-400 hover:bg-white/10"
    }`}
  >
    {children}
  </a>
);

const BuildingList = ({
  projects,
  selectedId,
}: {
  projects: sql.Project[];
  selectedId: string;
}) => (
  <nav class="mt-8 flex flex-col gap-2">
    {projects.map((project) => (
      <Tab href={`/projects/${project.id}`} active={project.id === selectedId}>
        {project.name}
      </Tab>
    ))}
  </nav>
);

const SheetList = ({
  projectId,
  sheets,
  selectedId,
}: {
  projectId: string;
  sheets: sql.Sheet[];
  selectedId?: string;
}) => (
  <nav class="mt-8 flex flex-col gap-2">
    {sheets.length === 0 ? (
      <p class="text-sm text-gray-500">No floors yet.</p>
    ) : (
      sheets.map((sheet) => (
        <Tab
          href={`/projects/${projectId}?sheet=${sheet.id}`}
          active={sheet.id === selectedId}
        >
          {sheet.name}
        </Tab>
      ))
    )}
  </nav>
);

const TaskPanel = () => (
  <aside class="w-80 shrink-0 border border-green-400 p-4 text-green-400">
    <h2 class="text-xl uppercase tracking-wide">Task</h2>
    <div id="task-panel-body" class="mt-4">
      <p class="text-sm text-green-600">
        Select a task on the plan to see its details.
      </p>
    </div>
  </aside>
);

export const ProjectWorkspacePage = async ({
  currentUser,
  project,
  projects,
  sheets,
  selectedSheet,
  pdfUrl,
  tasks,
}: {
  currentUser: string;
  project: sql.Project;
  projects: sql.Project[];
  sheets: sql.Sheet[];
  selectedSheet?: sql.Sheet;
  pdfUrl?: string | null;
  tasks: sql.Task[];
}) => (
  <BaseHtml
    head={`<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />`}
  >
    <body
      class="min-h-screen bg-black p-6 text-gray-100"
    >
      <div class="mx-auto flex max-w-[96rem] gap-6">
        <aside class="flex w-72 shrink-0 flex-col border border-gray-300 p-5">
        {
          //<a href="/projects">
          //  <Diamond color="border-pink-400 text-pink-400">
          //    {"NEW\nBUILDING"}
          //  </Diamond>
          //</a>
        }

          {//await BuildingList({ projects, selectedId: project.id })\
          }

          {
          //<div class="my-8 border-t border-orange-400" />
          }

          <button
            id="btn-new-floor"
            type="button"
            data-building-id={project.id}
            class="block w-full bg-transparent"
          >
            <Diamond color="border-pink-400 text-pink-400">
              {"NEW\nFLOOR"}
            </Diamond>
          </button>
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            class="hidden"
          />

          {await SheetList({
            projectId: project.id,
            sheets,
            selectedId: selectedSheet?.id,
          })}
        </aside>

        <main class="min-w-0 flex-1">
          <header class="flex items-center justify-between border border-gray-300 px-6 py-4">
            <h1 class="text-2xl">{project.name}</h1>
            <div class="flex items-center gap-4">
              {selectedSheet && pdfUrl && (
                <button
                  id="btn-create-task"
                  type="button"
                  class="border border-green-400 px-4 py-2 text-green-400 hover:bg-green-400/10"
                >
                  + TASK
                </button>
              )}
              <span class="flex h-16 w-16 items-center justify-center rounded-full border border-green-400 text-xs text-green-400">
                {currentUser.toUpperCase()}
              </span>
            </div>
          </header>

          <section class="mt-6 overflow-auto bg-white p-4 text-black">
            {selectedSheet ? (
              pdfUrl ? (
                <div
                  id="floor-map"
                  class="h-[70vh] w-full"
                  data-pdf-url={pdfUrl}
                  data-sheet-id={selectedSheet.id}
                  data-current-user={currentUser}
                />
              ) : (
                <div class="flex min-h-[60vh] flex-col items-center justify-center">
                  <h2 class="text-3xl">{selectedSheet.name}</h2>
                  <p class="text-gray-500">Plan preview unavailable.</p>
                </div>
              )
            ) : (
              <p class="flex min-h-[60vh] items-center justify-center text-gray-500">
                Select a floor to view its plan.
              </p>
            )}
          </section>
        </main>

        <TaskPanel />
      </div>
      <script id="task-data" type="application/json">
        {JSON.stringify(tasks).replace(/</g, "\\u003c")}
      </script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="/workspace-client.js"></script>
    </body>
  </BaseHtml>
);

export const workspaceRoutes = new Elysia()
  .get(
    "/workspace-client.js",
    () =>
      new Response(Bun.file(`${import.meta.dir}/workspace-client.js`), {
        headers: { "content-type": "application/javascript" },
      }),
  )
  .get(
    "/projects/:id",
    async ({ params, query, cookie: { auth_user }, set }) => {
      const username = auth_user?.value as string | undefined;
      if (!username) {
        set.redirect = "/";
        return "";
      }

      const [project, projects] = await Promise.all([
        sql.getProject(params.id),
        sql.getProjects(),
      ]);

      if (!project) {
        set.status = 404;
        return <p>Project not found.</p>;
      }

      const sheets = await sql.getSheetsFromProject(project.id);
      const selectedSheet = sheets.find((sheet) => sheet.id === query.sheet);
      const [pdfUrl, tasks] = await Promise.all([
        selectedSheet ? sql.getSheetPdfUrl(selectedSheet.pdf_key) : null,
        selectedSheet ? sql.getTasksFromSheet(selectedSheet.id) : [],
      ]);

      return await ProjectWorkspacePage({
        currentUser: username,
        project,
        projects,
        sheets,
        selectedSheet,
        pdfUrl,
        tasks,
      });
    },
  )
  .post(
    "/projects/:id/sheets",
    async ({ params, body, cookie: { auth_user }, set }) => {
      const username = auth_user?.value as string | undefined;
      if (!username) {
        set.status = 401;
        return { error: "Not authenticated." };
      }

      const name = body.name.trim();
      if (!name) {
        set.status = 400;
        return { error: "Floor name is required." };
      }

      const project = await sql.getProject(params.id);
      if (!project) {
        set.status = 404;
        return { error: "Project not found." };
      }

      const pdfKey = await sql.uploadSheetPdf(project.id, body.file);
      if (!pdfKey) {
        set.status = 500;
        return { error: "Failed to upload PDF." };
      }

      const sheet = await sql.addSheet(project.id, {
        name,
        pdfKey,
        canvasSize: body.canvasSize || null,
      });
      if (!sheet) {
        set.status = 500;
        return { error: "Failed to save floor." };
      }

      return { id: sheet.id };
    },
    {
      body: t.Object({
        name: t.String(),
        canvasSize: t.Optional(t.String()),
        file: t.File(),
      }),
    },
  )
  .post(
    "/sheets/:sheetId/tasks",
    async ({ params, body, cookie: { auth_user }, set }) => {
      const username = auth_user?.value as string | undefined;
      if (!username) {
        set.status = 401;
        return { error: "Not authenticated." };
      }

      const name = body.name.trim();
      if (!name) {
        set.status = 400;
        return { error: "Task name is required." };
      }

      const task = await sql.createTask(params.sheetId, {
        name,
        description: body.description?.trim() ?? "",
        color: body.color || "#22c55e",
        status: body.status || "open",
        assigned_to: body.assigned_to?.trim() || null,
        created_by: username,
        x_coord: body.x_coord,
        y_coord: body.y_coord,
      });
      if (!task) {
        set.status = 500;
        return { error: "Failed to create task." };
      }

      return task;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        color: t.Optional(t.String()),
        status: t.Optional(t.String()),
        assigned_to: t.Optional(t.Union([t.String(), t.Null()])),
        x_coord: t.Number(),
        y_coord: t.Number(),
      }),
    },
  );
