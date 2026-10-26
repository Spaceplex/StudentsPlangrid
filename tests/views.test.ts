import { afterAll, afterEach, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { html } from "@elysiajs/html";

const projectId = "11111111-1111-4111-8111-111111111111";
const sheetId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const project = { id: projectId, name: "Sherman <Hall> & Annex" };
const sheet = { id: sheetId, building_id: projectId, name: "First floor" };
const task = {
  id: taskId, sheet_id: sheetId, name: "Fix <door>", status: "in_progress",
  description: 'First line\n<script>alert("test")</script>', assigned_to: null,
  color: "#FF0000", created_by: "alice", created_at: "2026-10-26T12:00:00Z",
};
const attachments = [
  { id: "photo", task_id: taskId, file_key: "door.png", original_name: 'Door "before".png', media_type: "image/png" },
  { id: "report", task_id: taskId, file_key: "report.pdf", original_name: "Report <draft>.pdf", media_type: "application/pdf" },
];

let emptyTable = "";
let failingTable = "";

// Exercise the real Supabase queries against a local PostgREST fixture.
const database = Bun.serve({
  port: 0,
  fetch(request) {
    const url = new URL(request.url);
    const table = url.pathname.split("/").pop();
    if (table === failingTable) {
      return Response.json({ message: "Database unavailable", code: "XX000" }, { status: 500 });
    }
    const id = url.searchParams.get("id")?.replace(/^eq\./, "");
    if (id === "invalid") {
      return Response.json({ message: "Invalid UUID", code: "22P02" }, { status: 400 });
    }
    let rows: Record<string, unknown>[] = table === "buildings" ? [project]
      : table === "sheets" ? [sheet] : table === "tasks" ? [task]
      : table === "attachments" ? attachments : [];
    if (table === emptyTable) rows = [];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) rows = rows.filter((row) => row[key] === value.slice(3));
    }
    return Response.json(rows);
  },
});
process.env.SUPABASE_URL = database.url.origin;
process.env.SUPABASE_KEY = "local-test-key";
const { projectRoutes } = await import("../src/projectselect");
const { sheetRoutes } = await import("../src/sheetRoutes");
const { taskRoutes } = await import("../src/taskRoutes");
const app = new Elysia().use(html()).use(projectRoutes).use(sheetRoutes).use(taskRoutes);
const get = (path: string) => app.handle(new Request(`http://localhost${path}`));

afterEach(() => { emptyTable = ""; failingTable = ""; });
afterAll(() => database.stop(true));

test("project links lead to sheets, tasks, details, and back", async () => {
  const projects = await app.handle(new Request("http://localhost/projects", {
    headers: { cookie: "auth_user=alice" },
  }));
  expect(projects.status).toBe(200);
  expect(await projects.text()).toContain(`href="/projects/${projectId}"`);

  const projectPage = await get(`/projects/${projectId}`);
  expect(projectPage.status).toBe(200);
  expect(projectPage.headers.get("content-type")).toContain("text/html");
  const projectHtml = await projectPage.text();
  expect(projectHtml).toContain(`href="/sheets/${sheetId}/tasks"`);
  expect(projectHtml).toContain("Sherman &lt;Hall&gt; &amp; Annex");

  const list = await get(`/sheets/${sheetId}/tasks`);
  expect(list.status).toBe(200);
  const listHtml = await list.text();
  expect(listHtml).toContain(`href="/projects/${projectId}"`);
  expect(listHtml).toContain(`href="/tasks/${taskId}"`);
  expect(listHtml).toContain("Unassigned");
  expect(listHtml).toContain("Fix &lt;door&gt;");
  expect(listHtml).toContain("in_progress");

  const detail = await get(`/tasks/${taskId}`);
  expect(detail.status).toBe(200);
  const detailHtml = await detail.text();
  expect(detailHtml).toContain(`href="/sheets/${sheetId}/tasks"`);
  expect(detailHtml).toContain("First line\n&lt;script&gt;");
  expect(detailHtml).not.toContain('<script>alert("test")</script>');
  expect(detailHtml).toContain('datetime="2026-10-26T12:00:00.000Z"');
  expect(detailHtml).toContain('alt="Door &quot;before&quot;.png"');
  expect(detailHtml).toContain("Report &lt;draft&gt;.pdf");
  expect(detailHtml).toContain("/storage/v1/object/public/task-media/report.pdf");
  expect(detailHtml.match(/<img /g)).toHaveLength(1);
});

test("empty sheets, tasks, and attachments have distinct messages", async () => {
  emptyTable = "sheets";
  expect(await (await get(`/projects/${projectId}`)).text()).toContain("No sheets yet.");
  emptyTable = "tasks";
  expect(await (await get(`/sheets/${sheetId}/tasks`)).text()).toContain("No tasks on this sheet yet.");
  emptyTable = "attachments";
  expect(await (await get(`/tasks/${taskId}`)).text()).toContain("No attachments yet.");
});

test("blank descriptions and invalid colors render safely", async () => {
  const originalDescription = task.description;
  const originalColor = task.color;
  task.description = "   ";
  task.color = "red;background-image:url(bad)";
  try {
    const body = await (await get(`/tasks/${taskId}`)).text();
    expect(body).toContain("No description provided.");
    expect(body).not.toContain("style=\"background-color:red");
  } finally {
    task.description = originalDescription;
    task.color = originalColor;
  }
});

for (const id of [otherId, "invalid"]) {
  test(`missing or malformed records return 404 (${id})`, async () => {
    for (const path of [`/projects/${id}`, `/sheets/${id}/tasks`, `/tasks/${id}`]) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(await response.text()).toContain("not found");
    }
  });
}

test("database failures return an error page instead of an empty list", async () => {
  for (const [table, path] of [
    ["sheets", `/projects/${projectId}`],
    ["tasks", `/sheets/${sheetId}/tasks`],
    ["attachments", `/tasks/${taskId}`],
  ]) {
    failingTable = table!;
    const response = await get(path!);
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("Please try again in a moment.");
    expect(body).not.toContain("No tasks");
    expect(body).not.toContain("Database unavailable");
  }
});
