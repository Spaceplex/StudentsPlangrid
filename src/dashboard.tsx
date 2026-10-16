import { Elysia } from "elysia";
import * as elements from "typed-html";
import { BaseHtml } from "./layout";

export const DashboardPage = () => (
  <BaseHtml>
    <body class="bg-black text-white">
      <h1 class="p-8 text-2xl">Dashboard</h1>
      <p class="px-8">Coming soon.</p>
    </body>
  </BaseHtml>
);

export const dashboardRoutes = new Elysia().get("/dashboard", () => <DashboardPage />);
