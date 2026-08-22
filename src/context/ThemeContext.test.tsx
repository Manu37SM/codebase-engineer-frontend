import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>
  );
}

describe("ThemeContext (dark mode only — the light/dark toggle was removed per explicit request)", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("always resolves to dark, regardless of any prior stored preference", () => {
    renderProbe();
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("applies the dark class to <html> unconditionally", () => {
    renderProbe();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
