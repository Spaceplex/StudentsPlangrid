import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import * as elements from "typed-html";
import { LoginPage, loginRoutes } from "./loginpage";
import { dashboardRoutes } from "./dashboard";

const app = new Elysia()
  .use(html())
  .get("/", () => <LoginPage />)
  .use(loginRoutes)
  .use(dashboardRoutes)
  .listen(3000);

console.log(
  `Elysia running at http://${app.server?.hostname}:${app.server?.port}`
);
