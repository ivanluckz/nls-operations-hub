import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { seedMarketplaceThemes } from "./lib/seed-theme-marketplace";

// Restore custom theme CSS from IndexedDB on load
const activeThemeId = localStorage.getItem("nls-active-theme-id");
if (activeThemeId) {
  // Defer to after app CSS loads, then apply from IndexedDB
  requestAnimationFrame(() => {
    const request = indexedDB.open("nls-themes", 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("themes")) return;
      const tx = db.transaction("themes", "readonly");
      const get = tx.objectStore("themes").get(activeThemeId);
      get.onsuccess = () => {
        const theme = get.result;
        if (theme?.cssContent) {
          const style = document.createElement("style");
          style.id = "user-custom-theme-style";
          style.textContent = theme.cssContent;
          document.head.appendChild(style);
        }
      };
    };
  });
}

createRoot(document.getElementById("root")!).render(<App />);
