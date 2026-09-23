import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import * as elements from "typed-html";

const app = new Elysia()
  .use(html())
  .get("/", ({ html }) => 
       html(
         <BaseHtml>
           <body class="bg-black text-white flex flex-row divide-x">
            <BuildingContainer/> 
            <div id="canvas-center">
              <button hx-post="/clicked" hx-swap="outerHTML">
              Click me
              </button>
              <canvas id="floor-view"></canvas>
            </div>
            <TaskDetails/>
           </body>
         </BaseHtml>
       ))
  .post("/clicked", () => <div>htmx swap</div>)
  .listen(3000);

console.log(
  `Elysia running at http://${app.server?.hostname}:${app.server?.port}`
);

const BaseHtml = ({ children }: elements.Children) => `
  <!DOCTYPE html>
  <html lang="en"

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="device-width, initial-scale=1.0">
    <title>Beth stack</title>
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@4/dist/htmx.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>

${children}
`;

const BuildingContainer = () => (
  <div>
    <p>Building container</p>
  </div>
)

const TaskDetails = () => (
  <div>
    <p>Tasks Details</p>
  </div>
)
