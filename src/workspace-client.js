pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const TASK_COLOR = "#22c55e";
const STATUSES = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["done", "Done"],
];
const NO_ASSIGNEE = "__none__";

const statusLabel = (status) =>
  (STATUSES.find(([value]) => value === status) || [status, status])[1];

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusBadge(status) {
  return makeElement("span", "badge badge-" + status, statusLabel(status));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date) ? value : date.toLocaleString();
}

async function renderPdfToCanvas(source) {
  const pdf = await pdfjsLib.getDocument(source).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport,
  }).promise;
  return canvas;
}

document.addEventListener("DOMContentLoaded", () => {
  setupNewFloor();
  setupDeleteButtons();
  setupReport();
  setupTaskBoard().catch((error) => {
    console.error("Failed to initialize floor plan:", error);
    const mapElement = document.getElementById("floor-map");
    if (mapElement) {
      mapElement.replaceChildren(
        makeElement(
          "p",
          "flex h-full items-center justify-center text-sm text-red-400",
          "Could not load the floor plan.",
        ),
      );
    }
  });
});

function setupNewFloor() {
  const button = document.getElementById("btn-new-floor");
  const input = document.getElementById("pdf-upload");
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const name = prompt("Enter new floor name (e.g., Level 3):");
    if (!name || !name.trim()) return;
    input.dataset.floorName = name.trim();
    input.click();
  });

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a valid PDF file.");
      input.value = "";
      return;
    }

    const name = input.dataset.floorName || "New Floor";
    const buildingId = button.dataset.buildingId;
    button.disabled = true;
    button.textContent = "Uploading...";

    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });

      const form = new FormData();
      form.append("name", name);
      form.append(
        "canvasSize",
        Math.floor(viewport.width) + "x" + Math.floor(viewport.height),
      );
      form.append("file", file);

      const response = await fetch("/projects/" + buildingId + "/sheets", {
        method: "POST",
        body: form,
      });
      if (!response.ok) throw new Error(await response.text());

      const sheet = await response.json();
      window.location.href =
        "/projects/" + buildingId + "?sheet=" + sheet.id;
    } catch (error) {
      console.error("Failed to import PDF:", error);
      alert("Failed to import PDF file.");
      button.disabled = false;
      button.textContent = "+ New floor";
    } finally {
      input.value = "";
    }
  });
}

function setupDeleteButtons() {
  const floorButton = document.getElementById("btn-delete-floor");
  const buildingButton = document.getElementById("btn-delete-building");
  const floorName = document.getElementById("sheet-name")?.textContent.trim();
  const buildingName = document.getElementById("project-name")?.textContent.trim();

  floorButton?.addEventListener("click", () =>
    deleteAndRedirect(
      floorButton,
      `Delete floor "${floorName}"? Its plan, tasks and attachments will be removed.`,
      "/sheets/" + encodeURIComponent(floorButton.dataset.sheetId),
      "/projects/" + floorButton.dataset.buildingId,
    ),
  );

  buildingButton?.addEventListener("click", () =>
    deleteAndRedirect(
      buildingButton,
      `Delete building "${buildingName}"? Every floor, task and attachment in it will be removed.`,
      "/projects/" + encodeURIComponent(buildingButton.dataset.buildingId),
      "/projects",
    ),
  );
}

async function deleteAndRedirect(button, question, url, redirectTo) {
  if (!window.confirm(question)) return;

  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Deleting...";
  try {
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) throw new Error(await response.text());
    window.location.href = redirectTo;
  } catch (error) {
    console.error("Delete failed:", error);
    alert("Could not delete. Please try again.");
    button.disabled = false;
    button.textContent = label;
  }
}

function setupReport() {
  const button = document.getElementById("btn-report");
  const view = document.getElementById("report-view");
  const frame = document.getElementById("report-frame");
  const status = document.getElementById("report-status");
  const closeButton = document.getElementById("btn-report-close");
  if (!button || !view || !frame) return;

  let reportUrl = null;

  const close = () => {
    view.classList.add("hidden");
    frame.removeAttribute("src");
    if (reportUrl) URL.revokeObjectURL(reportUrl);
    reportUrl = null;
  };

  button.addEventListener("click", async () => {
    view.classList.remove("hidden");
    status.textContent = "Building report...";
    button.disabled = true;
    try {
      reportUrl = await buildProjectReport(
        button.dataset.projectId,
        button.dataset.currentUser,
      );
      frame.src = reportUrl;
      status.textContent = "Use the bookmarks sidebar to jump to a floor or task.";
    } catch (error) {
      console.error("Failed to build report:", error);
      status.textContent = "Could not build the report.";
    } finally {
      button.disabled = false;
    }
  });

  closeButton?.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !view.classList.contains("hidden")) close();
  });
}

async function setupTaskBoard() {
  const mapElement = document.getElementById("floor-map");
  if (!mapElement) return;

  const panel = document.getElementById("task-panel-body");
  const taskList = document.getElementById("task-list");
  const createButton = document.getElementById("btn-create-task");
  const exportButton = document.getElementById("btn-export-map");
  const sheetId = mapElement.dataset.sheetId;
  const currentUser = mapElement.dataset.currentUser || "unknown";

  const canvas = await renderPdfToCanvas(mapElement.dataset.pdfUrl);
  mapElement.replaceChildren();
  const width = canvas.width;
  const height = canvas.height;
  const bounds = L.latLngBounds([0, 0], [height, width]);
  const planImage = canvas.toDataURL("image/png");

  const map = L.map(mapElement, {
    crs: L.CRS.Simple,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    minZoom: -5,
    attributionControl: false,
  });
  L.imageOverlay(planImage, bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(0.25));
  setTimeout(() => map.invalidateSize(), 0);

  const tasks = JSON.parse(
    document.getElementById("task-data")?.textContent || "[]",
  );

  let selectedMarker = null;
  let selectedTaskId = null;
  let placing = false;
  let draft = null;
  const markers = new Map();

  // ---- Filters (ZO447-41) and list search/sort (ZO447-40) ----

  const filterSearch = document.getElementById("filter-search");
  const filterStatus = document.getElementById("filter-status");
  const filterAssignee = document.getElementById("filter-assignee");
  const filterMine = document.getElementById("filter-mine");
  const filterCount = document.getElementById("filter-count");
  const taskSort = document.getElementById("task-sort");

  const matchesFilters = (task) => {
    const search = (filterSearch?.value || "").trim().toLowerCase();
    const status = filterStatus?.value || "";
    const assignee = filterAssignee?.value || "";

    if (search) {
      const text = (task.name + " " + (task.description || "")).toLowerCase();
      if (!text.includes(search)) return false;
    }
    if (status && task.status !== status) return false;
    if (assignee === NO_ASSIGNEE && task.assigned_to) return false;
    if (assignee && assignee !== NO_ASSIGNEE && task.assigned_to !== assignee) {
      return false;
    }
    if (filterMine?.checked && task.assigned_to !== currentUser) return false;
    return true;
  };

  const sortTasks = (list) => {
    const order = taskSort?.value || "newest";
    const statusRank = (task) =>
      STATUSES.findIndex(([value]) => value === task.status);
    return [...list].sort((a, b) => {
      if (order === "name") return a.name.localeCompare(b.name);
      if (order === "status") return statusRank(a) - statusRank(b);
      const diff = new Date(a.created_at) - new Date(b.created_at);
      return order === "oldest" ? diff : -diff;
    });
  };

  const refreshAssigneeOptions = () => {
    if (!filterAssignee) return;
    const current = filterAssignee.value;
    const names = [...new Set(tasks.map((task) => task.assigned_to).filter(Boolean))].sort();

    const options = [["", "Anyone"], [NO_ASSIGNEE, "Unassigned"]];
    names.forEach((name) => options.push([name, name]));
    filterAssignee.replaceChildren(
      ...options.map(([value, label]) => {
        const option = makeElement("option", "", label);
        option.value = value;
        return option;
      }),
    );
    filterAssignee.value = options.some(([value]) => value === current) ? current : "";
  };

  const applyFilters = () => {
    let shown = 0;
    tasks.forEach((task) => {
      const marker = markers.get(task.id);
      if (!marker) return;
      const visible = matchesFilters(task);
      if (visible) shown++;
      if (visible && !map.hasLayer(marker)) marker.addTo(map);
      if (!visible && map.hasLayer(marker)) map.removeLayer(marker);
    });
    if (filterCount) {
      filterCount.textContent =
        shown === tasks.length
          ? `${tasks.length} task${tasks.length === 1 ? "" : "s"}`
          : `Showing ${shown} of ${tasks.length}`;
    }
    refreshTaskList();
  };

  [filterSearch, filterStatus, filterAssignee, filterMine, taskSort].forEach((input) =>
    input?.addEventListener("input", applyFilters),
  );

  const tasksChanged = () => {
    refreshAssigneeOptions();
    applyFilters();
  };

  // ---- Map markers ----

  const setPlacing = (value) => {
    placing = value;
    mapElement.style.cursor = value ? "crosshair" : "";
    if (!createButton) return;
    createButton.textContent = value ? "Click the plan..." : "+ Task";
  };

  const clearSelection = () => {
    if (selectedMarker) {
      selectedMarker.setStyle({ weight: 3, fillOpacity: 0.55 });
      selectedMarker = null;
    }
    selectedTaskId = null;
  };

  const selectTask = (task, marker) => {
    clearSelection();
    selectedMarker = marker;
    selectedTaskId = task.id;
    marker.setStyle({ weight: 5, fillOpacity: 0.95 });
    marker.bringToFront();
    showTaskDetails(task);
    refreshTaskList();
  };

  const addTaskMarker = (task, select) => {
    const color = task.color || TASK_COLOR;
    const marker = L.circleMarker([height - task.y_coord, task.x_coord], {
      radius: 11,
      color,
      weight: 3,
      fillColor: color,
      fillOpacity: 0.55,
      bubblingMouseEvents: false,
    }).addTo(map);
    marker.bindTooltip(task.name, { direction: "top", offset: [0, -10] });
    marker.on("click", () => selectTask(task, marker));
    markers.set(task.id, marker);
    if (select) selectTask(task, marker);
    return marker;
  };

  tasks.forEach((task) => addTaskMarker(task, false));
  tasksChanged();

  function refreshTaskList() {
    if (!taskList) return;
    taskList.replaceChildren();

    const visible = sortTasks(tasks.filter(matchesFilters));
    if (visible.length === 0) {
      taskList.appendChild(
        makeElement(
          "p",
          "muted py-2",
          tasks.length === 0 ? "No tasks yet. Use + Task to add one." : "No tasks match the filters.",
        ),
      );
      return;
    }

    visible.forEach((task) => {
      const selected = task.id === selectedTaskId;
      const item = makeElement(
        "button",
        "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150 " +
          (selected
            ? "border-zinc-600 bg-zinc-800"
            : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/60"),
      );
      item.type = "button";

      const dot = makeElement("span", "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full");
      dot.style.backgroundColor = task.color || TASK_COLOR;

      const body = makeElement("span", "min-w-0 flex-1");
      body.appendChild(makeElement("span", "block truncate text-sm font-medium", task.name));
      const meta = makeElement("span", "mt-1 flex items-center gap-2");
      meta.appendChild(statusBadge(task.status));
      meta.appendChild(
        makeElement("span", "truncate text-xs text-zinc-500", task.assigned_to || "Unassigned"),
      );
      body.appendChild(meta);

      item.append(dot, body);
      item.addEventListener("click", () => {
        const marker = markers.get(task.id);
        if (!marker) return;
        map.panTo(marker.getLatLng());
        selectTask(task, marker);
      });
      taskList.appendChild(item);
    });
  }

  createButton?.addEventListener("click", () => {
    setPlacing(!placing);
    if (placing) {
      clearSelection();
      refreshTaskList();
      showPanelMessage("Click on the floor plan to place the task.");
    }
  });

  exportButton?.addEventListener("click", () => {
    const projectName = document.getElementById("project-name")?.textContent.trim() || "Project";
    const floorName = document.getElementById("sheet-name")?.textContent.trim() || "Floor";
    downloadInteractiveMap({
      title: projectName + " - " + floorName,
      image: canvas.toDataURL("image/jpeg", 0.85),
      width,
      height,
      tasks,
    });
  });

  map.on("click", (event) => {
    if (!placing) return;
    setPlacing(false);

    const x = Math.round(event.latlng.lng * 100) / 100;
    const y = Math.round((height - event.latlng.lat) * 100) / 100;

    if (draft?.marker) map.removeLayer(draft.marker);
    const marker = L.circleMarker([event.latlng.lat, event.latlng.lng], {
      radius: 11,
      color: TASK_COLOR,
      weight: 2,
      dashArray: "4 4",
      fillColor: TASK_COLOR,
      fillOpacity: 0.35,
      bubblingMouseEvents: false,
    }).addTo(map);

    draft = { x, y, marker };
    showTaskForm();
  });

  // ---- Task panel ----

  function showPanelMessage(message) {
    if (!panel) return;
    panel.replaceChildren(makeElement("p", "muted", message));
  }

  function labeled(label, control) {
    const wrapper = makeElement("label", "flex flex-col gap-1.5");
    wrapper.appendChild(makeElement("span", "label", label));
    wrapper.appendChild(control);
    return wrapper;
  }

  function detail(label, value) {
    const wrapper = makeElement("div", "flex flex-col gap-0.5");
    wrapper.appendChild(makeElement("dt", "label", label));
    const content = makeElement("dd", "text-sm break-words text-zinc-200");
    if (value instanceof Node) content.appendChild(value);
    else content.textContent = value === null || value === undefined || value === "" ? "—" : value;
    wrapper.appendChild(content);
    return wrapper;
  }

  function showTaskDetails(task) {
    if (!panel) return;
    const container = makeElement("div", "flex flex-col gap-4");

    const title = makeElement("div", "flex items-start gap-2");
    const dot = makeElement("span", "mt-1.5 h-3 w-3 shrink-0 rounded-full");
    dot.style.backgroundColor = task.color || TASK_COLOR;
    title.append(dot, makeElement("h3", "text-base font-semibold break-words", task.name));
    container.appendChild(title);

    const details = makeElement("dl", "grid grid-cols-2 gap-3");
    details.appendChild(detail("Status", statusBadge(task.status)));
    details.appendChild(detail("Assigned to", task.assigned_to));
    details.appendChild(detail("Created by", task.created_by));
    details.appendChild(detail("Created", formatDate(task.created_at)));
    container.appendChild(details);

    const description = makeElement("dl");
    description.appendChild(detail("Description", task.description));
    container.appendChild(description);

    const location = makeElement(
      "p",
      "text-xs text-zinc-500",
      "Location " + Math.round(task.x_coord) + ", " + Math.round(task.y_coord),
    );
    container.appendChild(location);

    const actions = makeElement("div", "flex gap-2");
    const editButton = makeElement("button", "btn btn-sm", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", () => showTaskForm(task));
    const deleteButton = makeElement("button", "btn btn-danger btn-sm", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteTask(task));
    actions.append(editButton, deleteButton);
    container.appendChild(actions);

    const mediaSection = makeElement("div", "flex flex-col gap-2 border-t border-zinc-800 pt-4");
    const mediaHeader = makeElement("div", "flex items-center justify-between");
    mediaHeader.appendChild(makeElement("span", "label", "Media"));
    const addMediaButton = makeElement("button", "btn btn-sm", "Add media");
    addMediaButton.type = "button";
    mediaHeader.appendChild(addMediaButton);
    const mediaInput = makeElement("input", "hidden");
    mediaInput.type = "file";
    mediaInput.accept = "image/*,video/*,application/pdf";
    const previews = makeElement("div", "flex flex-wrap gap-2");
    mediaSection.appendChild(mediaHeader);
    mediaSection.appendChild(mediaInput);
    mediaSection.appendChild(previews);
    container.appendChild(mediaSection);

    panel.replaceChildren(container);

    loadTaskMedia(task.id, previews);
    addMediaButton.addEventListener("click", () => mediaInput.click());
    mediaInput.addEventListener("change", async () => {
      const file = mediaInput.files && mediaInput.files[0];
      if (!file) return;

      addMediaButton.disabled = true;
      addMediaButton.textContent = "Uploading...";
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(
          "/tasks/" + encodeURIComponent(task.id) + "/media",
          { method: "POST", body: form },
        );
        if (!response.ok) throw new Error(await response.text());
        const media = await response.json();
        renderMedia(previews, media, true);
      } catch (error) {
        console.error("Failed to upload media:", error);
        alert("Failed to upload media.");
      } finally {
        addMediaButton.disabled = false;
        addMediaButton.textContent = "Add media";
        mediaInput.value = "";
      }
    });
  }

  function showTaskForm(existingTask) {
    if (!panel) return;

    const nameInput = makeElement("input", "input");
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.required = true;
    nameInput.placeholder = "Broken Light";
    nameInput.value = existingTask?.name || "";

    const descriptionInput = makeElement("textarea", "input");
    descriptionInput.name = "description";
    descriptionInput.rows = 3;
    descriptionInput.value = existingTask?.description || "";

    const assignedInput = makeElement("input", "input");
    assignedInput.type = "text";
    assignedInput.name = "assigned_to";
    assignedInput.placeholder = "name@example.com";
    assignedInput.value = existingTask?.assigned_to || "";

    const statusSelect = makeElement("select", "input");
    STATUSES.forEach(([value, label]) => {
      const option = makeElement("option", "", label);
      option.value = value;
      statusSelect.appendChild(option);
    });
    statusSelect.value = existingTask?.status || "open";

    const colorInput = makeElement(
      "input",
      "h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-1",
    );
    colorInput.type = "color";
    colorInput.name = "color";
    colorInput.value = existingTask?.color || TASK_COLOR;

    const form = makeElement("form", "flex flex-col gap-3");
    form.appendChild(
      makeElement("h3", "text-base font-semibold", existingTask ? "Edit task" : "New task"),
    );
    form.appendChild(labeled("Task", nameInput));
    form.appendChild(labeled("Description", descriptionInput));
    form.appendChild(labeled("Assigned to", assignedInput));
    const row = makeElement("div", "grid grid-cols-2 gap-3");
    row.appendChild(labeled("Status", statusSelect));
    row.appendChild(labeled("Color", colorInput));
    form.appendChild(row);

    const actions = makeElement("div", "mt-1 flex gap-2");
    const saveButton = makeElement(
      "button",
      "btn btn-primary",
      existingTask ? "Save changes" : "Save task",
    );
    saveButton.type = "submit";
    const cancelButton = makeElement("button", "btn btn-ghost", "Cancel");
    cancelButton.type = "button";
    cancelButton.addEventListener("click", () => {
      if (existingTask) {
        showTaskDetails(existingTask);
      } else {
        if (draft?.marker) map.removeLayer(draft.marker);
        draft = null;
        showPanelMessage("Select a task on the plan to see its details.");
      }
    });
    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);
    form.appendChild(actions);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if ((!existingTask && !draft) || !nameInput.value.trim()) return;

      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      try {
        const values = {
          name: nameInput.value.trim(),
          description: descriptionInput.value.trim(),
          assigned_to: assignedInput.value.trim() || null,
          status: statusSelect.value,
          color: colorInput.value,
        };
        const response = await fetch(
          existingTask
            ? "/tasks/" + encodeURIComponent(existingTask.id)
            : "/sheets/" + encodeURIComponent(sheetId) + "/tasks",
          {
            method: existingTask ? "PATCH" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              existingTask
                ? values
                : { ...values, x_coord: draft.x, y_coord: draft.y },
            ),
          },
        );
        if (!response.ok) throw new Error(await response.text());

        const task = await response.json();
        if (existingTask) {
          Object.assign(existingTask, task);
          const marker = markers.get(task.id);
          marker.setStyle({ color: task.color, fillColor: task.color });
          marker.setTooltipContent(task.name);
          tasksChanged();
          showTaskDetails(existingTask);
        } else {
          if (draft?.marker) map.removeLayer(draft.marker);
          draft = null;
          tasks.push(task);
          addTaskMarker(task, true);
          tasksChanged();
        }
      } catch (error) {
        console.error("Failed to save task:", error);
        alert("Failed to save task.");
        saveButton.disabled = false;
        saveButton.textContent = existingTask ? "Save changes" : "Save task";
      }
    });

    panel.replaceChildren(form);
    nameInput.focus();
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.name}" and its attachments?`)) return;

    try {
      const response = await fetch(
        "/tasks/" + encodeURIComponent(task.id),
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(await response.text());

      const marker = markers.get(task.id);
      if (marker) map.removeLayer(marker);
      markers.delete(task.id);
      const index = tasks.findIndex((item) => item.id === task.id);
      if (index !== -1) tasks.splice(index, 1);
      selectedMarker = null;
      selectedTaskId = null;
      tasksChanged();
      showPanelMessage("Select a task on the plan to see its details.");
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete task.");
    }
  }
}

async function loadTaskMedia(taskId, container) {
  container.replaceChildren(makeElement("p", "muted", "Loading media..."));

  try {
    const response = await fetch(
      "/tasks/" + encodeURIComponent(taskId) + "/media",
    );
    if (!response.ok) throw new Error(await response.text());
    const items = await response.json();

    container.replaceChildren();
    if (items.length === 0) {
      const empty = makeElement("p", "muted", "No media yet.");
      empty.dataset.emptyMessage = "true";
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => renderMedia(container, item, false));
  } catch (error) {
    console.error("Failed to load media:", error);
    container.replaceChildren(
      makeElement("p", "text-sm text-red-400", "Failed to load media."),
    );
  }
}

function renderMedia(container, media, prepend) {
  const empty = container.querySelector("[data-empty-message]");
  if (empty) empty.remove();

  const mediaType = media.media_type || "";
  const name = media.original_name || "Attachment";
  const frame = "overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950";
  let item;

  if (mediaType.startsWith("video/")) {
    item = makeElement("div", frame);
    const video = makeElement("video", "h-20 w-32 object-cover");
    video.src = media.public_url;
    video.muted = true;
    video.controls = true;
    item.appendChild(video);
  } else {
    item = makeElement("a", frame + " block transition-colors duration-150 hover:border-zinc-500");
    item.href = media.public_url;
    item.target = "_blank";
    item.rel = "noopener";
    item.title = name;
    if (mediaType.startsWith("image/")) {
      const image = makeElement("img", "h-20 w-20 object-cover");
      image.src = media.public_url;
      image.alt = name;
      item.appendChild(image);
    } else {
      item.appendChild(
        makeElement("span", "block max-w-40 truncate px-3 py-2 text-xs text-zinc-300", name),
      );
    }
  }

  if (prepend) container.insertBefore(item, container.firstChild);
  else container.appendChild(item);
}
