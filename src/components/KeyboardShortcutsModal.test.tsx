import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import KeyboardShortcutsModal, { OPEN_SHORTCUTS_EVENT } from "./KeyboardShortcutsModal";

describe("KeyboardShortcutsModal", () => {
  it("is closed by default", () => {
    render(<KeyboardShortcutsModal />);
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens via the '?' key", async () => {
    render(<KeyboardShortcutsModal />);
    const user = userEvent.setup();
    await user.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("does not open when '?' is typed inside a text field", async () => {
    render(
      <div>
        <input aria-label="some field" />
        <KeyboardShortcutsModal />
      </div>
    );
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("some field"));
    await user.keyboard("?");
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens via the custom open event", async () => {
    render(<KeyboardShortcutsModal />);
    window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<KeyboardShortcutsModal />);
    const user = userEvent.setup();
    await user.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("lists the command palette and shortcuts-help key combos", async () => {
    render(<KeyboardShortcutsModal />);
    window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(screen.getByText("⌘K / Ctrl K")).toBeInTheDocument();
    expect(screen.getAllByText("?").length).toBeGreaterThan(0);
  });
});
