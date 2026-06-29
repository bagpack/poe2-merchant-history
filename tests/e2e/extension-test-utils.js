import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const EXTENSION_PATH = path.resolve("dist");

export async function launchExtensionContext() {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "poe2mh-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    acceptDownloads: true,
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker");
  }

  const extensionId = new URL(serviceWorker.url()).host;

  return {
    context,
    extensionId,
    async dispose() {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}
