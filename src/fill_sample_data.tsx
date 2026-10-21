// This gets called at the bottom of sql.tsx
// After making all the tables, fill the databases with the sample data provided


/*
    This is super vibe coded I just wanted it done fast
*/


import { readFileSync } from "fs";
import { Buffer } from "buffer";

// Reads a CSV file into one { column: value } object per line (internal helper).
function readLines(path: string): { [column: string]: string }[] {
  const [header, ...lines] = splitCSV(readFileSync(path, "utf8"));
  if (!header) return [];
  const columns = header.map((h) => h.trim());
  return lines.map((fields) => {
    const line: { [column: string]: string } = {};
    columns.forEach((col, i) => (line[col] = fields[i] ?? ""));
    return line;
  });
}

function toNumber(value: string, column: string): number {
  const n = Number(value);
  if (value.trim() === "" || Number.isNaN(n)) {
    throw new Error(`Column "${column}" must be a number, got "${value}"`);
  }
  return n;
}

// Each parser returns [parentName, object] pairs, matching the add functions' arguments.

export function parseProjects(path: string): string[] {
  return readLines(path).map((r) => r.name);
}

export function parseSheets(
  path: string,
): [string, { name: string; pdf: Buffer; canvasSize: string }][] {
  return readLines(path).map((r) => [
    r.projectName,
    {
      name: r.name,
      pdf: readFileSync(r.pdfPath), // BLOB column: CSV holds a file path
      canvasSize: r.canvasSize,
    },
  ]);
}

export function parseTasks(
  path: string,
): [
  string,
  {
    name: string;
    coordinateX: number;
    coordinateY: number;
    color: string;
    description: string;
    completion: string;
    createdBy: string;
    assignedTo: string | null;
  },
][] {
  return readLines(path).map((r) => [
    r.sheetName,
    {
      name: r.name,
      coordinateX: toNumber(r.coordinateX, "coordinateX"),
      coordinateY: toNumber(r.coordinateY, "coordinateY"),
      color: r.color,
      description: r.description,
      completion: r.completion,
      createdBy: r.createdBy,
      assignedTo: r.assignedTo || null, // empty cell -> null
    },
  ]);
}

export function parseMedia(
  path: string,
): [string, { name: string; fileType: string; file: Buffer }][] {
  return readLines(path).map((r) => [
    r.taskName,
    {
      name: r.name,
      fileType: r.fileType,
      file: readFileSync(r.filePath), // BLOB column: CSV holds a file path
    },
  ]);
}

export const SAMPLE_DATA = `${import.meta.dir}/sample_data`;

console.log("Data inserted");