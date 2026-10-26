import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { supabase } from "./db";
import * as sql from "./sql";

export const mediaRoutes = new Elysia().post(
  "/tasks/:taskId/media",
  async ({ params, body, cookie: { auth_user } }) => {
    const taskId = params.taskId;
    const userEmail = auth_user.value || "anonymous";
    const file = body.file;

    // 1. Generate a unique key for the file in the Supabase bucket
    const fileExtension = file.name.split(".").pop();
    const fileKey = `tasks/${taskId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;

    // 2. Upload file buffer/blob to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from("task-media")
      .upload(fileKey, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return (
        <div class="text-red-400">
          Upload failed: {uploadError.message}
        </div>
      );
    }

    // 3. Save metadata record into database
    const newMedia = await sql.addMedia({
      taskId: taskId,
      uploadedBy: userEmail,
      fileKey: fileKey,
      originalName: file.name,
      mediaType: file.type,
    });

    if (!newMedia) {
      return <div class="text-red-400">Failed to save attachment metadata.</div>;
    }

    // 4. Return updated HTMX HTML component for immediate UI insertion
    return (
      <div id={`media-${newMedia.id}`} class="border border-gray-700 p-2 my-1 flex items-center justify-between">
        {newMedia.media_type.startsWith("image/") ? (
          <img src={newMedia.public_url} class="w-16 h-16 object-cover rounded" alt={newMedia.original_name} />
        ) : (
          <span class="text-sm text-gray-300">📹 {newMedia.original_name}</span>
        )}
        <a href={newMedia.public_url} target="_blank" class="text-blue-400 text-xs hover:underline">
          View
        </a>
      </div>
    );
  },
  {
    body: t.Object({
      file: t.File(), // Receives file input from form
    }),
  }
);
