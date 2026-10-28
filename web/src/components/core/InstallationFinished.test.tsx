/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { installerRender, mockRoutes, mockStage } from "~/test-utils";
import { ROOT } from "~/routes/paths";
import InstallationFinished from "~/components/core/InstallationFinished";

const mockUseIsGrub2WithTpm = jest.fn();
jest.mock("~/hooks/model/storage/config-model", () => ({
  useIsGrub2WithTpm: () => mockUseIsGrub2WithTpm(),
}));

describe("InstallationFinished", () => {
  beforeEach(() => {
    mockUseIsGrub2WithTpm.mockReturnValue(false);
    mockStage("finished");
    mockRoutes(ROOT.installationFinished);
  });

  it("shows the finished installation screen", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("heading", { level: 1, name: "Installation complete" });
  });

  it("shows a 'Reboot' button", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("button", { name: /Reboot/i });
  });

  it("shows the installer options menu", async () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("button", { name: /More options/i });
  });

  it("includes an option for downloading the logs", async () => {
    const { user } = installerRender(<InstallationFinished />);
    await user.click(screen.getByRole("button", { name: /More options/i }));
    screen.getByRole("menuitem", { name: /Download logs/i });
  });

  it("includes an option to show the configuration", async () => {
    const { user } = installerRender(<InstallationFinished />);
    await user.click(screen.getByRole("button", { name: /More options/i }));
    screen.getByRole("menuitem", { name: /Show configuration/i });
  });

  describe("when using grub2 with TPM", () => {
    beforeEach(() => {
      mockUseIsGrub2WithTpm.mockReturnValue(true);
    });

    it("shows the TPM reminder", async () => {
      installerRender(<InstallationFinished />);
      await screen.findAllByText(/TPM/);
    });
  });

  describe("when not using grub2 with TPM", () => {
    beforeEach(() => {
      mockUseIsGrub2WithTpm.mockReturnValue(false);
    });

    it("does not show the TPM reminder", async () => {
      installerRender(<InstallationFinished />);
      expect(screen.queryAllByText(/TPM/)).toHaveLength(0);
    });
  });
});
