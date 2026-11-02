import { Elysia, t } from "elysia";
import * as elements from "typed-html";
import { appendUser, loadUsers } from "./consts";
import { BaseHtml } from "./layout";

export const LoginContainer = () => (
  <form
    class="card flex w-full max-w-sm flex-col gap-4 p-8"
    hx-target="#login-msg"
    hx-swap="innerHTML"
  >
    <div class="mb-2">
      <h1 class="text-2xl font-semibold">StudentsPlangrid</h1>
      <p class="muted mt-1">Sign in to see your buildings and plans.</p>
    </div>
    <label class="flex flex-col gap-1.5">
      <span class="label">Username</span>
      <input class="input" type="text" name="username" id="LoginUsername" autocomplete="username" />
    </label>
    <label class="flex flex-col gap-1.5">
      <span class="label">Password</span>
      <input class="input" type="password" name="password" id="LoginPassword" autocomplete="current-password" />
    </label>
    <button type="submit" hx-post="/login" class="btn btn-primary mt-2">Log in</button>
    <button type="submit" hx-post="/register" class="btn">Create account</button>
    <div id="login-msg" class="text-sm"></div>
  </form>
);

export const LoginPage = () => (
  <BaseHtml title="Log in">
    <body class="flex min-h-screen items-center justify-center p-6">
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
    async ({ body, set, cookie: { auth_user } }) => {
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

      // Create a session
      auth_user.value = username;
      auth_user.httpOnly = true;
      auth_user.path = "/";

      set.headers["HX-Redirect"] = "/projects";
      return "";
    },
    credentials
  )
  .post(
    "/login",
    async ({ body, set, cookie: { auth_user } }) => {
      const username = body.username.trim();
      const hash = (await loadUsers()).get(username);
      if (!hash || !(await Bun.password.verify(body.password, hash))) {
        return <p class="text-red-400">Invalid username or password.</p>;
      }

      // Create a session
      auth_user.value = username;
      auth_user.httpOnly = true;
      auth_user.path = "/";

      set.headers["HX-Redirect"] = "/projects";
      return "";
    },
    credentials
  );
