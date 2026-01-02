import { openLeagueDb, requestToPromise, transactionComplete } from "./shared.js";
import { getAcceptLanguage, getHostForLanguage } from "./i18n.js";

const REQUIRED_COOKIES = ["POESESSID"];

function makeError(code, message, meta) {
  const error = new Error(message);
  error.code = code;
  error.meta = meta;
  return error;
}

function normalizeHistory(apiResponse, leagueId) {
  if (!apiResponse || !Array.isArray(apiResponse.result)) {
    throw makeError("FETCH_FAILED", "Result is missing.", null);
  }

  const records = [];
  const seenIds = new Set();

  for (const entry of apiResponse.result) {
    const itemId = entry?.item_id;
    const item = entry?.item;
    const price = entry?.price;
    const time = entry?.time;

    if (!itemId || !item || !price || !time) {
      continue;
    }

    if (item.league !== leagueId) {
      throw makeError("LEAGUE_MISMATCH", "League mismatch.", {
        expectedLeague: leagueId,
        actualLeague: item.league,
      });
    }

    if (seenIds.has(itemId)) {
      continue;
    }
    seenIds.add(itemId);

    records.push({
      id: itemId,
      item_name: item.name && item.name.trim() ? `${item.name} ${item.typeLine}` : item.typeLine,
      item_name_unique: item.name && item.name.trim() ? item.name : null,
      currency: price.currency,
      amount: price.amount,
      time,
      league: item.league,
      details_json: item,
      source_item_key: leagueId,
    });
  }

  return records;
}

async function getCookie(name, language) {
  const host = getHostForLanguage(language);
  return new Promise((resolve) => {
    chrome.cookies.get(
      {
        url: host,
        name,
      },
      (cookie) => resolve(cookie || null)
    );
  });
}

async function ensureAuthCookies(language) {
  const results = await Promise.all(REQUIRED_COOKIES.map((name) => getCookie(name, language)));
  const missing = REQUIRED_COOKIES.filter((_, index) => !results[index]);
  if (missing.length > 0) {
    throw makeError("AUTH_EXPIRED", "Login expired.", {
      missing,
    });
  }
}

async function fetchHistory(leagueId, language) {
  const host = getHostForLanguage(language);
  const url = `${host}/api/trade2/history/${encodeURIComponent(leagueId)}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      accept: "*/*",
      "accept-language": getAcceptLanguage(language),
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: `${host}/trade2/history`,
    referrerPolicy: "no-referrer-when-downgrade",
  });

  if (!response.ok) {
    throw makeError("FETCH_FAILED", "Failed to fetch history.", {
      status: response.status,
    });
  }

  return response.json();
}

async function saveRecords(leagueId, language, records) {
  if (records.length === 0) {
    return 0;
  }

  const db = await openLeagueDb(leagueId, language);
  const tx = db.transaction("trade_history", "readwrite");
  const store = tx.objectStore("trade_history");

  let addedCount = 0;
  try {
    for (const record of records) {
      const exists = await requestToPromise(store.get(record.id));
      if (exists) {
        continue;
      }
      const added = await addRecord(store, record);
      if (added) {
        addedCount += 1;
      }
    }
  } catch (error) {
    tx.abort();
    throw error;
  }

  await transactionComplete(tx);
  return addedCount;
}

async function countRecords(leagueId, language) {
  const db = await openLeagueDb(leagueId, language);
  const tx = db.transaction("trade_history", "readonly");
  const store = tx.objectStore("trade_history");
  const count = await requestToPromise(store.count());
  await transactionComplete(tx);
  return count;
}

async function addRecord(store, record) {
  return new Promise((resolve, reject) => {
    const request = store.add(record);
    request.onsuccess = () => resolve(true);
    request.onerror = () => {
      const error = request.error;
      if (error && error.name === "ConstraintError") {
        resolve(false);
      } else {
        reject(error || new Error("IDB_ADD_FAILED"));
      }
    };
  });
}

async function updateHistory(leagueId, language) {
  await enforceRateLimit();
  await ensureAuthCookies(language);
  const apiResponse = await fetchHistory(leagueId, language);
  const records = normalizeHistory(apiResponse, leagueId);
  const addedCount = await saveRecords(leagueId, language, records);
  const totalCount = await countRecords(leagueId, language);
  return { addedCount, fetchedCount: records.length, totalCount };
}

async function enforceRateLimit() {
  const now = Date.now();
  const lastRun = await new Promise((resolve) => {
    chrome.storage.local.get(["lastHistoryFetchAt"], (data) =>
      resolve(data.lastHistoryFetchAt || 0)
    );
  });

  const minIntervalMs = 60 * 1000;
  const elapsed = now - lastRun;
  if (elapsed < minIntervalMs) {
    const remainingMs = minIntervalMs - elapsed;
    const remainingSec = Math.ceil(remainingMs / 1000);
    throw makeError("RATE_LIMIT", `Update limited. Wait ${remainingSec} seconds.`, {
      remainingSec,
    });
  }

  chrome.storage.local.set({ lastHistoryFetchAt: now });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "updateHistory") {
    updateHistory(message.leagueId, message.language)
      .then((result) => {
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: {
            code: error.code || "UNKNOWN",
            message: error.message || "Unexpected error.",
            meta: error.meta || null,
          },
        });
      });
    return true;
  }

  sendResponse({ ok: false, error: { code: "UNKNOWN", message: "Unknown request." } });
  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
