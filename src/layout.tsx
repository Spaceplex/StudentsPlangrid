import * as elements from "typed-html";

export const BaseHtml = ({ children }: elements.Children) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beth stack</title>
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@4/dist/htmx.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  ${children}
`;
