import { PopupApp } from "./popup/app.js";

const app = new PopupApp();

// Why: We surface initialization failures so popup bootstrap issues are diagnosable.
void app.init();
