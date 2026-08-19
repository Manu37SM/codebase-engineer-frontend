import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ActivityIndicator from "./ActivityIndicator";

describe("ActivityIndicator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the label and a live elapsed-time counter that increases over time", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
    const { container } = render(<ActivityIndicator label="Running the project's real test command" />);

    expect(screen.getByText(/Running the project's real test command/)).toBeInTheDocument();
    expect(container.textContent).toContain("(0.0s)");

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(container.textContent).toMatch(/\(1\.[0-9]s\)/);
  });

  it("never shows a fabricated percentage — only label and elapsed time", () => {
    render(<ActivityIndicator label="Scanning the repository for findings" />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
