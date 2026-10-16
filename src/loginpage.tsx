import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { appendUser, loadUsers } from "./consts";
import { BaseHtml } from "./layout";

export const LoginContainer = () => (
  <form
    class="bg-violet-500 flex flex-col px-[28%]"
    hx-target="#login-msg"
    hx-swap="innerHTML"
  >
    <h1>Username</h1>
    <input class="text-black" type="text" name="username" id="LoginUsername" />
    <h1>Password</h1>
    <input class="text-black" type="password" name="password" id="LoginPassword" />
    <button type="submit" hx-post="/login" class="bg-blue-500 text-orange">Login</button>
    <button type="submit" hx-post="/register" class="bg-blue-500 text-orange">Create Account</button>
    <div id="login-msg"></div>
  </form>
);

export const LoginPage = () => (
  <BaseHtml>
    <body class="bg-black text-white flex flex-col">
      <LoginContainer />
    </body>
  </BaseHtml>
);

const credentials = {
  body: t.Object({
    username: t.String(),
    password: t.String(),
  }),
};

export const loginRoutes = new Elysia()
  .post(
    "/register",
    async ({ body, set }) => {
      const username = body.username.trim();
      if (!username || !body.password) {
        return <p class="text-red-400">Username and password are required.</p>;
      }
      const users = await loadUsers();
      if (users.has(username)) {
        return <p class="text-red-400">That username is already taken.</p>;
      }
      const hash = await Bun.password.hash(body.password);
      await appendUser(username, hash);
      set.headers["HX-Redirect"] = "/dashboard";
      return "";
    },
    credentials
  )
  .post(
    "/login",
    async ({ body, set }) => {
      const username = body.username.trim();
      const hash = (await loadUsers()).get(username);
      if (!hash || !(await Bun.password.verify(body.password, hash))) {
        return <p class="text-red-400">Invalid username or password.</p>;
      }
      set.headers["HX-Redirect"] = "/dashboard";
      return "";
    },
    credentials
  );
