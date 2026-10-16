import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  readCachedAppearance,
} from "@services/appearance";
import "./styles/global.css";

applyAppearance(readCachedAppearance() ?? DEFAULT_APPEARANCE);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
