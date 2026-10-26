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
  canvas_size: string;
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
  return !error;
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("buildings")
    .select("*");
  if (error || !data) return [];
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

export async function getTasksFromSheet(sheetId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("sheet_id", sheetId);
  if (error || !data) return [];
  return data;
}

export async function addTask(sheetId: string, task: Omit<Task, "id" | "created_at">): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .insert([{ sheet_id: sheetId, ...task }]);
  return !error;
}

// Prototype function kinda
export async function addMedia(attachment: {
  taskId: string;
  uploadedBy: string;
  fileKey: string;
  originalName: string;
  mediaType: string;
}): Promise<Media | null> {
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
