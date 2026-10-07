import { useEffect, useState } from "react";

type Tema = "light" | "dark" | "system";

export function useTheme() {
  const [tema, setTemaState] = useState<Tema>(() => {
    const saved = localStorage.getItem("tema");
    return (saved as Tema) || "system";
  });

  useEffect(() => {
    if (tema === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", tema);
    }
    localStorage.setItem("tema", tema);
  }, [tema]);

  return { tema, setTema: setTemaState };
}