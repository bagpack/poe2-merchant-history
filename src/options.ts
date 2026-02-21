import {
  applyTranslations,
  getHostForLanguage,
  getLocaleForLanguage,
  loadUiLanguage,
  normalizeLanguage,
  t,
} from "./i18n.js";

type CookieViewModel = {
  name: string;
  value: string | null;
  expirationDate: number | null;
};

class CookieService {
  constructor(private readonly getLanguage: () => string) {}

  async getCookie(name: string): Promise<chrome.cookies.Cookie | null> {
    const host = getHostForLanguage(this.getLanguage());
    return new Promise((resolve) => {
      chrome.cookies.get(
        {
          url: `https://${host}`,
          name,
        },
        (cookie) => resolve(cookie || null)
      );
    });
  }
}

class CookieStatusPresenter {
  constructor(
    private readonly container: HTMLElement,
    private readonly getLanguage: () => string
  ) {}

  render(cookies: CookieViewModel[]): void {
    this.container.innerHTML = "";
    cookies.forEach((cookie) => {
      const row = document.createElement("div");
      row.className = "cookie-row";

      const name = document.createElement("div");
      name.textContent = cookie.name;

      const status = document.createElement("div");
      if (cookie.value) {
        status.className = "status-ok";
        status.textContent = t(this.getLanguage(), "cookieStatusOk", {
          date: this.formatExpiration(cookie),
        });
      } else {
        status.className = "status-missing";
        status.textContent = t(this.getLanguage(), "cookieStatusMissing");
      }

      row.appendChild(name);
      row.appendChild(status);
      this.container.appendChild(row);
    });
  }

  private formatExpiration(cookie: CookieViewModel): string {
    if (!cookie.expirationDate) {
      return "-";
    }
    const date = new Date(cookie.expirationDate * 1000);
    return date.toLocaleString(getLocaleForLanguage(this.getLanguage()));
  }
}

class OptionsPageController {
  private readonly cookieNames = ["POESESSID"];
  private currentLanguage = "en";

  private readonly cookieListElement: HTMLElement;
  private readonly refreshButton: HTMLButtonElement;
  private readonly cookieService: CookieService;
  private readonly presenter: CookieStatusPresenter;

  constructor() {
    const cookieList = document.getElementById("cookie-list");
    const refreshButton = document.getElementById("refresh-cookies");

    if (!(cookieList instanceof HTMLElement)) {
      throw new Error("cookie list element not found");
    }
    if (!(refreshButton instanceof HTMLButtonElement)) {
      throw new Error("refresh button element not found");
    }

    this.cookieListElement = cookieList;
    this.refreshButton = refreshButton;
    this.cookieService = new CookieService(() => this.currentLanguage);
    this.presenter = new CookieStatusPresenter(this.cookieListElement, () => this.currentLanguage);
  }

  async init(): Promise<void> {
    this.refreshButton.addEventListener("click", () => {
      void this.loadCookies();
    });

    const storedLanguage = await loadUiLanguage();
    this.currentLanguage = normalizeLanguage(storedLanguage);
    this.applyLanguage();
    await this.loadCookies();

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.uiLanguage) {
        return;
      }
      const nextLanguage = normalizeLanguage(String(changes.uiLanguage.newValue || "en"));
      this.currentLanguage = nextLanguage;
      this.applyLanguage();
      void this.loadCookies();
    });
  }

  private applyLanguage(): void {
    document.documentElement.lang = this.currentLanguage;
    applyTranslations(document, this.currentLanguage);
  }

  private async loadCookies(): Promise<void> {
    const results = await Promise.all(
      this.cookieNames.map((name) => this.cookieService.getCookie(name))
    );
    const viewModels: CookieViewModel[] = this.cookieNames.map((name, index) => ({
      name,
      value: results[index]?.value || null,
      expirationDate: results[index]?.expirationDate || null,
    }));
    this.presenter.render(viewModels);
  }
}

const controller = new OptionsPageController();
// Why: Startup failures on options page should still be visible in console instead of
// silently failing and showing stale cookie state.
void controller.init();
