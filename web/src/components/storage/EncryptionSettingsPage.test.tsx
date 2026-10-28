/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import EncryptionSettingsPage from "./EncryptionSettingsPage";
import type { ConfigModel } from "~/model/storage/config-model";

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);

const mockLuks2Config: ConfigModel.Config = {
  boot: {
    configure: true,
    bootloader: "grub2",
  },
  encryption: {
    password: "12345",
    tpm: false,
  },
};

const mockTpmConfig: ConfigModel.Config = {
  boot: {
    configure: true,
    bootloader: "grub2-bls",
  },
  encryption: {
    password: "12345",
    tpm: true,
  },
};

const mockNoEncryptionConfig: ConfigModel.Config = {
  boot: {
    configure: true,
    bootloader: "grub2",
  },
};

const mockUseConfigModel = jest.fn();
const mockSetEncryption = jest.fn();
const mockUseIsTpmAvailable = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockUseConfigModel(),
  useSetEncryption: () => mockSetEncryption,
  useIsTpmAvailable: () => mockUseIsTpmAvailable(),
}));

describe("EncryptionSettingsPage", () => {
  beforeEach(() => {
    mockSetEncryption.mockClear();
    mockUseConfigModel.mockClear();
    mockUseIsTpmAvailable.mockReturnValue(true);
  });

  describe("when encryption is not enabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockNoEncryptionConfig);
    });

    it("allows enabling the encryption", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />);
      const encryptionCheckbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      expect(encryptionCheckbox).not.toBeChecked();
      await user.click(encryptionCheckbox);
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "12345");
      await user.type(passwordConfirmationInput, "12345");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);
      expect(mockSetEncryption).toHaveBeenCalledWith({ password: "12345", tpm: false });
    });
  });

  describe("when encryption is enabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockLuks2Config);
    });

    it("allows disabling the encryption", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />);
      const encryptionCheckbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      expect(encryptionCheckbox).toBeChecked();
      await user.click(encryptionCheckbox);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockSetEncryption).toHaveBeenCalledWith(null);
    });
  });

  describe("when using TPM", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockTpmConfig);
    });

    it("allows disabling TPM", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />);
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(tpmCheckbox).toBeChecked();
      await user.click(tpmCheckbox);
      expect(tpmCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockSetEncryption).toHaveBeenCalledWith({ password: "12345", tpm: false });
    });
  });

  describe("when TPM is not available", () => {
    beforeEach(() => {
      mockUseIsTpmAvailable.mockReturnValue(false);
      mockUseConfigModel.mockReturnValue(mockLuks2Config);
    });

    it("does not offer TPM", () => {
      installerRender(<EncryptionSettingsPage />);
      expect(screen.queryByRole("checkbox", { name: /Use.*TPM/ })).toBeNull();
    });
  });

  describe("TPM explanation text", () => {
    describe("with BLS bootloader (grub2-bls)", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          boot: {
            configure: true,
            bootloader: "grub2-bls",
          },
          encryption: {
            password: "12345",
            tpm: false,
          },
        });
      });

      it("shows only the basic TPM explanation without FDE boot instructions", () => {
        installerRender(<EncryptionSettingsPage />, { withL10n: true });
        screen.getByRole("checkbox", { name: /Use.*TPM/ });
        screen.getByText(/password will not be needed to boot/);
        expect(screen.queryByText(/booted directly on its first run/)).not.toBeInTheDocument();
      });
    });

    describe("with BLS bootloader (systemd-boot)", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          boot: {
            configure: true,
            bootloader: "systemd-boot",
          },
          encryption: {
            password: "12345",
            tpm: false,
          },
        });
      });

      it("shows only the basic TPM explanation without FDE boot instructions", () => {
        installerRender(<EncryptionSettingsPage />, { withL10n: true });
        screen.getByRole("checkbox", { name: /Use.*TPM/ });
        screen.getByText(/password will not be needed to boot/);
        expect(screen.queryByText(/booted directly on its first run/)).not.toBeInTheDocument();
      });
    });

    describe("with non-BLS bootloader (grub2)", () => {
      beforeEach(() => {
        mockUseConfigModel.mockReturnValue({
          boot: {
            configure: true,
            bootloader: "grub2",
          },
          encryption: {
            password: "12345",
            tpm: false,
          },
        });
      });

      it("shows the full TPM explanation including FDE boot instructions", () => {
        installerRender(<EncryptionSettingsPage />, { withL10n: true });
        screen.getByRole("checkbox", { name: /Use.*TPM/ });
        screen.getByText(/password will not be needed to boot/);
        screen.getByText(/booted directly on its first run/);
      });
    });
  });
});
