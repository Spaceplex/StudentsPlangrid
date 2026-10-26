import * as elements from "typed-html";
import type { TaskChanges } from "./sql";
import { escapeHtml, ViewPage } from "./view";

export const taskStatuses: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Completed",
  verified: "Completed (verified)",
  open: "To do (legacy)",
};

const inputClass = "w-full border border-gray-500 bg-black p-2 text-gray-100";

export const TaskEditForm = ({ task, errors = [] }: {
  task: TaskChanges & { id: string };
  errors?: string[];
}) => (
  <ViewPage title="Edit task" backHref={`/tasks/${task.id}`} backLabel="Back to task">
    {errors.length ? (
      <ul role="alert" class="mb-4 list-inside list-disc text-red-300">
        {errors.map((error) => <li>{escapeHtml(error)}</li>)}
      </ul>
    ) : ""}
    <form method="post" action={`/tasks/${task.id}/edit`} class="space-y-4">
      <div>
        <label for="task-name" class="mb-1 block">Name</label>
        <input id="task-name" name="name" value={task.name} required maxlength="200" class={inputClass} />
      </div>
      <div>
        <label for="task-description" class="mb-1 block">Description</label>
        <textarea id="task-description" name="description" rows="6" maxlength="20000" class={inputClass}>{escapeHtml(task.description)}</textarea>
      </div>
      <div>
        <label for="task-assignee" class="mb-1 block">Assignee</label>
        <input id="task-assignee" name="assigned_to" value={task.assigned_to ?? ""} maxlength="254" class={inputClass} />
        <p class="text-sm text-gray-400">Leave blank for unassigned.</p>
      </div>
      <div>
        <label for="task-status" class="mb-1 block">Status</label>
        <select id="task-status" name="status" class={inputClass}>
          {Object.entries(taskStatuses).map(([value, label]) => (
            <option value={value} selected={task.status === value}>{label}</option>
          ))}
        </select>
      </div>
      <div>
        <label for="task-color" class="mb-1 block">Color</label>
        <input id="task-color" name="color" value={task.color} required pattern="#[0-9A-Fa-f]{6}" maxlength="7" class={inputClass} />
        <p class="text-sm text-gray-400">Six-digit hex color, for example #FF0000.</p>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <button type="submit" class="border border-gray-300 bg-violet-900 px-4 py-2">Save changes</button>
        <a href={`/tasks/${task.id}`} class="text-violet-300 underline">Cancel</a>
      </div>
    </form>
  </ViewPage>
);

export const TaskDeleteForm = ({ task, error }: {
  task: { id: string; name: string };
  error?: string;
}) => (
  <ViewPage title="Delete task" backHref={`/tasks/${task.id}`} backLabel="Back to task">
    {error ? <p role="alert" class="mb-4 text-red-300">{escapeHtml(error)}</p> : ""}
    <p class="break-words">Delete “{escapeHtml(task.name)}” and all its attachments? This cannot be undone.</p>
    <form method="post" action={`/tasks/${task.id}/delete`} class="mt-4 flex flex-wrap items-center gap-4">
      <button type="submit" class="border border-red-300 bg-red-950 px-4 py-2">Delete task and attachments</button>
      <a href={`/tasks/${task.id}`} class="text-violet-300 underline">Cancel</a>
    </form>
  </ViewPage>
);
