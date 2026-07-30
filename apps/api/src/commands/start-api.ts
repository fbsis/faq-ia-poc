import { buildApplication } from "../app.js";

const app = await buildApplication();
await app.listen({ host: "0.0.0.0", port: app.environment.PORT });

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void app.close());
}
