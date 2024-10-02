/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { plainRender } from "~/test-utils";
import { EncryptionMethods } from "~/types/storage";
import InstallationFinished from "./InstallationFinished";

let mockEncryptionPassword: string;
let mockEncryptionMethod: string;

jest.mock("~/queries/status", () => ({
  ...jest.requireActual("~/queries/status"),
  useInstallerStatus: () => ({ isBusy: false, useIguana: false, phase: 2, canInstall: false }),
}));

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useProposalResult: () => ({
    settings: {
      encryptionMethod: mockEncryptionMethod,
      encryptionPassword: mockEncryptionPassword,
    },
  }),
}));

const mockFinishInstallation = jest.fn();

jest.mock("~/api/manager", () => ({
  ...jest.requireActual("~/api/manager"),
  finishInstallation: () => mockFinishInstallation(),
}));

jest.mock("~/components/core/InstallerOptions", () => () => <div>Installer Options</div>);

describe("InstallationFinished", () => {
  beforeEach(() => {
    mockEncryptionPassword = "n0tS3cr3t";
    mockEncryptionMethod = EncryptionMethods.LUKS2;
  });

  it("shows the finished installation screen", () => {
    plainRender(<InstallationFinished />);
    screen.getByText("Congratulations!");
  });

  it("shows a 'Reboot' button", () => {
    plainRender(<InstallationFinished />);
    screen.getByRole("button", { name: /Reboot/i });
  });

  it("reboots the system if the user clicks on 'Reboot' button", async () => {
    const { user } = plainRender(<InstallationFinished />);
    const rebootButton = screen.getByRole("button", { name: "Reboot" });
    await user.click(rebootButton);
    expect(mockFinishInstallation).toHaveBeenCalled();
  });

  describe("when TPM is set as encryption method", () => {
    beforeEach(() => {
      mockEncryptionMethod = EncryptionMethods.TPM;
    });

    describe("and encryption was set", () => {
      it("shows the TPM reminder", async () => {
        plainRender(<InstallationFinished />);
        await screen.findAllByText(/TPM/);
      });
    });

    describe("but encryption was not set", () => {
      beforeEach(() => {
        mockEncryptionPassword = "";
      });

      it("does not show the TPM reminder", async () => {
        plainRender(<InstallationFinished />);
        screen.queryAllByText(/TPM/);
      });
    });
  });

  describe("when TPM is not set as encryption method", () => {
    it("does not show the TPM reminder", async () => {
      plainRender(<InstallationFinished />);
      expect(screen.queryAllByText(/TPM/)).toHaveLength(0);
    });
  });
});
