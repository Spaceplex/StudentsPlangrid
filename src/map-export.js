// ZO447-45: download the current floor as a standalone interactive HTML file.
// The file holds the plan image and the tasks, and loads Leaflet from a CDN,
// so it opens in any browser without the app running.

function downloadInteractiveMap({ title, image, width, height, tasks }) {
  const data = {
    title,
    image,
    width,
    height,
    exportedAt: new Date().toLocaleString(),
    tasks: tasks.map((task) => ({
      name: task.name,
      description: task.description,
      status: task.status,
      assigned_to: task.assigned_to,
      color: task.color,
      x: task.x_coord,
      y: task.y_coord,
    })),
  };

  const html = mapExportTemplate(
    escapeHtmlText(title),
    JSON.stringify(data).replace(/</g, "\\u003c"),
  );
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() + ".html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function escapeHtmlText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mapExportTemplate(title, json) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #09090b; color: #f4f4f5; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 12px 20px; border-bottom: 1px solid #27272a; }
  h1 { margin: 0; font-size: 18px; }
  header span { color: #71717a; font-size: 13px; }
  #map { height: calc(100vh - 50px); background: #18181b; }
  .popup { color: #18181b; }
  .popup h2 { margin: 0 0 4px; font-size: 15px; }
  .popup p { margin: 4px 0 0; color: #3f3f46; white-space: pre-wrap; }
  .popup small { color: #71717a; }
</style>
</head>
<body>
<header><h1>${title}</h1><span id="meta"></span></header>
<div id="map"></div>
<script id="map-data" type="application/json">${json}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const data = JSON.parse(document.getElementById("map-data").textContent);
  const labels = { open: "Open", in_progress: "In progress", done: "Done" };
  document.getElementById("meta").textContent =
    data.tasks.length + " tasks · exported " + data.exportedAt;

  const bounds = L.latLngBounds([0, 0], [data.height, data.width]);
  const map = L.map("map", { crs: L.CRS.Simple, zoomSnap: 0.25, minZoom: -5, attributionControl: false });
  L.imageOverlay(data.image, bounds).addTo(map);
  map.fitBounds(bounds);

  const el = (tag, text) => {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  };

  data.tasks.forEach((task) => {
    const color = task.color || "#22c55e";
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.append(
      el("h2", task.name),
      el("small", (labels[task.status] || task.status) + " · " + (task.assigned_to || "Unassigned")),
    );
    if (task.description) popup.append(el("p", task.description));

    L.circleMarker([data.height - task.y, task.x], {
      radius: 11, color, weight: 3, fillColor: color, fillOpacity: 0.6,
    }).bindTooltip(task.name).bindPopup(popup).addTo(map);
  });
</script>
</body>
</html>`;
}
