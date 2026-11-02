// ZO447-44: builds the project report as a PDF in the browser (jsPDF) and
// returns a blob URL that the workspace shows in an iframe.
// Bookmarks: Summary, one per floor, and one per task under its floor.
// Uses renderPdfToCanvas() from workspace-client.js for the floor plans.

const REPORT_STATUSES = [
  ["open", "Open", "#0284c7"],
  ["in_progress", "In progress", "#d97706"],
  ["done", "Done", "#059669"],
];

const reportStatus = (status) =>
  REPORT_STATUSES.find(([value]) => value === status) || [status, status, "#52525b"];

async function buildProjectReport(projectId, currentUser) {
  const response = await fetch(
    "/projects/" + encodeURIComponent(projectId) + "/report-data",
  );
  if (!response.ok) throw new Error(await response.text());
  const { project, floors } = await response.json();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const newPage = () => {
    doc.addPage();
    y = margin;
  };
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - margin) {
      newPage();
      return true;
    }
    return false;
  };
  const pageNumber = () => doc.getNumberOfPages();

  const text = (value, x, size, { bold = false, color = "#18181b" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(String(value), x, y);
  };

  const heading = (value, subtitle) => {
    text(value, margin, 20, { bold: true });
    y += 18;
    if (subtitle) {
      text(subtitle, margin, 10, { color: "#71717a" });
      y += 10;
    }
    y += 14;
  };

  const sectionTitle = (value) => {
    ensureSpace(40);
    text(value.toUpperCase(), margin, 9, { bold: true, color: "#71717a" });
    y += 8;
    doc.setDrawColor("#e4e4e7");
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  };

  const countByStatus = (tasks) =>
    REPORT_STATUSES.map(([value]) => tasks.filter((task) => task.status === value).length);

  const byCreated = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  floors.forEach((floor) => floor.tasks.sort(byCreated));
  const allTasks = floors.flatMap((floor) => floor.tasks);

  doc.setProperties({
    title: project.name + " report",
    author: currentUser || "",
    creator: "StudentsPlangrid",
  });
  doc.setDisplayMode("fullwidth", "continuous", "UseOutlines");

  // ---- Summary page ----
  doc.outline.add(null, "Summary", { pageNumber: 1 });
  heading(
    project.name,
    "Task report - generated " + new Date().toLocaleString() + (currentUser ? " by " + currentUser : ""),
  );

  const stats = [["Total tasks", allTasks.length, "#18181b"]].concat(
    REPORT_STATUSES.map(([, label, color], i) => [label, countByStatus(allTasks)[i], color]),
  );
  const boxWidth = (contentWidth - 12 * (stats.length - 1)) / stats.length;
  stats.forEach(([label, value, color], i) => {
    const x = margin + i * (boxWidth + 12);
    doc.setDrawColor("#e4e4e7");
    doc.setFillColor("#fafafa");
    doc.roundedRect(x, y, boxWidth, 56, 6, 6, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(color);
    doc.text(String(value), x + 12, y + 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#71717a");
    doc.text(label, x + 12, y + 44);
  });
  y += 56 + 28;

  const simpleTable = (columns, rows) => {
    const drawHeader = () => {
      columns.forEach(([label, x]) =>
        text(label, margin + x, 9, { bold: true, color: "#71717a" }),
      );
      y += 14;
    };
    drawHeader();
    rows.forEach((row) => {
      if (ensureSpace(18)) drawHeader();
      row.forEach((value, i) => text(value, margin + columns[i][1], 10));
      y += 16;
    });
    y += 16;
  };

  sectionTitle("Floors");
  if (floors.length === 0) {
    text("This building has no floors yet.", margin, 10, { color: "#71717a" });
    y += 24;
  } else {
    simpleTable(
      [["Floor", 0], ["Tasks", 260], ["Open", 320], ["In progress", 380], ["Done", 460]],
      floors.map((floor) => [
        doc.splitTextToSize(floor.name, 250)[0],
        floor.tasks.length,
        ...countByStatus(floor.tasks),
      ]),
    );
  }

  sectionTitle("Tasks by assignee");
  const assignees = new Map();
  allTasks.forEach((task) => {
    const name = task.assigned_to || "Unassigned";
    assignees.set(name, (assignees.get(name) || 0) + 1);
  });
  if (assignees.size === 0) {
    text("No tasks yet.", margin, 10, { color: "#71717a" });
    y += 24;
  } else {
    simpleTable(
      [["Assignee", 0], ["Tasks", 260]],
      [...assignees.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => [doc.splitTextToSize(name, 250)[0], count]),
    );
  }

  // ---- One section per floor ----
  const columns = { number: 0, task: 24, status: 230, assigned: 310, created: 430 };

  const drawTaskHeader = () => {
    doc.setFillColor("#f4f4f5");
    doc.rect(margin, y - 11, contentWidth, 18, "F");
    [["#", "number"], ["Task", "task"], ["Status", "status"], ["Assigned to", "assigned"], ["Created", "created"]]
      .forEach(([label, key]) => text(label, margin + columns[key] + 4, 9, { bold: true, color: "#52525b" }));
    y += 20;
  };

  for (const floor of floors) {
    newPage();
    const floorBookmark = doc.outline.add(null, floor.name, { pageNumber: pageNumber() });
    heading(floor.name, floor.tasks.length + " task" + (floor.tasks.length === 1 ? "" : "s"));

    const plan = floor.pdfUrl ? await reportPlanImage(floor.pdfUrl, floor.tasks).catch(() => null) : null;
    if (plan) {
      const scale = Math.min(contentWidth / plan.width, 340 / plan.height);
      const width = plan.width * scale;
      const height = plan.height * scale;
      doc.setDrawColor("#e4e4e7");
      doc.rect(margin, y, width, height, "S");
      doc.addImage(plan.image, "JPEG", margin, y, width, height);
      y += height + 24;
    }

    if (floor.tasks.length === 0) {
      text("No tasks on this floor.", margin, 10, { color: "#71717a" });
      continue;
    }

    ensureSpace(60);
    drawTaskHeader();

    floor.tasks.forEach((task, index) => {
      doc.setFontSize(10);
      const nameLines = doc.splitTextToSize(task.name, columns.status - columns.task - 10);
      doc.setFontSize(9);
      const descriptionLines = task.description
        ? doc.splitTextToSize(task.description, contentWidth - columns.task - 8)
        : [];
      const rowHeight = nameLines.length * 13 + descriptionLines.length * 11 + 12;

      if (ensureSpace(rowHeight)) drawTaskHeader();
      doc.outline.add(floorBookmark, index + 1 + ". " + task.name, { pageNumber: pageNumber() });

      const [, statusText, statusColor] = reportStatus(task.status);
      const rowTop = y;
      doc.setFillColor(task.color || "#22c55e");
      doc.circle(margin + 10, y - 3.5, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor("#ffffff");
      doc.text(String(index + 1), margin + 10, y - 0.5, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor("#18181b");
      doc.text(nameLines, margin + columns.task + 4, y);
      text(statusText, margin + columns.status + 4, 10, { bold: true, color: statusColor });
      text(doc.splitTextToSize(task.assigned_to || "Unassigned", 112)[0], margin + columns.assigned + 4, 10);
      text(new Date(task.created_at).toLocaleDateString(), margin + columns.created + 4, 10);
      y += nameLines.length * 13;

      if (descriptionLines.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor("#52525b");
        doc.text(descriptionLines, margin + columns.task + 4, y);
        y += descriptionLines.length * 11;
      }

      y = Math.max(y, rowTop + 16);
      doc.setDrawColor("#f4f4f5");
      doc.line(margin, y - 4, pageWidth - margin, y - 4);
      y += 8;
    });
  }

  // ---- Page footers ----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor("#a1a1aa");
    doc.text(project.name, margin, pageHeight - 24);
    doc.text("Page " + i + " of " + total, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  return URL.createObjectURL(doc.output("blob"));
}

// Renders a floor plan with numbered pins that match the task table.
async function reportPlanImage(pdfUrl, tasks) {
  const canvas = await renderPdfToCanvas(pdfUrl);
  const context = canvas.getContext("2d");
  const radius = Math.max(14, Math.round(canvas.width / 45));

  tasks.forEach((task, index) => {
    context.beginPath();
    context.arc(task.x_coord, task.y_coord, radius, 0, Math.PI * 2);
    context.fillStyle = task.color || "#22c55e";
    context.fill();
    context.lineWidth = Math.max(2, radius / 5);
    context.strokeStyle = "#ffffff";
    context.stroke();
    context.fillStyle = "#ffffff";
    context.font = "bold " + Math.round(radius * 1.1) + "px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(index + 1), task.x_coord, task.y_coord + 1);
  });

  return {
    image: canvas.toDataURL("image/jpeg", 0.8),
    width: canvas.width,
    height: canvas.height,
  };
}
