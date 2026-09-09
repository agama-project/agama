/*
 * Copyright (c) [2024-2026] SUSE LLC
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
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender, plainRender } from "~/test-utils";
import type { Product } from "~/model/system";
import { useTerminal } from "~/context/terminal";
import Header from "./Header";

/** Controls for driving the terminal state the header reacts to, and a readout of it. */
const TerminalControls = () => {
  const { open, minimize, isMinimized } = useTerminal();

  return (
    <>
      <button onClick={open}>Open the terminal</button>
      <button onClick={minimize}>Minimize the terminal</button>
      {isMinimized && <p>The terminal is minimized</p>}
    </>
  );
};

const tumbleweed: Product = {
  id: "Tumbleweed",
  name: "openSUSE Tumbleweed",
  description: "Tumbleweed description...",
  registration: false,
  modes: [],
};

jest.mock("~/hooks/model/config/product", () => ({
  ...jest.requireActual("~/hooks/model/config/product"),
  useProductInfo: (): Product => tumbleweed,
}));

describe("Header", () => {
  it("renders given title as heading level 1", () => {
    plainRender(<Header title={tumbleweed.name} />);
    screen.getByRole("heading", { name: tumbleweed.name, level: 1 });
  });

  it("renders the product name and the 'Installation' breadcrumb when no title is given", () => {
    installerRender(<Header breadcrumbs={[{ label: "Authentication", path: "/auth" }]} />);
    screen.getByText(tumbleweed.name);
    screen.getByRole("link", { name: "Installation" });
  });

  it("omits the 'Installation' breadcrumb when hideSummaryLink is set", () => {
    installerRender(<Header hideSummaryLink breadcrumbs={[{ label: "Installation summary" }]} />);
    screen.getByText(tumbleweed.name);
    expect(screen.queryByRole("link", { name: "Installation" })).toBeNull();
    screen.getByRole("heading", { name: "Installation summary", level: 1 });
  });

  it("renders skip to content link", async () => {
    plainRender(<Header />);
    screen.getByRole("link", { name: "Skip to content" });
  });

  it("does not render skip to content link when hideSkipToContent is truthy", async () => {
    const { rerender } = plainRender(<Header hideSkipToContent />);
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
    rerender(<Header hideSkipToContent={false} />);
    screen.queryByRole("link", { name: "Skip to content" });
  });

  it("renders a skip to terminal link while the terminal is open", async () => {
    const { user } = plainRender(
      <>
        <Header />
        <TerminalControls />
      </>,
    );

    expect(screen.queryByRole("link", { name: "Skip to terminal" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open the terminal" }));

    expect(screen.getByRole("link", { name: "Skip to terminal" })).toHaveAttribute(
      "href",
      "#terminal-input",
    );

    // Still reachable once collapsed to a bar: it is the same page, and the
    // terminal is still there.
    await user.click(screen.getByRole("button", { name: "Minimize the terminal" }));

    screen.getByRole("link", { name: "Skip to terminal" });
  });

  it("expands a collapsed terminal when skipping to it", async () => {
    const { user } = plainRender(
      <>
        <Header />
        <TerminalControls />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Open the terminal" }));
    await user.click(screen.getByRole("button", { name: "Minimize the terminal" }));
    screen.getByText("The terminal is minimized");

    await user.click(screen.getByRole("link", { name: "Skip to terminal" }));

    expect(screen.queryByText("The terminal is minimized")).toBeNull();
  });

  it("renders the given additional content", () => {
    plainRender(
      <Header
        title="Storage"
        additionalContent={
          <>
            <div role="progressbar" aria-label="Installation progress" />
            <div role="menu" aria-label="Page actions">
              <button role="menuitem">Export configuration</button>
              <button role="menuitem">Advanced settings</button>
            </div>
            <button>Install</button>
          </>
        }
      />,
    );

    screen.getByRole("progressbar", { name: "Installation progress" });
    screen.getByRole("menu", { name: "Page actions" });
    screen.getByRole("button", { name: "Install" });
  });
});
