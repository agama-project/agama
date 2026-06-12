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
    it("renders a button with list_alt_check icon", () => {
      installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button", { name: /idle/i });
      expect(button).toBeEnabled();
      // list_alt_check icon is rendered
      expect(button.querySelector("svg")).toBeInTheDocument();
    });

    it("shows idle state in popover when clicked", async () => {
      const { user } = installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button", { name: /idle/i });
      await user.click(button);
      const popover = screen.getByRole("dialog", { name: /no pending tasks/i });
      within(popover).getByText(/all background tasks completed/i);
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

    it("shows spinner immediately when tasks are active", () => {
      installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button", { name: /1 task active/i });

      // Shows spinner immediately
      expect(button.classList).toContain("pf-m-in-progress");
    });

    it("renders a popover with tasks details when the button is clicked", async () => {
      const { user } = installerRender(<ProgressStatusMonitor />);
      const button = screen.getByRole("button", { name: /1 task active/i });
      await user.click(button);
      const popover = screen.getByRole("dialog", { name: "1 task active" });
      within(popover).getByText("Software");
    });
  });

  describe("the visual tooltip", () => {
    beforeEach(() => mockProgresses([]));

    it("does not add a second source for the accessible name", () => {
      installerRender(<ProgressStatusMonitor />);
      const buttons = screen.getAllByRole("button", { name: "Status: Idle" });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).not.toHaveAttribute("aria-describedby");
    });

    it("reveals its text on hover", async () => {
      const { user } = installerRender(<ProgressStatusMonitor />);
      await user.hover(screen.getByRole("button", { name: "Status: Idle" }));
      await screen.findByText("Status: Idle");
    });
  });
});
