import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Restore custom theme on app load (deferred to ensure it loads after app CSS)
const savedThemeUrl = localStorage.getItem("nls-active-theme-url");
if (savedThemeUrl) {
  requestAnimationFrame(() => {
    const link = document.createElement("link");
    link.id = "user-custom-theme";
    link.rel = "stylesheet";
    link.href = savedThemeUrl;
    document.head.appendChild(link);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
