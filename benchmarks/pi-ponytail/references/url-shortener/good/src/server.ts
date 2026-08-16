import { createApp } from "./app.js";

const app = createApp();

export default {
  port: 3000,
  fetch: app.fetch,
};
