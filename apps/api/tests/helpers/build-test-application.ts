import {
  buildApplication as buildProductionApplication,
  type Application
} from "../../src/bootstrap/build-application.js";
import { loadEnvironment, type Environment } from "../../src/infrastructure/config/environment.js";
import { createTestResources, type TestResourceOverrides } from "./create-test-resources.js";

interface BuildTestApplicationOptions {
  mode?: "test";
  environment?: Environment;
  testOverrides?: TestResourceOverrides;
}

export async function buildApplication(
  options: BuildTestApplicationOptions = {}
): Promise<Application> {
  const environment =
    options.environment ??
    loadEnvironment({
      ...process.env,
      NODE_ENV: "test",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "change-this-password",
      CONVERSATION_PROVIDER: "deterministic"
    });
  const resources = await createTestResources(environment, options.testOverrides);

  return buildProductionApplication({ environment, resources });
}
