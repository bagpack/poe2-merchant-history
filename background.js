import { openLeagueDb, requestToPromise, transactionComplete } from "./shared.js";

const REQUIRED_COOKIES = ["POESESSID"];

function makeError(code, message, meta) {
  const error = new Error(message);
  error.code = code;
  error.meta = meta;
  return error;
}

function normalizeHistory(apiResponse, leagueId) {
  if (!apiResponse || !Array.isArray(apiResponse.result)) {
    throw makeError("FETCH_FAILED", "resultが取得できません。", null);
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
      throw makeError("LEAGUE_MISMATCH", "リーグが一致しません。", {
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

async function getCookie(name) {
  return new Promise((resolve) => {
    chrome.cookies.get(
      {
        url: "https://jp.pathofexile.com",
        name,
      },
      (cookie) => resolve(cookie || null)
    );
  });
}

async function ensureAuthCookies() {
  const results = await Promise.all(REQUIRED_COOKIES.map((name) => getCookie(name)));
  const missing = REQUIRED_COOKIES.filter((_, index) => !results[index]);
  if (missing.length > 0) {
    throw makeError("AUTH_EXPIRED", "ログイン情報の有効期限が切れています。", {
      missing,
    });
  }
}

async function fetchHistory(leagueId) {
  const url = `https://jp.pathofexile.com/api/trade2/history/${encodeURIComponent(leagueId)}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      accept: "*/*",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "https://jp.pathofexile.com/trade2/history",
    referrerPolicy: "no-referrer-when-downgrade",
  });

  if (!response.ok) {
    throw makeError("FETCH_FAILED", "履歴の取得に失敗しました。", {
      status: response.status,
    });
  }

  return response.json();
}

async function saveRecords(leagueId, records) {
  if (records.length === 0) {
    return 0;
  }

  const db = await openLeagueDb(leagueId);
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

async function updateHistory(leagueId) {
  await enforceRateLimit();
  await ensureAuthCookies();
  const apiResponse = await fetchHistory(leagueId);
  const records = normalizeHistory(apiResponse, leagueId);
  const addedCount = await saveRecords(leagueId, records);
  return { addedCount, fetchedCount: records.length };
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
    throw makeError(
      "RATE_LIMIT",
      `更新は1分に1回までです。あと${remainingSec}秒お待ちください。`,
      { remainingSec }
    );
  }

  chrome.storage.local.set({ lastHistoryFetchAt: now });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "updateHistory") {
    updateHistory(message.leagueId)
      .then((result) => {
        sendResponse({ ok: true, result });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: {
            code: error.code || "UNKNOWN",
            message: error.message || "予期しないエラーが発生しました。",
            meta: error.meta || null,
          },
        });
      });
    return true;
  }

  sendResponse({ ok: false, error: { code: "UNKNOWN", message: "不明なリクエストです。" } });
  return false;
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
});
