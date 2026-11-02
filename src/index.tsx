import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import * as elements from "typed-html";
import { LoginPage, loginRoutes } from "./loginpage";
import { projectRoutes } from "./projectselect";
import { workspaceRoutes } from "./workspace";
import { mediaRoutes } from "./mediaRoutes";
import { assetRoutes } from "./assets";

import * as sql from "./sql";
sql.getTasksFromSheet(""); //done to make sure sql runs

const app = new Elysia()
  .use(html())
  .use(assetRoutes)
  .get("/", () => <LoginPage />)
  .use(loginRoutes)
  .use(projectRoutes)
  .use(workspaceRoutes)
  .use(mediaRoutes)
  .listen(Number(process.env.PORT) || 3000);

console.log(
  `Elysia running at http://${app.server?.hostname}:${app.server?.port}`
);
