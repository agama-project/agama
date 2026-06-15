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
import TerminalPane from "~/components/core/TerminalPane";

describe("TerminalPane", () => {
  describe("when there is not enough room", () => {
    it("shows the message and only the hide action", () => {
      installerRender(<TerminalPane enoughSpace={false} />);

      screen.getByText("The terminal requires a larger screen size");
      screen.getByRole("button", { name: "Hide terminal" });
      expect(screen.queryByRole("button", { name: "Minimize terminal" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear terminal" })).toBeNull();
    });
  });

  describe("when there is enough room", () => {
    it("shows the description and the full set of actions", () => {
      installerRender(<TerminalPane enoughSpace />);

      screen.getByText(
        "Linux command-line with administrative privileges on the installer system.",
      );
      screen.getByRole("button", { name: "Decrease font size" });
      screen.getByRole("button", { name: "Increase font size" });
      screen.getByRole("button", { name: "Clear terminal" });
      screen.getByRole("button", { name: "Minimize terminal" });
      screen.getByRole("button", { name: "Hide terminal" });
    });

    it("collapses to a bar when minimized, dropping the description and tools", async () => {
      const { user } = installerRender(<TerminalPane enoughSpace />);

      await user.click(screen.getByRole("button", { name: "Minimize terminal" }));

      screen.getByRole("button", { name: "Restore terminal" });
      expect(screen.queryByRole("button", { name: "Clear terminal" })).toBeNull();
      expect(
        screen.queryByText(
          "Linux command-line with administrative privileges on the installer system.",
        ),
      ).toBeNull();
    });
  });
});
