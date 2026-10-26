import { Elysia } from "elysia";
import * as elements from "typed-html";
import * as sql from "./sql";
import { escapeHtml, MessagePage, TaskColor, ViewPage } from "./view";

export const sheetRoutes = new Elysia()
  .get("/sheets/:sheetId/tasks", async ({ params, set }) => {
    try {
      const sheet = await sql.getSheetById(params.sheetId);
      const project = sheet && await sql.getProjectById(sheet.building_id);
      if (!sheet || !project) {
        set.status = 404;
        return <MessagePage title="Sheet not found" message="This sheet does not exist." />;
      }
      const tasks = await sql.getTasksFromSheet(sheet.id);

      return (
        <ViewPage title={sheet.name} backHref={`/projects/${project.id}`} backLabel={`Back to ${project.name}`}>
          <h2 class="mb-3 text-2xl">Tasks</h2>
          {tasks.length === 0 ? <p>No tasks on this sheet yet.</p> : (
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-left">
                <caption class="sr-only">Tasks on {escapeHtml(sheet.name)}</caption>
                <thead>
                  <tr class="border-b border-gray-300">
                    <th scope="col" class="p-3">Task</th>
                    <th scope="col" class="p-3">Status</th>
                    <th scope="col" class="p-3">Assignee</th>
                    <th scope="col" class="p-3">Color</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr class="border-b border-gray-700">
                      <td class="min-w-48 max-w-xs break-words p-3">
                        <a href={`/tasks/${task.id}`} class="text-violet-300 underline">{escapeHtml(task.name)}</a>
                      </td>
                      <td class="p-3">{escapeHtml(task.status)}</td>
                      <td class="break-words p-3">{escapeHtml(task.assigned_to?.trim() || "Unassigned")}</td>
                      <td class="p-3"><TaskColor color={task.color} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ViewPage>
      );
    } catch (error) {
      console.error("Failed to load sheet tasks:", error);
      set.status = 503;
      return <MessagePage title="Could not load tasks" message="Please try again in a moment." />;
    }
  });
