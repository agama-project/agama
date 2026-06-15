/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { useTerminal } from "~/context/terminal";
import TerminalDock from "~/components/core/TerminalDock";

const APP_CONTENT = "Application content";

// jsdom has no layout, so report a fixed size. Each test sets it before
// rendering to exercise the responsive behavior.
const mockResizeObserver = (width: number, height: number) => {
  class ResizeObserverMock {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
};

// Renders TerminalDock with a button that reveals the terminal panel on demand.
const Subject = () => {
  const { show } = useTerminal();
  return (
    <>
      <button onClick={show}>open terminal</button>
      <TerminalDock>
        <div>{APP_CONTENT}</div>
      </TerminalDock>
    </>
  );
};

afterEach(() => {
  delete (window as { ResizeObserver?: unknown }).ResizeObserver;
});

describe("TerminalDock", () => {
  it("shows only the application while the terminal is hidden", () => {
    mockResizeObserver(1600, 900);
    installerRender(<Subject />);

    expect(screen.getByText(APP_CONTENT)).toBeVisible();
    expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
  });

  describe("when the terminal is shown and there is enough room", () => {
    it("keeps the application visible and offers a resize handle", async () => {
      mockResizeObserver(1600, 900);
      const { user } = installerRender(<Subject />);

      await user.click(screen.getByRole("button", { name: "open terminal" }));

      expect(screen.getByText(APP_CONTENT)).toBeVisible();
      screen.getByRole("region", { name: "Terminal" });
      screen.getByRole("separator", { name: "Resize terminal" });
    });
  });

  describe("when the terminal is shown but the screen is below 1024x768", () => {
    it("hides the application and explains that more space is needed", async () => {
      mockResizeObserver(1000, 700);
      const { user } = installerRender(<Subject />);

      await user.click(screen.getByRole("button", { name: "open terminal" }));

      screen.getByText("The terminal requires a larger screen size");
      expect(screen.queryByRole("separator", { name: "Resize terminal" })).toBeNull();
      expect(screen.getByText(APP_CONTENT)).not.toBeVisible();
    });

    it("can be dismissed with its hide action", async () => {
      mockResizeObserver(1000, 700);
      const { user } = installerRender(<Subject />);

      await user.click(screen.getByRole("button", { name: "open terminal" }));
      await user.click(screen.getByRole("button", { name: "Hide terminal" }));

      expect(screen.queryByRole("region", { name: "Terminal" })).toBeNull();
      expect(screen.getByText(APP_CONTENT)).toBeVisible();
    });
  });
});
