/*
 * Copyright (c) [2025] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender, mockProgresses } from "~/test-utils";
import ProgressStatusMonitor from "./ProgressStatusMonitor";

describe("ProgressStatusMonitor", () => {
  describe("when there are no tasks in background", () => {
    it("renders a disabled button with no content", () => {
      installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toBeEmptyDOMElement();
    });

    it("does nothing when the button is clicked", async () => {
      const { user } = installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button");
      await user.click(button);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("when there are running tasks", () => {
    beforeEach(() => {
      mockProgresses([
        {
          scope: "software",
          size: 3,
          steps: [
            "Updating the list of repositories",
            "Refreshing metadata from the repositories",
            "Calculating the software proposal",
          ],
          step: "Refreshing metadata from the repositories",
          index: 2,
        },
      ]);
    });

    it("renders an enabled button with PatternFly 'in-progress' modifier", () => {
      installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button");
      expect(button).toBeEnabled();
      expect(button.classList).toContain("pf-m-in-progress");
    });

    it("renders a popover with tasks details when the button is clicked", async () => {
      const { user } = installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button");
      await user.click(button);
      const popover = screen.getByRole("dialog", { name: "1 task active" });
      within(popover).getByText("Software");
    });
  });
});
