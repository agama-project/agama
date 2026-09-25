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
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { screen } from "@testing-library/react";
import { mockNavigateFn, plainRender } from "~/test-utils";
import ExitInstallationDialog from "./ExitInstallationDialog";

const mockRebootAction = jest.fn();
const mockShutdownAction = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  rebootAction: () => mockRebootAction(),
  shutdownAction: () => mockShutdownAction(),
}));

const mockUseConfig = jest.fn();

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => mockUseConfig(),
}));

const mockOnClose = jest.fn();

describe("ExitInstallationDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConfig.mockReturnValue(null);
  });

  it("renders the dialog with the correct title", () => {
    plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
    screen.getByRole("dialog", { name: "Exit installation" });
  });

  it("calls onClose when the close button is clicked", async () => {
    const { user } = plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
    const closeButton = screen.getByRole("button", { name: "Close" });
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  describe("when there is no config", () => {
    beforeEach(() => {
      mockUseConfig.mockReturnValue(null);
    });

    it("displays the safe exit message", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      screen.getByText(/You can safely reboot or shut down the system/i);
      screen.getByText(/No changes have been made to your disks/i);
    });

    it("does not display the pre-scripts warning", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      expect(screen.queryByText(/pre-scripts have been executed/i)).not.toBeInTheDocument();
    });
  });

  describe("when config has no pre-scripts", () => {
    beforeEach(() => {
      mockUseConfig.mockReturnValue({});
    });

    it("displays the safe exit message", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      screen.getByText(/You can safely reboot or shut down the system/i);
      screen.getByText(/No changes have been made to your disks/i);
    });
  });

  describe("when the config has pre-scripts", () => {
    beforeEach(() => {
      mockUseConfig.mockReturnValue({
        scripts: {
          pre: [{ name: "setup.sh", content: "#!/bin/bash\necho 'setup'" }],
        },
      });
    });

    it("displays the pre-scripts warning message", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      screen.getByText(/Configuration pre-scripts have been executed/i);
      screen.getByText(/may have modified your system/i);
    });

    it("does not display the safe exit message", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      expect(
        screen.queryByText(/No changes have been made to your disks/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("action buttons", () => {
    it("renders both reboot and shutdown buttons", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      screen.getByRole("button", { name: /Reboot/i });
      screen.getByRole("button", { name: /Shut down/i });
    });

    it("calls rebootAction and navigates to reboot page when clicking reboot", async () => {
      const { user } = plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      const rebootButton = screen.getByRole("button", { name: /Reboot/i });
      await user.click(rebootButton);
      expect(mockRebootAction).toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/installation/reboot", { replace: true });
    });

    it("calls shutdownAction and navigates to shutdown page when clicking shutdown", async () => {
      const { user } = plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      const shutdownButton = screen.getByRole("button", { name: /Shut down/i });
      await user.click(shutdownButton);
      expect(mockShutdownAction).toHaveBeenCalled();
      expect(mockNavigateFn).toHaveBeenCalledWith("/installation/shutdown", { replace: true });
    });
  });

  describe("dialog behavior", () => {
    it("is open by default", () => {
      plainRender(<ExitInstallationDialog onClose={mockOnClose} />);
      const dialog = screen.getByRole("dialog", { name: "Exit installation" });
      expect(dialog).toBeVisible();
    });
  });
});
