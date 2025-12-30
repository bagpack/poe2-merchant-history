const cookieList = document.getElementById("cookie-list");
const refreshButton = document.getElementById("refresh-cookies");

const cookieNames = ["POESESSID"];

function getCookie(name) {
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

function formatExpiration(cookie) {
  if (!cookie || !cookie.expirationDate) {
    return "-";
  }
  const date = new Date(cookie.expirationDate * 1000);
  return date.toLocaleString("ja-JP");
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
      status.textContent = `取得済み (期限: ${formatExpiration(cookie)})`;
    } else {
      status.className = "status-missing";
      status.textContent = "未取得";
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

loadCookies();
