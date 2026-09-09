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
import { installerRender, mockStage } from "~/test-utils";
import { useTerminal } from "~/context/terminal";
import App from "~/App";

// Regression test for the bug where starting the installation (or reaching
// the failed/finished screens) tore down the terminal panel, because those
// screens were rendered outside the <TerminalDock>. See App.tsx: the panel
// must stay mounted across every stage, not just the pre-install pages.
//
// ~/hooks/model/status, ~/hooks/model/config/product and ~/hooks/model/system
// are already globally mocked by ~/test-utils (see mockStage there); only the
// hooks left unmocked by it are stubbed here.

jest.mock("~/hooks/model/proposal", () => ({
  ...jest.requireActual("~/hooks/model/proposal"),
  useProposal: () => undefined,
  useProposalChanges: () => {},
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => [],
  useIssuesChanges: () => {},
}));

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => undefined,
}));

jest.mock("~/hooks/use-product-appearance", () => () => undefined);

// Keep the stage screens as simple markers: their own data needs are already
// covered by their dedicated tests, and are irrelevant here.
jest.mock("~/components/core", () => ({
  ...jest.requireActual("~/components/core"),
  InstallationProgress: () => <div>Installing screen</div>,
  InstallationFinished: () => <div>Finished screen</div>,
}));

jest.mock("~/components/core/InstallationFailed", () => () => <div>Failed screen</div>);

// jsdom has no layout, so report a fixed, large-enough size for TerminalDock.
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 1600, height: 900 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}

// A button sharing the same TerminalProvider as <App/>, used to open the
// terminal the way the real "Open terminal" menu entry would.
const OpenTerminalButton = () => {
  const { open } = useTerminal();
  return <button onClick={open}>open terminal</button>;
};

const Subject = () => (
  <>
    <OpenTerminalButton />
    <App />
  </>
);

describe("App", () => {
  beforeEach(() => {
    window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it("keeps the terminal panel mounted across installation stages", async () => {
    mockStage("installing");
    const { user, rerender } = installerRender(<Subject />);

    screen.getByText("Installing screen");
    await user.click(screen.getByRole("button", { name: "open terminal" }));
    screen.getByRole("region", { name: "Terminal" });

    mockStage("finished");
    rerender(<Subject />);

    screen.getByText("Finished screen");
    screen.getByRole("region", { name: "Terminal" });

    mockStage("failed");
    rerender(<Subject />);

    screen.getByText("Failed screen");
    screen.getByRole("region", { name: "Terminal" });
  });
});
