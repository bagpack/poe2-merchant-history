import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { launchExtensionContext } from "./extension-test-utils.js";

const TRADE_FETCH_FIXTURE = JSON.parse(
  await readFile(new URL("../fixtures/trade-search-response.json", import.meta.url), "utf8")
);

test("network globals remain untouched and passive traffic is not observed", async () => {
  const extension = await launchExtensionContext();

  try {
    await extension.context.addInitScript(() => {
      window.__networkReferencesBeforeExtension = {
        fetch: window.fetch,
        xhrOpen: XMLHttpRequest.prototype.open,
        xhrSend: XMLHttpRequest.prototype.send,
      };
      window.fetch.debounce = () => "preserved";
    });
    await extension.context.route("https://www.pathofexile.com/trade2/test", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<main>fixture</main>" })
    );
    await extension.context.route("https://www.pathofexile.com/api/trade2/fetch/item-1", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", json: TRADE_FETCH_FIXTURE })
    );

    const page = await extension.context.newPage();
    await page.goto("https://www.pathofexile.com/trade2/test");

    const result = await page.evaluate(async () => {
      const messages = [];
      window.addEventListener("message", (event) => {
        try {
          const message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (message?.channel === "poe2-purchase-history/network/v1") {
            messages.push(message);
          }
        } catch {
          // Ignore unrelated non-JSON site messages.
        }
      });

      const fetchBody = await fetch("https://www.pathofexile.com/api/trade2/fetch/item-1").then(
        (response) => response.json()
      );
      const xhrBody = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "https://www.pathofexile.com/api/trade2/fetch/item-1");
        xhr.onload = () => resolve(JSON.parse(xhr.responseText));
        xhr.onerror = () => reject(new Error("XHR request failed"));
        xhr.send();
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const initial = window.__networkReferencesBeforeExtension;
      return {
        fetchBody,
        xhrBody,
        fetchSame: window.fetch === initial.fetch,
        xhrOpenSame: XMLHttpRequest.prototype.open === initial.xhrOpen,
        xhrSendSame: XMLHttpRequest.prototype.send === initial.xhrSend,
        fetchDebounceResult: window.fetch.debounce(),
        messages,
      };
    });

    expect(result.fetchBody).toEqual(TRADE_FETCH_FIXTURE);
    expect(result.xhrBody).toEqual(TRADE_FETCH_FIXTURE);
    expect(result.fetchSame).toBe(true);
    expect(result.xhrOpenSame).toBe(true);
    expect(result.xhrSendSame).toBe(true);
    expect(result.fetchDebounceResult).toBe("preserved");
    expect(result.messages).toEqual([]);
  } finally {
    await extension.dispose();
  }
});
