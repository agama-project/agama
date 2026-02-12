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
import { installerRender, mockStage } from "~/test-utils";
import type { Storage } from "~/model/config";
import InstallationFinished from "~/components/core/InstallationFinished";

type storageConfigType = "guided" | "raw";
type guidedEncryption = {
  password: string;
  method: string;
  pbkdFunction?: string;
};

const mockUseExtendedConfigFn = jest.fn();

const mockStorageConfig = (
  type: storageConfigType,
  encryption: undefined | Storage.Encryption | guidedEncryption,
) => {
  const encryptionHash = {};
  if (encryption !== undefined) encryptionHash["encryption"] = encryption;

  switch (type) {
    case "guided":
      return {
        storage: {
          guided: {
            ...encryptionHash,
          },
        },
      };
    case "raw":
      return {
        storage: {
          drives: [
            {
              partitions: [
                {
                  filesystem: {
                    path: "/",
                  },
                  id: "linux",
                  ...encryptionHash,
                },
                {
                  filesystem: {
                    mountBy: "uuid",
                    path: "swap",
                    type: "swap",
                  },
                  id: "swap",
                  size: "2 GiB",
                },
              ],
            },
          ],
        },
      };
  }
};

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useExtendedConfig: () => mockUseExtendedConfigFn(),
}));

describe("InstallationFinished", () => {
  beforeEach(() => {
    mockUseExtendedConfigFn.mockReturnValue(mockStorageConfig("guided", null));
    mockStage("finished");
  });

  it("shows the finished installation screen", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("heading", { level: 1, name: "Installation complete" });
  });

  it("shows a 'Reboot' button", () => {
    installerRender(<InstallationFinished />);
    screen.getByRole("button", { name: /Reboot/i });
  });

  describe("when running storage config in raw mode", () => {
    beforeEach(() => {
      mockUseExtendedConfigFn.mockReturnValue(mockStorageConfig("raw", null));
    });

    describe("when TPM is set as encryption method", () => {
      beforeEach(() => {
        mockUseExtendedConfigFn.mockReturnValue(
          mockStorageConfig("raw", {
            tpmFde: {
              password: "n0tS3cr3t",
            },
          }),
        );
      });

      it("shows the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        await screen.findAllByText(/TPM/);
      });
    });

    describe("when TPM is not set as encryption method", () => {
      beforeEach(() => {
        mockUseExtendedConfigFn.mockReturnValue(mockStorageConfig("raw", null));
      });

      it("does not show the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        expect(screen.queryAllByText(/TPM/)).toHaveLength(0);
      });
    });
  });

  describe("when running storage config in guided mode", () => {
    describe("when TPM is set as encryption method", () => {
      beforeEach(() => {
        mockUseExtendedConfigFn.mockReturnValue(
          mockStorageConfig("guided", {
            method: "tpm_fde",
            password: "n0tS3cr3t",
          }),
        );
      });

      it("shows the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        await screen.findAllByText(/TPM/);
      });
    });

    describe("when TPM is not set as encryption method", () => {
      beforeEach(() => {
        mockUseExtendedConfigFn.mockReturnValue(mockStorageConfig("guided", null));
      });

      it("does not show the TPM reminder", async () => {
        installerRender(<InstallationFinished />);
        expect(screen.queryAllByText(/TPM/)).toHaveLength(0);
      });
    });
  });
});
