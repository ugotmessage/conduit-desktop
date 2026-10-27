import React from "react";
import ReactDOM from "react-dom/client";
import { initializeLanguage } from "./lib/i18n";
import "./index.css";

void initializeLanguage().then(async () => {
  const [{ default: App }, { bootIconPack }, { installConnectionHistoryRecorder }, { installTitleBar }] = await Promise.all([
    import("./App"), import("./lib/icons"), import("./lib/connectionHistoryRecorder"), import("./lib/titleBar"),
  ]);
  void bootIconPack();
  installConnectionHistoryRecorder();
  installTitleBar();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode><App /></React.StrictMode>
  );
});
