import { supabase } from "./db";
import { Buffer } from "buffer";

export interface Project { // Alias for buildings idk
  id: string;
  name: string;
  created_at: string;
}

export interface Sheet {
  id: string;
  building_id: string; // also the project_id semantically
  name: string;
  pdf_key: string;
  created_at: string;
  canvas_size: string | null;
}

export interface Task {
  id: string;
  sheet_id: string;
  name: string;
  description: string;
  x_coord: number;
  y_coord: number;
  color: string;
  created_at: string;
  status: string;
  created_by: string;
  assigned_to: string | null;
}

export interface Media {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_key: string;
  original_name: string;
  media_type: string;
  public_url: string;
  created_at: string;
}

export async function addProject(projectName: string): Promise<boolean> {
  const { error } = await supabase
    .from("buildings")
    .insert([{ name: projectName }]);
  if (error) {
    console.error("Failed to add project:", error.message);
    return false;
  }
  return true;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("buildings")
    .select("*");
  if (error || !data) return [];
  return data;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getSheetsFromProject(buildingId: string): Promise<Sheet[]> {
  const { data, error } = await supabase
    .from("sheets")
    .select("*")
    .eq("building_id", buildingId);
  if (error || !data) return [];
  return data;
}

export const SHEET_BUCKET = "floor-plans";

let bucketReady: Promise<void> | null = null;
const ensureSheetBucket = () =>
  (bucketReady ??= (async () => {
    const { error } = await supabase.storage.createBucket(SHEET_BUCKET, {
      public: false,
    });
    if (error && !/already exists/i.test(error.message)) {
      console.error("Failed to create sheet bucket:", error.message);
    }
  })());

export async function uploadSheetPdf(
  buildingId: string,
  file: File,
): Promise<string | null> {
  await ensureSheetBucket();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `sheets/${buildingId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(SHEET_BUCKET)
    .upload(key, file, { contentType: "application/pdf", upsert: false });
  if (error) {
    console.error("Failed to upload sheet PDF:", error.message);
    return null;
  }
  return key;
}

export async function addSheet(
  buildingId: string,
  sheet: { name: string; pdfKey: string; canvasSize: string | null },
): Promise<Sheet | null> {
  const { data, error } = await supabase
    .from("sheets")
    .insert([
      {
        building_id: buildingId,
        name: sheet.name,
        pdf_key: sheet.pdfKey,
        canvas_size: sheet.canvasSize,
      },
    ])
    .select("*")
    .single();
  if (error || !data) {
    console.error("Failed to add sheet:", error?.message);
    return null;
  }
  return data;
}

export async function getSheetPdfUrl(pdfKey: string): Promise<string | null> {
  if (!pdfKey) return null;
  const { data, error } = await supabase.storage
    .from(SHEET_BUCKET)
    .createSignedUrl(pdfKey, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getTasksFromSheet(sheetId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("sheet_id", sheetId);
  if (error || !data) return [];
  return data;
}

export async function addTask(sheetId: string, task: Omit<Task, "id" | "created_at" | "sheet_id">): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .insert([{ sheet_id: sheetId, ...task }]);
  return !error;
}

export async function createTask(
  sheetId: string,
  task: Omit<Task, "id" | "created_at" | "sheet_id">,
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .insert([{ sheet_id: sheetId, ...task }])
    .select("*")
    .single();
  if (error || !data) {
    console.error("Failed to create task:", error?.message);
    return null;
  }
  return data;
}

export async function updateTask(
  taskId: string,
  task: Pick<Task, "name" | "description" | "color" | "status" | "assigned_to">,
): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .update(task)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export const MEDIA_BUCKET = "task-media";

let mediaBucketReady: Promise<void> | null = null;
export const ensureMediaBucket = () =>
  (mediaBucketReady ??= (async () => {
    const { error } = await supabase.storage.getBucket(MEDIA_BUCKET);
    if (!error) return;
    const { error: createError } = await supabase.storage.createBucket(
      MEDIA_BUCKET,
      { public: true },
    );
    if (createError && !/already exists/i.test(createError.message)) {
      console.error("Failed to create media bucket:", createError.message);
    }
  })());

// Prototype function kinda
export async function addMedia(attachment: {
  taskId: string;
  uploadedBy: string;
  fileKey: string;
  originalName: string;
  mediaType: string;
}): Promise<Media | null> {
  await ensureMediaBucket();
  const { data, error } = await supabase
    .from("attachments")
    .insert([
      {
        task_id: attachment.taskId,
        uploaded_by: attachment.uploadedBy,
        file_key: attachment.fileKey,
        original_name: attachment.originalName,
        media_type: attachment.mediaType,
      },
    ])
    .select("*")
    .single();

  if (error || !data) return null;

  // Retrieve public CDN URL from Supabase Storage
  const { data: urlData } = supabase.storage
    .from("task-media")
    .getPublicUrl(attachment.fileKey);

  return {
    ...data,
    public_url: urlData.publicUrl,
  };
}
export async function getMediaFromTask(taskId: string): Promise<Media[]> {
  await ensureMediaBucket();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("task_id", taskId);

  if (error || !data) return[];

  return data.map((item) => {
    const { data: urlData } = supabase.storage
      .from("task-media")
      .getPublicUrl(item.file_key);

    return {
      ...item,
      public_url: urlData.publicUrl,
    };
  });
}

async function removeFiles(bucket: string, keys: string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const { error } = await supabase.storage.from(bucket).remove(keys);
  if (error) console.error(`Failed to remove files from ${bucket}:`, error.message);
  return !error;
}

async function removeTaskMedia(taskIds: string[]): Promise<boolean> {
  if (taskIds.length === 0) return true;
  const { data, error } = await supabase
    .from("attachments")
    .select("file_key")
    .in("task_id", taskIds);
  if (error) return false;
  return removeFiles(MEDIA_BUCKET, data.map((attachment) => attachment.file_key));
}

// Removes the stored files (task media + floor plan PDFs) for these sheets.
// The rows themselves cascade in the database, see supabase/schema.sql.
async function removeSheetFiles(sheets: Pick<Sheet, "id" | "pdf_key">[]): Promise<boolean> {
  if (sheets.length === 0) return true;
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id")
    .in("sheet_id", sheets.map((sheet) => sheet.id));
  if (error) return false;
  if (!(await removeTaskMedia(tasks.map((task) => task.id)))) return false;
  return removeFiles(SHEET_BUCKET, sheets.map((sheet) => sheet.pdf_key).filter(Boolean));
}

export async function deleteTaskWithAttachments(taskId: string): Promise<boolean> {
  if (!(await removeTaskMedia([taskId]))) return false;

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function deleteSheet(sheetId: string): Promise<boolean> {
  const { data: sheet, error: sheetError } = await supabase
    .from("sheets")
    .select("id, pdf_key")
    .eq("id", sheetId)
    .maybeSingle();
  if (sheetError || !sheet) return false;
  if (!(await removeSheetFiles([sheet]))) return false;

  const { data, error } = await supabase
    .from("sheets")
    .delete()
    .eq("id", sheetId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const project = await getProject(projectId);
  if (!project) return false;
  if (!(await removeSheetFiles(await getSheetsFromProject(projectId)))) return false;

  const { data, error } = await supabase
    .from("buildings")
    .delete()
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}
