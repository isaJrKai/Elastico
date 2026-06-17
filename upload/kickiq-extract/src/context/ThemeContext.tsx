import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "emerald" | "blue" | "crimson";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("kickiq_theme") as Theme) || "emerald");

  useEffect(() => {
    localStorage.setItem("kickiq_theme", theme);
  }, [theme]);

  // Optionally, apply theme class directly to document body or a wrapper
  useEffect(() => {
    document.body.className = document.body.className.replace(/(^|\s)theme-\S+/g, "");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
