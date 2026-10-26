import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import * as sql from "./sql";
import { escapeHtml, MessagePage, TaskColor, ViewPage } from "./view";
import { TaskDeleteForm, TaskEditForm, taskStatuses } from "./taskForms";

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
          <nav aria-label="Task actions" class="mb-6 flex gap-4">
            <a href={`/tasks/${task.id}/edit`} class="text-violet-300 underline">Edit task</a>
            <a href={`/tasks/${task.id}/delete`} class="text-red-300 underline">Delete task</a>
          </nav>
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
  })
  .get("/tasks/:taskId/edit", async ({ params, set }) => {
    try {
      const task = await sql.getTaskById(params.taskId);
      if (!task) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task does not exist." />;
      }
      return <TaskEditForm task={task} />;
    } catch (error) {
      console.error("Failed to load task editor:", error);
      set.status = 503;
      return <MessagePage title="Could not load task" message="Please try again in a moment." />;
    }
  })
  .post("/tasks/:taskId/edit", async ({ params, body, set, redirect }) => {
    const changes: sql.TaskChanges = {
      name: body.name.trim(),
      description: body.description,
      assigned_to: body.assigned_to.trim() || null,
      status: body.status,
      color: body.color.trim(),
    };
    try {
      const task = await sql.getTaskById(params.taskId);
      if (!task) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task does not exist." />;
      }
      const errors: string[] = [];
      if (!changes.name || changes.name.length > 200) errors.push("Name must contain 1 to 200 characters.");
      if (changes.description.length > 20000) errors.push("Description must be 20,000 characters or fewer.");
      if ((changes.assigned_to?.length ?? 0) > 254) errors.push("Assignee must be 254 characters or fewer.");
      if (!Object.hasOwn(taskStatuses, changes.status)) errors.push("Choose a valid status.");
      if (!/^#[0-9a-f]{6}$/i.test(changes.color)) errors.push("Color must be a six-digit hex code, for example #FF0000.");
      if (errors.length) {
        set.status = 422;
        return <TaskEditForm task={{ ...changes, id: task.id }} errors={errors} />;
      }
      const updated = await sql.updateTask(task.id, changes);
      if (!updated) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task no longer exists." />;
      }
      return redirect(`/tasks/${task.id}`, 303);
    } catch (error) {
      console.error("Failed to update task:", error);
      set.status = 503;
      return <TaskEditForm task={{ ...changes, id: params.taskId }} errors={["Could not save task. Please try again."]} />;
    }
  }, {
    body: t.Object({
      name: t.String(), description: t.String(), assigned_to: t.String(),
      status: t.String(), color: t.String(),
    }),
  })
  .get("/tasks/:taskId/delete", async ({ params, set }) => {
    try {
      const task = await sql.getTaskById(params.taskId);
      if (!task) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task does not exist." />;
      }
      return <TaskDeleteForm task={task} />;
    } catch (error) {
      console.error("Failed to load task deletion:", error);
      set.status = 503;
      return <MessagePage title="Could not load task" message="Please try again in a moment." />;
    }
  })
  .post("/tasks/:taskId/delete", async ({ params, set, redirect }) => {
    let task: sql.Task | null = null;
    try {
      task = await sql.getTaskById(params.taskId);
      if (!task || !(await sql.deleteTask(task.id))) {
        set.status = 404;
        return <MessagePage title="Task not found" message="This task no longer exists." />;
      }
      return redirect(`/sheets/${task.sheet_id}/tasks`, 303);
    } catch (error) {
      console.error("Failed to delete task:", error);
      set.status = 503;
      return task ? <TaskDeleteForm task={task} error="Could not finish deleting this task. Please retry. Some attachment files may already have been removed." />
        : <MessagePage title="Could not delete task" message="Please try again in a moment." />;
    }
  });
