pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const TASK_COLOR = "#22c55e";

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
  setupTaskBoard().catch((error) =>
    console.error("Failed to initialize floor plan:", error),
  );
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
    } finally {
      input.value = "";
    }
  });
}

async function setupTaskBoard() {
  const mapElement = document.getElementById("floor-map");
  if (!mapElement) return;

  const panel = document.getElementById("task-panel-body");
  const taskList = document.getElementById("task-list");
  const createButton = document.getElementById("btn-create-task");
  const sheetId = mapElement.dataset.sheetId;
  const currentUser = mapElement.dataset.currentUser || "unknown";

  const canvas = await renderPdfToCanvas(mapElement.dataset.pdfUrl);
  const width = canvas.width;
  const height = canvas.height;
  const bounds = L.latLngBounds([0, 0], [height, width]);

  const map = L.map(mapElement, {
    crs: L.CRS.Simple,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    minZoom: -5,
    attributionControl: false,
  });
  L.imageOverlay(canvas.toDataURL("image/png"), bounds).addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(0.25));
  setTimeout(() => map.invalidateSize(), 0);

  const tasks = JSON.parse(
    document.getElementById("task-data")?.textContent || "[]",
  );

  let selectedMarker = null;
  let placing = false;
  let draft = null;
  const markers = new Map();

  const setPlacing = (value) => {
    placing = value;
    mapElement.style.cursor = value ? "crosshair" : "";
    if (!createButton) return;
    createButton.textContent = value ? "CLICK PLAN..." : "+ TASK";
    createButton.classList.toggle("bg-green-400/20", value);
  };

  const clearSelection = () => {
    if (selectedMarker) {
      selectedMarker.setStyle({ weight: 3, fillOpacity: 0.55 });
      selectedMarker = null;
    }
  };

  const selectTask = (task, marker) => {
    clearSelection();
    selectedMarker = marker;
    marker.setStyle({ weight: 5, fillOpacity: 0.95 });
    marker.bringToFront();
    showTaskDetails(task);
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
    marker.on("click", () => selectTask(task, marker));
    markers.set(task.id, marker);
    if (select) selectTask(task, marker);
    return marker;
  };

  tasks.forEach((task) => addTaskMarker(task, false));
  refreshTaskList();

  function refreshTaskList() {
    if (!taskList) return;
    taskList.replaceChildren();
    if (tasks.length === 0) {
      taskList.appendChild(makeElement("p", "text-sm text-green-700", "No tasks yet."));
      return;
    }

    tasks.forEach((task) => {
      const item = makeElement(
        "button",
        "border border-green-900 px-3 py-2 text-left text-sm hover:bg-green-400/10",
      );
      item.type = "button";
      item.appendChild(makeElement("div", "text-green-300", task.name));
      item.appendChild(
        makeElement("div", "mt-1 text-xs text-green-700", `${task.status} · ${task.assigned_to || "Unassigned"}`),
      );
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
      showPanelMessage("Click on the floor plan to place the task.");
    }
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

  function showPanelMessage(message) {
    if (!panel) return;
    panel.replaceChildren(
      makeElement("p", "text-sm text-green-600", message),
    );
  }

  function labeled(label, control) {
    const wrapper = makeElement("label", "flex flex-col gap-1");
    wrapper.appendChild(
      makeElement("span", "text-xs uppercase text-green-600", label),
    );
    wrapper.appendChild(control);
    return wrapper;
  }

  function detail(label, value) {
    const wrapper = makeElement("div", "flex flex-col gap-1");
    wrapper.appendChild(
      makeElement("span", "text-xs uppercase text-green-600", label),
    );
    wrapper.appendChild(
      makeElement(
        "div",
        "border border-green-400 px-3 py-2 text-sm",
        value === null || value === undefined || value === "" ? "—" : value,
      ),
    );
    return wrapper;
  }

  function showTaskDetails(task) {
    if (!panel) return;
    const container = makeElement("div", "flex flex-col gap-3");
    container.appendChild(detail("Task", task.name));
    container.appendChild(detail("Description", task.description));
    container.appendChild(detail("Status", task.status));
    container.appendChild(detail("Created by", task.created_by));
    container.appendChild(detail("Assigned to", task.assigned_to));
    container.appendChild(detail("Color", task.color));
    container.appendChild(
      detail(
        "Location",
        Math.round(task.x_coord) + ", " + Math.round(task.y_coord),
      ),
    );

    const actions = makeElement("div", "flex gap-2");
    const editButton = makeElement(
      "button",
      "border border-green-400 px-3 py-2 text-sm text-green-400 hover:bg-green-400/10",
      "Edit",
    );
    editButton.type = "button";
    editButton.addEventListener("click", () => showTaskForm(task));
    const deleteButton = makeElement(
      "button",
      "border border-red-500 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10",
      "Delete",
    );
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteTask(task));
    actions.append(editButton, deleteButton);
    container.appendChild(actions);

    const mediaSection = makeElement("div", "mt-2 flex flex-col gap-2");
    const mediaHeader = makeElement("div", "flex items-center justify-between");
    mediaHeader.appendChild(
      makeElement("span", "text-xs uppercase text-green-600", "Media"),
    );
    const addMediaButton = makeElement(
      "button",
      "border border-green-400 px-3 py-1 text-sm text-green-400 hover:bg-green-400/10",
      "Add Media",
    );
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
        addMediaButton.textContent = "Add Media";
        mediaInput.value = "";
      }
    });
  }

  function showTaskForm(existingTask) {
    if (!panel) return;

    const nameInput = makeElement(
      "input",
      "w-full border border-green-400 bg-black px-3 py-2 text-sm text-green-100",
    );
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.required = true;
    nameInput.placeholder = "Broken Light";
    nameInput.value = existingTask?.name || "";

    const descriptionInput = makeElement(
      "textarea",
      "w-full border border-green-400 bg-black px-3 py-2 text-sm text-green-100",
    );
    descriptionInput.name = "description";
    descriptionInput.rows = 3;
    descriptionInput.value = existingTask?.description || "";

    const assignedInput = makeElement(
      "input",
      "w-full border border-green-400 bg-black px-3 py-2 text-sm text-green-100",
    );
    assignedInput.type = "text";
    assignedInput.name = "assigned_to";
    assignedInput.placeholder = "name@example.com";
    assignedInput.value = existingTask?.assigned_to || "";

    const statusSelect = makeElement(
      "select",
      "w-full border border-green-400 bg-black px-3 py-2 text-sm text-green-100",
    );
    [["open", "Open"], ["in_progress", "In progress"], ["done", "Done"]].forEach(
      ([value, label]) => {
        const option = makeElement("option", "", label);
        option.value = value;
        statusSelect.appendChild(option);
      },
    );
    statusSelect.value = existingTask?.status || "open";

    const colorInput = makeElement(
      "input",
      "h-10 w-full border border-green-400 bg-black",
    );
    colorInput.type = "color";
    colorInput.name = "color";
    colorInput.value = existingTask?.color || TASK_COLOR;

    const form = makeElement("form", "flex flex-col gap-3");
    form.appendChild(labeled("Task", nameInput));
    form.appendChild(labeled("Description", descriptionInput));
    form.appendChild(labeled("Assigned to", assignedInput));
    form.appendChild(labeled("Status", statusSelect));
    form.appendChild(labeled("Color", colorInput));

    const actions = makeElement("div", "mt-2 flex gap-2");
    const saveButton = makeElement(
      "button",
      "border border-green-400 px-4 py-2 text-green-400 hover:bg-green-400/10",
      existingTask ? "Save Changes" : "Save Task",
    );
    saveButton.type = "submit";
    const cancelButton = makeElement(
      "button",
      "border border-green-700 px-4 py-2 text-green-600 hover:bg-green-400/10",
      "Cancel",
    );
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
          refreshTaskList();
          showTaskDetails(existingTask);
        } else {
          if (draft?.marker) map.removeLayer(draft.marker);
          draft = null;
          tasks.push(task);
          addTaskMarker(task, true);
          refreshTaskList();
        }
      } catch (error) {
        console.error("Failed to create task:", error);
        alert("Failed to create task.");
        saveButton.disabled = false;
        saveButton.textContent = existingTask ? "Save Changes" : "Save Task";
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
      refreshTaskList();
      showPanelMessage("Select a task on the plan to see its details.");
    } catch (error) {
      console.error("Failed to delete task:", error);
      alert("Failed to delete task.");
    }
  }
}

async function loadTaskMedia(taskId, container) {
  container.replaceChildren(
    makeElement("p", "text-sm text-green-700", "Loading media..."),
  );

  try {
    const response = await fetch(
      "/tasks/" + encodeURIComponent(taskId) + "/media",
    );
    if (!response.ok) throw new Error(await response.text());
    const items = await response.json();

    container.replaceChildren();
    if (items.length === 0) {
      const empty = makeElement(
        "p",
        "text-sm text-green-700",
        "No media yet.",
      );
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

  const wrapper = makeElement("div", "border border-green-400");
  const mediaType = media.media_type || "";

  if (mediaType.startsWith("image/")) {
    const image = makeElement("img", "h-20 w-20 object-cover");
    image.src = media.public_url;
    image.alt = media.original_name || "Attachment";
    wrapper.appendChild(image);
  } else if (mediaType.startsWith("video/")) {
    const video = makeElement("video", "h-20 w-32 object-cover");
    video.src = media.public_url;
    video.muted = true;
    video.controls = true;
    wrapper.appendChild(video);
  } else {
    wrapper.appendChild(
      makeElement(
        "span",
        "block px-2 py-1 text-xs",
        media.original_name || "Attachment",
      ),
    );
  }

  if (prepend) container.insertBefore(wrapper, container.firstChild);
  else container.appendChild(wrapper);
}
