import { Elysia } from "elysia";
import * as elements from "typed-html";
import * as sql from "./sql";
import { escapeHtml, MessagePage, TaskColor, ViewPage } from "./view";

export const taskRoutes = new Elysia()
  .get("/tasks/:taskId", async ({ params, set }) => {
    try {
      const task = await sql.getTaskById(params.taskId);
      const sheet = task && await sql.getSheetById(task.sheet_id);
      if (!task || !sheet) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task does not exist." />;
      }
      const media = await sql.getMediaFromTask(task.id);
      const createdAt = new Date(task.created_at);

      return (
        <ViewPage title={task.name} backHref={`/sheets/${sheet.id}/tasks`} backLabel={`Back to ${sheet.name}`}>
          <dl class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt class="text-gray-400">Status</dt><dd>{escapeHtml(task.status)}</dd>
            <dt class="text-gray-400">Assignee</dt><dd class="break-words">{escapeHtml(task.assigned_to?.trim() || "Unassigned")}</dd>
            <dt class="text-gray-400">Color</dt><dd><TaskColor color={task.color} /></dd>
            <dt class="text-gray-400">Created by</dt><dd class="break-words">{escapeHtml(task.created_by)}</dd>
            <dt class="text-gray-400">Created</dt>
            <dd>{Number.isNaN(createdAt.getTime()) ? "Unknown" : (
              <time datetime={createdAt.toISOString()}>{createdAt.toUTCString()}</time>
            )}</dd>
          </dl>
          <h2 class="mb-2 mt-6 text-2xl">Description</h2>
          <p class="whitespace-pre-wrap break-words">{escapeHtml(task.description?.trim() ? task.description : "No description provided.")}</p>
          <h2 class="mb-2 mt-6 text-2xl">Attachments</h2>
          {media.length === 0 ? <p>No attachments yet.</p> : (
            <ul class="space-y-4">
              {media.map((item) => (
                <li class="border border-gray-700 p-3">
                  <a href={item.public_url} target="_blank" rel="noopener noreferrer" class="break-words text-violet-300 underline">
                    {item.media_type.startsWith("image/") ? (
                      <img src={item.public_url} alt={item.original_name} loading="lazy" class="mb-2 max-h-64 max-w-full object-contain" />
                    ) : ""}
                    {escapeHtml(item.original_name)}
                    <span class="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </ViewPage>
      );
    } catch (error) {
      console.error("Failed to load task:", error);
      set.status = 503;
      return <MessagePage title="Could not load task" message="Please try again in a moment." />;
    }
  });
