import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { BaseHtml, UserChip, escapeHtml } from "./layout";
import * as sql from "./sql";

const SheetList = ({
  projectId,
  sheets,
  selectedId,
}: {
  projectId: string;
  sheets: sql.Sheet[];
  selectedId?: string;
}) => (
  <nav class="flex flex-col gap-1">
    {sheets.length === 0 ? (
      <p class="muted px-3 py-2">No floors yet.</p>
    ) : (
      sheets.map((sheet) => (
        <a
          href={`/projects/${projectId}?sheet=${sheet.id}`}
          class="nav-item"
          aria-current={sheet.id === selectedId ? "page" : "false"}
        >
          {escapeHtml(sheet.name)}
        </a>
      ))
    )}
  </nav>
);

const FilterBar = () => (
  <div class="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
    <input
      id="filter-search"
      type="search"
      placeholder="Search tasks"
      class="input w-48"
      aria-label="Search tasks"
    />
    <select id="filter-status" class="input w-auto" aria-label="Filter by status">
      <option value="">All statuses</option>
      <option value="open">Open</option>
      <option value="in_progress">In progress</option>
      <option value="done">Done</option>
    </select>
    <select id="filter-assignee" class="input w-auto" aria-label="Filter by assignee">
      <option value="">Anyone</option>
    </select>
    <label class="flex items-center gap-2 px-1 text-sm text-zinc-300">
      <input id="filter-mine" type="checkbox" class="accent-amber-500" />
      Mine only
    </label>
    <span id="filter-count" class="muted ml-auto" />
  </div>
);

const TaskPanel = () => (
  <aside class="card w-full shrink-0 overflow-y-auto lg:w-80">
    <section class="border-b border-zinc-800 p-4">
      <h2 class="section-title">Task</h2>
      <div id="task-panel-body" class="mt-3">
        <p class="muted">Select a task on the plan to see its details.</p>
      </div>
    </section>
    <section class="p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="section-title">Tasks</h2>
        <select id="task-sort" class="input w-auto py-1 text-xs" aria-label="Sort tasks">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="status">Status</option>
        </select>
      </div>
      <div id="task-list" class="mt-3 flex flex-col gap-1.5" />
    </section>
  </aside>
);

const ReportView = () => (
  <div
    id="report-view"
    class="fixed inset-0 z-[2000] hidden bg-zinc-950/80 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="report-title"
  >
    <div class="card mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden">
      <header class="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-3">
        <div>
          <h2 id="report-title" class="font-semibold">Project report</h2>
          <p id="report-status" class="muted">Building report...</p>
        </div>
        <button id="btn-report-close" type="button" class="btn">
          Close
        </button>
      </header>
      <iframe id="report-frame" title="Project report" class="w-full flex-1 bg-zinc-800"></iframe>
    </div>
  </div>
);

export const ProjectWorkspacePage = async ({
  currentUser,
  project,
  sheets,
  selectedSheet,
  pdfUrl,
  tasks,
}: {
  currentUser: string;
  project: sql.Project;
  sheets: sql.Sheet[];
  selectedSheet?: sql.Sheet;
  pdfUrl?: string | null;
  tasks: sql.Task[];
}) => (
  <BaseHtml
    title={project.name}
    head={`<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />`}
  >
    <body class="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-800 bg-zinc-900/60 px-5 py-3">
        <div class="flex min-w-0 items-center gap-3">
          <a href="/projects" class="btn btn-ghost btn-sm">
            ← Buildings
          </a>
          <h1 id="project-name" class="truncate text-lg font-semibold">
            {escapeHtml(project.name)}
          </h1>
        </div>
        <div class="flex items-center gap-2">
          <button
            id="btn-report"
            type="button"
            class="btn"
            data-project-id={project.id}
            data-current-user={currentUser}
          >
            Report
          </button>
          {selectedSheet && pdfUrl ? (
            <button id="btn-create-task" type="button" class="btn btn-primary">
              + Task
            </button>
          ) : (
            ""
          )}
          <UserChip name={currentUser} />
        </div>
      </header>

      <div class="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        <aside class="card flex w-full shrink-0 flex-col gap-3 p-3 lg:w-60">
          <h2 class="section-title px-1 pt-1">Floors</h2>
          <button
            id="btn-new-floor"
            type="button"
            data-building-id={project.id}
            class="btn w-full"
          >
            + New floor
          </button>
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            class="hidden"
          />

          <div class="min-h-0 flex-1 overflow-y-auto">
            {await SheetList({
              projectId: project.id,
              sheets,
              selectedId: selectedSheet?.id,
            })}
          </div>

          <button
            id="btn-delete-building"
            type="button"
            data-building-id={project.id}
            class="btn btn-danger btn-sm"
          >
            Delete building
          </button>
        </aside>

        <main class="card flex min-h-[60vh] min-w-0 flex-1 flex-col overflow-hidden">
          {selectedSheet ? (
            <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <h2 id="sheet-name" class="truncate font-medium">
                {escapeHtml(selectedSheet.name)}
              </h2>
              <div class="flex items-center gap-2">
                {pdfUrl ? (
                  <button id="btn-export-map" type="button" class="btn btn-sm">
                    Export map
                  </button>
                ) : (
                  ""
                )}
                <button
                  id="btn-delete-floor"
                  type="button"
                  data-sheet-id={selectedSheet.id}
                  data-building-id={project.id}
                  class="btn btn-danger btn-sm"
                >
                  Delete floor
                </button>
              </div>
            </div>
          ) : (
            ""
          )}
          {selectedSheet && pdfUrl ? <FilterBar /> : ""}

          <section class="relative min-h-0 flex-1 bg-zinc-950 p-2">
            {selectedSheet ? (
              pdfUrl ? (
                <div
                  id="floor-map"
                  class="h-[60vh] w-full lg:h-full"
                  data-pdf-url={pdfUrl}
                  data-sheet-id={selectedSheet.id}
                  data-current-user={currentUser}
                >
                  <p class="muted flex h-full items-center justify-center">
                    Loading plan...
                  </p>
                </div>
              ) : (
                <div class="flex h-full min-h-[50vh] flex-col items-center justify-center gap-1">
                  <h2 class="text-xl font-medium">{escapeHtml(selectedSheet.name)}</h2>
                  <p class="muted">Plan preview unavailable.</p>
                </div>
              )
            ) : (
              <div class="flex h-full min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
                <p class="font-medium">No floor selected</p>
                <p class="muted">
                  {sheets.length === 0
                    ? "Upload a floor plan PDF with + New floor to get started."
                    : "Pick a floor on the left to view its plan."}
                </p>
              </div>
            )}
          </section>
        </main>

        <TaskPanel />
      </div>

      <ReportView />

      <script id="task-data" type="application/json">
        {JSON.stringify(tasks).replace(/</g, "\\u003c")}
      </script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
      <script src="/map-export.js"></script>
      <script src="/report-client.js"></script>
      <script src="/workspace-client.js"></script>
    </body>
  </BaseHtml>
);

export const workspaceRoutes = new Elysia()
  .get(
    "/projects/:id",
    async ({ params, query, cookie: { auth_user }, set }) => {
      const username = auth_user?.value as string | undefined;
      if (!username) {
        set.redirect = "/";
        return "";
      }

      const project = await sql.getProject(params.id);

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
  )
  .patch(
    "/tasks/:taskId",
    async ({ params, body, set }) => {
      const name = body.name.trim();
      if (!name) {
        set.status = 400;
        return { error: "Task name is required." };
      }

      const task = await sql.updateTask(params.taskId, {
        name,
        description: body.description.trim(),
        color: body.color,
        status: body.status,
        assigned_to: body.assigned_to?.trim() || null,
      });
      if (!task) {
        set.status = 404;
        return { error: "Task not found." };
      }

      return task;
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.String(),
        color: t.String(),
        status: t.String(),
        assigned_to: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  .delete("/tasks/:taskId", async ({ params, set }) => {
    const deleted = await sql.deleteTaskWithAttachments(params.taskId);
    if (!deleted) {
      set.status = 404;
      return { error: "Task not found or could not be deleted." };
    }
    return { deleted: true };
  })
  .delete("/sheets/:sheetId", async ({ params, cookie: { auth_user }, set }) => {
    if (!auth_user?.value) {
      set.status = 401;
      return { error: "Not authenticated." };
    }
    const deleted = await sql.deleteSheet(params.sheetId);
    if (!deleted) {
      set.status = 404;
      return { error: "Floor not found or could not be deleted." };
    }
    return { deleted: true };
  })
  .delete("/projects/:id", async ({ params, cookie: { auth_user }, set }) => {
    if (!auth_user?.value) {
      set.status = 401;
      return { error: "Not authenticated." };
    }
    const deleted = await sql.deleteProject(params.id);
    if (!deleted) {
      set.status = 404;
      return { error: "Building not found or could not be deleted." };
    }
    return { deleted: true };
  })
  .get("/projects/:id/report-data", async ({ params, cookie: { auth_user }, set }) => {
    if (!auth_user?.value) {
      set.status = 401;
      return { error: "Not authenticated." };
    }
    const project = await sql.getProject(params.id);
    if (!project) {
      set.status = 404;
      return { error: "Project not found." };
    }

    const sheets = await sql.getSheetsFromProject(project.id);
    const floors = await Promise.all(
      sheets.map(async (sheet) => ({
        id: sheet.id,
        name: sheet.name,
        pdfUrl: await sql.getSheetPdfUrl(sheet.pdf_key),
        tasks: await sql.getTasksFromSheet(sheet.id),
      })),
    );
    return { project: { id: project.id, name: project.name }, floors };
  });
