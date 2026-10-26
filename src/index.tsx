import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import * as elements from "typed-html";
import { LoginPage, loginRoutes } from "./loginpage";
import { projectRoutes } from "./projectselect";
import { sheetRoutes } from "./sheetRoutes";
import { taskRoutes } from "./taskRoutes";

const app = new Elysia()
  .use(html())
  .get("/", () => <LoginPage />)
  .use(loginRoutes)
  .use(projectRoutes)
  .use(sheetRoutes)
  .use(taskRoutes)
  .listen(3000);

console.log(
  `Elysia running at http://${app.server?.hostname}:${app.server?.port}`
);

