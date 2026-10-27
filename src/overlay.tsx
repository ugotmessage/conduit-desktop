import React from "react";
import ReactDOM from "react-dom/client";
import { initializeLanguage } from "./lib/i18n";
import "./index.css";

void initializeLanguage().then(async () => {
  const [{ default: OverlayApp }, { bootIconPack }] = await Promise.all([import("./components/overlay/OverlayApp"), import("./lib/icons")]);
  void bootIconPack();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode><OverlayApp /></React.StrictMode>
  );
});
