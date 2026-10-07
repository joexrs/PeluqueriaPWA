import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABELS = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

export default function ThemeToggle() {
  const { tema, setTema } = useTheme();

  const ciclo: Array<"light" | "dark" | "system"> = ["system", "light", "dark"];

  function handleClick() {
    const idx = ciclo.indexOf(tema);
    setTema(ciclo[(idx + 1) % ciclo.length]);
  }

  const Icon = ICONS[tema];

  return (
    <button
      onClick={handleClick}
      title={`Tema: ${LABELS[tema]}`}
      className="theme-toggle"
      aria-label={`Cambiar tema. Actual: ${LABELS[tema]}`}
    >
      <Icon size={18} strokeWidth={1.25} />
    </button>
  );
}