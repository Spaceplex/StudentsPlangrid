// For dev purposes, this uses SQLite so that there's no extra steps in running and deploying
// Later in the project, this needs to be replaced with a separate database server

import { Database } from "bun:sqlite";
import { Buffer } from "buffer";


console.log("Importing sqlite");
// Open a local file database
const db = new Database("mydb.sqlite");



// Enable Foreign Key support in SQLite
db.exec("PRAGMA foreign_keys = ON;");

// These functions are the "database interface"
// Use them for all interaction with the database


export interface Project {
  project_ID: number;
  name: string;
  time_created: string;
}
export function addProject(projectName: string): boolean {
  const result = db
    .query("INSERT OR IGNORE INTO Project (name) VALUES ($projectName)")
    .run({ $projectName: projectName });
  return result.changes > 0;
}

export interface Sheet {
  sheet_ID: number;
  name: string;
  time_created: string;
  pdf: Uint8Array | null; // BLOBs come back as Uint8Array
  canvas_size: string;
  project_ID: number;
}
export function getSheetsFromProject(projectName: string): Sheet[] {
  return db
    .query(`
      WITH targetProject AS (
        SELECT project_ID FROM Project WHERE name = $projectName
      )
      SELECT * FROM Sheet
      WHERE project_ID IN (SELECT project_ID FROM targetProject)`)
    .all({ $projectName: projectName });
}

export function addSheet(
  projectName: string,
  sheet: { name: string; pdf: Buffer; canvasSize: string },
): boolean {
  const result = db
    .query(`
      INSERT OR IGNORE INTO Sheet (name, pdf, canvas_size, project_ID)
      SELECT $name, $pdf, $canvasSize, project_ID
      FROM Project WHERE name = $projectName`)
    .run({
      $name: sheet.name,
      $pdf: sheet.pdf,
      $canvasSize: sheet.canvasSize,
      $projectName: projectName,
    });
  return result.changes > 0;
}

export interface Task {
  task_ID: number;
  name: string;
  time_created: string;
  coordinateX: number;
  coordinateY: number;
  color: string;
  description: string;
  completion_enum: string;
  sheet_ID: number;
  created_by: string;
  assigned_to: string | null;
}
export function getTasksFromSheet(sheetName: string): Task[] {
  return db
    .query(`
      WITH targetSheet AS (
        SELECT sheet_ID FROM Sheet WHERE name = $sheetName
      )
      SELECT * FROM Task
      WHERE sheet_ID IN (SELECT sheet_ID FROM targetSheet)`)
    .all({ $sheetName: sheetName });
}

export function addTask(
  sheetName: string,
  task: {
    name: string;
    coordinateX: number;
    coordinateY: number;
    color: string;
    description: string;
    completion: string;
    createdBy: string;
    assignedTo: string | null;
  },
): boolean {
  const result = db
    .query(`
      INSERT OR IGNORE INTO Task (name, coordinateX, coordinateY, color, description,
                        completion_enum, created_by, assigned_to, sheet_ID)
      SELECT $name, $coordinateX, $coordinateY, $color, $description,
             $completion, $createdBy, $assignedTo, sheet_ID
      FROM Sheet WHERE name = $sheetName`)
    .run({
      $name: task.name,
      $coordinateX: task.coordinateX,
      $coordinateY: task.coordinateY,
      $color: task.color,
      $description: task.description,
      $completion: task.completion,
      $createdBy: task.createdBy,
      $assignedTo: task.assignedTo,
      $sheetName: sheetName,
    });
  return result.changes > 0;
}

export interface Media {
  media_ID: number;
  name: string;
  time_created: string;
  file_type: string;
  file: Uint8Array | null;
  task_ID: number;
}
export function getMediaFromTask(taskName: string): Media[] {
  return db
    .query(`
      WITH targetTask AS (
        SELECT task_ID FROM Task WHERE name = $taskName
      )
      SELECT * FROM Media
      WHERE task_ID IN (SELECT task_ID FROM targetTask)`)
    .all({ $taskName: taskName });
}

export function addMedia(
  taskName: string,
  media: { name: string; fileType: string; file: Buffer },
): boolean {
  const result = db
    .query(`
      INSERT OR IGNORE INTO Media (name, file_type, file, task_ID)
      SELECT $name, $fileType, $file, task_ID
      FROM Task WHERE name = $taskName`)
    .run({
      $name: media.name,
      $fileType: media.fileType,
      $file: media.file,
      $taskName: taskName,
    });
  return result.changes > 0;
}

// Create all tables
db.exec(`CREATE TABLE IF NOT EXISTS Project (
    project_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(128) UNIQUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`);

db.exec(`CREATE TABLE IF NOT EXISTS Sheet (
    sheet_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(128) UNIQUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pdf BLOB,
    canvas_size VARCHAR(255),
    project_ID INT, 
    FOREIGN KEY (project_ID) REFERENCES Project(project_ID)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS Task (
    task_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(128) UNIQUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    coordinateX INT,
    coordinateY INT,
    color CHAR(7),
    description TEXT,
    completion_enum VARCHAR(32),
    sheet_ID INT,
    created_by VARCHAR(32),
    assigned_to VARCHAR(32),
    FOREIGN KEY (sheet_ID) REFERENCES Sheet(sheet_ID),
    UNIQUE (sheet_ID, coordinateX, coordinateY)
);`);

db.exec(`CREATE TABLE IF NOT EXISTS Media (
    media_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(128) UNIQUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_type VARCHAR(16),
    file BLOB,
    task_ID INT,
    FOREIGN KEY (task_ID) REFERENCES Task(task_ID)
);`);


/*
import * as data from "./fill_sample_data";
data.parseProjects("./sample_data/projects.csv");
data.parseSheets("./sample_data/sheets.csv");
data.parseMedia("./sample_data/media.csv");
data.parseTasks("./sample_data/tasks.csv");
*/