import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Barlow e Barlow Condensed (OFL), auto-hospedadas: a família DIN da sinalização pública,
// a mesma da Bahnschrift usada na marca, igual em qualquer aparelho.
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import App from "./App.jsx";
import "./styles.css";

// aplica o tema salvo antes do primeiro desenho (sem "piscar" claro → escuro)
document.documentElement.dataset.tema = localStorage.getItem("ac:tema") || "escuro";
if (localStorage.getItem("ac:contraste") === "1") document.documentElement.dataset.contraste = "alto";
if (localStorage.getItem("ac:fonte") === "1") document.documentElement.classList.add("fonte-grande");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
