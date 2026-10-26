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
  x_coord: 120, y_coord: 340,
};
const originalTask = { ...task };
const attachments = [
  { id: "photo", task_id: taskId, file_key: "door.png", original_name: 'Door "before".png', media_type: "image/png" },
  { id: "report", task_id: taskId, file_key: "report.pdf", original_name: "Report <draft>.pdf", media_type: "application/pdf" },
  { id: "unrelated", task_id: otherId, file_key: "other-task.png", original_name: "Other task.png", media_type: "image/png" },
];

let emptyTable = "";
let failingTable = "";
let failingOperation = "";
let taskDeleted = false;
let removedKeys: string[] = [];
let storedKeys = new Set(attachments.map((item) => item.file_key));

// Exercise the real Supabase queries against a local PostgREST fixture.
const database = Bun.serve({
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/storage/v1/object/task-media" && request.method === "DELETE") {
      if (failingOperation === "storage") return Response.json({ message: "Storage unavailable" }, { status: 500 });
      const { prefixes } = await request.json() as { prefixes: string[] };
      removedKeys.push(...prefixes);
      prefixes.forEach((key) => storedKeys.delete(key));
      return Response.json(prefixes.map((name) => ({ name })));
    }
    const table = url.pathname.split("/").pop();
    if (table === failingTable || failingOperation === `${table}:${request.method}`) {
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
    if (taskDeleted && table === "tasks") rows = [];
    if (taskDeleted && table === "attachments") rows = rows.filter((row) => row.task_id !== taskId);
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) rows = rows.filter((row) => row[key] === value.slice(3));
    }
    if (table === "tasks" && request.method === "PATCH" && rows.length) {
      Object.assign(task, await request.json());
      return Response.json([task]);
    }
    if (table === "tasks" && request.method === "DELETE" && rows.length) {
      taskDeleted = true;
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

afterEach(() => {
  emptyTable = ""; failingTable = ""; failingOperation = "";
  taskDeleted = false;
  removedKeys = [];
  storedKeys = new Set(attachments.map((item) => item.file_key));
  Object.assign(task, originalTask);
});
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
    for (const path of [`/projects/${id}`, `/sheets/${id}/tasks`, `/tasks/${id}`, `/tasks/${id}/edit`, `/tasks/${id}/delete`]) {
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

const editValues = {
  name: "  Repair door  ", description: "Updated <description>\nSecond line",
  assigned_to: "  bob  ", status: "done", color: "#00AA00",
};
const post = (path: string, values: Record<string, string> = {}) => app.handle(new Request(`http://localhost${path}`, {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(values),
}));

test("edit form is prefilled, escaped, and has a cancel link", async () => {
  const response = await get(`/tasks/${taskId}/edit`);
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('value="Fix <door>"');
  expect(body).toContain('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
  expect(body).toContain('value="in_progress" selected');
  expect(body).toContain(`href="/tasks/${taskId}"`);
  expect(task.name).toBe(originalTask.name);
});

test("edits persist after reload and cannot change coordinates or creator", async () => {
  const response = await post(`/tasks/${taskId}/edit`, {
    ...editValues, x_coord: "999", created_by: "mallory", sheet_id: otherId,
  });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`/tasks/${taskId}`);
  const reloaded = await (await get(`/tasks/${taskId}`)).text();
  expect(reloaded).toContain("Repair door");
  expect(reloaded).toContain("Updated &lt;description&gt;\nSecond line");
  expect(reloaded).toContain("bob");
  expect(reloaded).toContain("#00AA00");
  expect(task.x_coord).toBe(120);
  expect(task.created_by).toBe("alice");
  expect(task.sheet_id).toBe(sheetId);
});

test("blank assignee clears assignment and legacy open status still saves", async () => {
  const response = await post(`/tasks/${taskId}/edit`, { ...editValues, assigned_to: "   ", status: "open" });
  expect(response.status).toBe(303);
  expect(task.assigned_to).toBeNull();
  expect(task.status).toBe("open");
});

test("invalid edits show errors, preserve input, and leave the task unchanged", async () => {
  const response = await post(`/tasks/${taskId}/edit`, { ...editValues, name: "  ", status: "bogus", color: "red" });
  expect(response.status).toBe(422);
  const body = await response.text();
  expect(body).toContain("Name must contain");
  expect(body).toContain("Choose a valid status");
  expect(body).toContain("Color must be a six-digit hex code");
  expect(body).toContain("Updated &lt;description&gt;");
  expect(task).toEqual(originalTask);

  const tooLong = await post(`/tasks/${taskId}/edit`, { ...editValues, name: "x".repeat(201), description: "x".repeat(20001), assigned_to: "x".repeat(255) });
  expect(tooLong.status).toBe(422);
  expect(task).toEqual(originalTask);
});

test("failed updates preserve form input and do not report success", async () => {
  failingOperation = "tasks:PATCH";
  const response = await post(`/tasks/${taskId}/edit`, editValues);
  expect(response.status).toBe(503);
  const body = await response.text();
  expect(body).toContain("Could not save task");
  expect(body).toContain("Updated &lt;description&gt;");
  expect(task).toEqual(originalTask);
});

test("deleting requires a POST and cleans only this task's attachment files", async () => {
  const confirmation = await get(`/tasks/${taskId}/delete`);
  expect(confirmation.status).toBe(200);
  expect(await confirmation.text()).toContain("This cannot be undone.");
  expect(taskDeleted).toBe(false);
  expect(removedKeys).toEqual([]);

  const response = await post(`/tasks/${taskId}/delete`);
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`/sheets/${sheetId}/tasks`);
  expect(removedKeys).toEqual(["door.png", "report.pdf"]);
  expect(storedKeys.has("other-task.png")).toBe(true);
  expect(storedKeys.has("door.png")).toBe(false);
  expect((await get(`/tasks/${taskId}`)).status).toBe(404);
  expect(await (await get(`/sheets/${sheetId}/tasks`)).text()).toContain("No tasks on this sheet yet.");
  expect(await (await database.fetch(new Request(`${database.url}rest/v1/attachments?task_id=eq.${taskId}`)))!.text()).toBe("[]");
});

test("tasks without attachments can be deleted without calling storage", async () => {
  emptyTable = "attachments";
  expect((await post(`/tasks/${taskId}/delete`)).status).toBe(303);
  expect(taskDeleted).toBe(true);
  expect(removedKeys).toEqual([]);
});

test("storage failures leave the task available to retry deletion", async () => {
  failingOperation = "storage";
  const response = await post(`/tasks/${taskId}/delete`);
  expect(response.status).toBe(503);
  expect(taskDeleted).toBe(false);
  expect(storedKeys.has("door.png")).toBe(true);
  failingOperation = "";
  expect((await post(`/tasks/${taskId}/delete`)).status).toBe(303);
});

test("database delete failures show a retry message and can be retried after file cleanup", async () => {
  failingOperation = "tasks:DELETE";
  const response = await post(`/tasks/${taskId}/delete`);
  expect(response.status).toBe(503);
  expect(taskDeleted).toBe(false);
  expect(storedKeys.has("door.png")).toBe(false);
  expect(await response.text()).toContain("Some attachment files may already have been removed");
  failingOperation = "";
  expect((await post(`/tasks/${taskId}/delete`)).status).toBe(303);
});

test("missing tasks cannot be edited or deleted", async () => {
  for (const id of [otherId, "invalid"]) {
    expect((await post(`/tasks/${id}/edit`, editValues)).status).toBe(404);
    expect((await post(`/tasks/${id}/delete`)).status).toBe(404);
  }
  expect(removedKeys).toEqual([]);
});
