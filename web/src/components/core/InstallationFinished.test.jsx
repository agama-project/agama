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
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { EncryptionMethods } from "~/client/storage";
import InstallationFinished from "./InstallationFinished";

jest.mock("~/queries/status", () => ({
  ...jest.requireActual("~/queries/status"),
  useInstallerStatus: () => ({ isBusy: false, useIguana: false, phase: 2, canInstall: false }),
}));

jest.mock("~/client");
jest.mock("~/components/core/InstallerOptions", () => () => <div>Installer Options</div>);

const finishInstallationFn = jest.fn();
let encryptionPassword;
let encryptionMethod;

describe("InstallationFinished", () => {
  beforeEach(() => {
    encryptionPassword = "n0tS3cr3t";
    encryptionMethod = EncryptionMethods.LUKS2;
    createClient.mockImplementation(() => {
      return {
        manager: {
          finishInstallation: finishInstallationFn,
          useIguana: () => Promise.resolve(false),
        },
        storage: {
          proposal: {
            getResult: jest.fn().mockResolvedValue({
              settings: { encryptionMethod, encryptionPassword },
            }),
          },
        },
      };
    });
  });

  it("shows the finished installation screen", () => {
    installerRender(<InstallationFinished />);
    screen.getByText("Congratulations!");
  });

  it("shows a 'Reboot' button", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("button", { name: /Reboot/i });
  });

  it("reboots the system if the user clicks on 'Reboot' button", async () => {
    const { user } = installerRender(<InstallationFinished />);
    const rebootButton = screen.getByRole("button", { name: /Reboot/i });
    await user.click(rebootButton);
    expect(finishInstallationFn).toHaveBeenCalled();
  });

  describe("when TPM is set as encryption method", () => {
    beforeEach(() => {
      encryptionMethod = EncryptionMethods.TPM;
    });

    describe("and encryption was set", () => {
      it("shows the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        await screen.findAllByText(/TPM/);
      });
    });

    describe("but encryption was not set", () => {
      beforeEach(() => {
        encryptionPassword = "";
      });

      it("does not show the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        screen.queryAllByText(/TPM/);
      });
    });
  });

  describe("when TPM is not set as encryption method", () => {
    it("does not show the TPM reminder", async () => {
      installerRender(<InstallationFinished />);
      expect(screen.queryAllByText(/TPM/)).toHaveLength(0);
    });
  });
});
