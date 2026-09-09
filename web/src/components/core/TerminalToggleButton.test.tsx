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
import { plainRender } from "~/test-utils";
import TerminalToggleButton from "./TerminalToggleButton";

describe("TerminalToggleButton", () => {
  it("renders an 'Open terminal' button when the terminal is closed", () => {
    plainRender(<TerminalToggleButton />);
    screen.getByRole("button", { name: "Open terminal" });
  });

  it("toggles to 'Close terminal' once clicked, and back when clicked again", async () => {
    const { user } = plainRender(<TerminalToggleButton />);

    const button = screen.getByRole("button", { name: "Open terminal" });
    await user.click(button);
    screen.getByRole("button", { name: "Close terminal" });

    await user.click(screen.getByRole("button", { name: "Close terminal" }));
    screen.getByRole("button", { name: "Open terminal" });
  });

  it("accepts custom props", () => {
    plainRender(<TerminalToggleButton data-testid="custom-terminal-toggle" />);
    screen.getByTestId("custom-terminal-toggle");
  });

  it("allows overriding size and variant", () => {
    plainRender(<TerminalToggleButton size="sm" variant="secondary" />);
    const button = screen.getByRole("button", { name: "Open terminal" });
    expect(button).toHaveClass("pf-m-secondary");
    expect(button).toHaveClass("pf-m-small");
  });
});
