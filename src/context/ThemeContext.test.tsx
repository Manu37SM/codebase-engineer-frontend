import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("system")}>use system</button>
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

describe("ThemeContext", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    // jsdom has no real matchMedia; stub it to report "light" by default.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system preference (light, per the jsdom stub) when nothing is stored", () => {
    renderProbe();
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggling applies the dark class to <html> and persists the explicit choice", async () => {
    renderProbe();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => expect(screen.getByTestId("resolved")).toHaveTextContent("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("codebase-engineer.theme")).toBe("dark");
  });

  it("reads a previously stored explicit preference on mount", () => {
    window.localStorage.setItem("codebase-engineer.theme", "dark");
    renderProbe();
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggling back to system re-derives from the OS preference", async () => {
    window.localStorage.setItem("codebase-engineer.theme", "dark");
    renderProbe();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "use system" }));

    await waitFor(() => expect(screen.getByTestId("theme")).toHaveTextContent("system"));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });
});
