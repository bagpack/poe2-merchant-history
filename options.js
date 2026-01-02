import {
  applyTranslations,
  getHostForLanguage,
  getLocaleForLanguage,
  loadUiLanguage,
  normalizeLanguage,
  t,
} from "./i18n.js";

const cookieList = document.getElementById("cookie-list");
const refreshButton = document.getElementById("refresh-cookies");

const cookieNames = ["POESESSID"];

let currentLanguage = "en";

function getCookie(name) {
  const host = getHostForLanguage(currentLanguage);
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

function formatExpiration(cookie) {
  if (!cookie || !cookie.expirationDate) {
    return "-";
  }
  const date = new Date(cookie.expirationDate * 1000);
  return date.toLocaleString(getLocaleForLanguage(currentLanguage));
}

function renderCookies(cookies) {
  cookieList.innerHTML = "";
  cookies.forEach((cookie) => {
    const row = document.createElement("div");
    row.className = "cookie-row";

    const name = document.createElement("div");
    name.textContent = cookie.name;

    const status = document.createElement("div");
    if (cookie.value) {
      status.className = "status-ok";
      status.textContent = t(currentLanguage, "cookieStatusOk", {
        date: formatExpiration(cookie),
      });
    } else {
      status.className = "status-missing";
      status.textContent = t(currentLanguage, "cookieStatusMissing");
    }

    row.appendChild(name);
    row.appendChild(status);
    cookieList.appendChild(row);
  });
}

async function loadCookies() {
  const results = await Promise.all(cookieNames.map((name) => getCookie(name)));
  const formatted = cookieNames.map((name, index) => ({
    name,
    value: results[index]?.value || null,
    expirationDate: results[index]?.expirationDate || null,
  }));
  renderCookies(formatted);
}

refreshButton.addEventListener("click", loadCookies);

async function init() {
  const storedLanguage = await loadUiLanguage();
  currentLanguage = normalizeLanguage(storedLanguage);
  document.documentElement.lang = currentLanguage;
  applyTranslations(document, currentLanguage);
  loadCookies();
}

init();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.uiLanguage) {
    return;
  }
  currentLanguage = normalizeLanguage(changes.uiLanguage.newValue);
  document.documentElement.lang = currentLanguage;
  applyTranslations(document, currentLanguage);
  loadCookies();
});
