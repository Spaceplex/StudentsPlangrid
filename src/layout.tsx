import * as elements from "typed-html";

type BaseHtmlProps = {
  children?: string | Promise<string> | string[];
};

export const BaseHtml = ({ children }: BaseHtmlProps) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StudentsPlangrid</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@4/dist/htmx.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  ${children}
  </html>
`;
