import { Elysia, t } from "elysia";
import { supabase } from "./db";
import * as sql from "./sql";

export const mediaRoutes = new Elysia()
  .get("/tasks/:taskId/media", async ({ params }) => {
    return await sql.getMediaFromTask(params.taskId);
  })
  .post(
    "/tasks/:taskId/media",
    async ({ params, body, cookie: { auth_user }, set }) => {
      const taskId = params.taskId;
      const userEmail =
        (auth_user?.value as string | undefined) || "anonymous";
      const file = body.file;

      await sql.ensureMediaBucket();

      const fileExtension = file.name.split(".").pop() || "bin";
      const fileKey = `tasks/${taskId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from(sql.MEDIA_BUCKET)
        .upload(fileKey, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        set.status = 500;
        return { error: uploadError.message };
      }

      const newMedia = await sql.addMedia({
        taskId,
        uploadedBy: userEmail,
        fileKey,
        originalName: file.name,
        mediaType: file.type,
      });

      if (!newMedia) {
        set.status = 500;
        return { error: "Failed to save attachment metadata." };
      }

      return newMedia;
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    },
  );
