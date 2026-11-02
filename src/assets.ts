import { Elysia } from "elysia";

// Static files used by the pages.
const serve = (path: string, type: string) => () =>
  new Response(Bun.file(`${import.meta.dir}/${path}`), {
    headers: { "content-type": type },
  });

export const assetRoutes = new Elysia()
  .get("/app.css", serve("../public/app.css", "text/css"))
  .get("/workspace-client.js", serve("workspace-client.js", "application/javascript"))
  .get("/report-client.js", serve("report-client.js", "application/javascript"))
  .get("/map-export.js", serve("map-export.js", "application/javascript"));
