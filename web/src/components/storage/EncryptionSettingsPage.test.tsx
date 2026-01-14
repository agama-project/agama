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
  encryption: {
    method: "luks2",
    password: "12345",
  },
};

const mockTpmConfig: ConfigModel.Config = {
  encryption: {
    method: "tpmFde",
    password: "12345",
  },
};

const mockNoEncryptionConfig: ConfigModel.Config = {};

jest.mock("~/hooks/model/system", () => ({
  useSystem: () => ({
    l10n: {
      keymap: "us",
      timezone: "Europe/Berlin",
      locale: "en_US",
    },
  }),
}));

const mockUseEncryptionMethods = jest.fn();
jest.mock("~/hooks/model/system/storage", () => ({
  useEncryptionMethods: () => mockUseEncryptionMethods(),
}));

const mockUseConfigModel = jest.fn();
const mockSetEncryption = jest.fn();
jest.mock("~/hooks/model/storage/config-model", () => ({
  useConfigModel: () => mockUseConfigModel(),
  useSetEncryption: () => mockSetEncryption,
}));

describe("EncryptionSettingsPage", () => {
  beforeEach(() => {
    mockUseEncryptionMethods.mockReturnValue(["luks2", "tpmFde"]);
    mockSetEncryption.mockClear();
    mockUseConfigModel.mockClear();
  });

  describe("when encryption is not enabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockNoEncryptionConfig);
    });

    it("allows enabling the encryption", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />, { withL10n: true });
      const encryptionCheckbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      expect(encryptionCheckbox).not.toBeChecked();
      await user.click(encryptionCheckbox);
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "12345");
      await user.type(passwordConfirmationInput, "12345");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);
      expect(mockSetEncryption).toHaveBeenCalledWith({ method: "luks2", password: "12345" });
    });
  });

  describe("when encryption is enabled", () => {
    beforeEach(() => {
      mockUseConfigModel.mockReturnValue(mockLuks2Config);
    });

    it("allows disabling the encryption", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />, { withL10n: true });
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
      const { user } = installerRender(<EncryptionSettingsPage />, { withL10n: true });
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(tpmCheckbox).toBeChecked();
      await user.click(tpmCheckbox);
      expect(tpmCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockSetEncryption).toHaveBeenCalledWith({ method: "luks2", password: "12345" });
    });
  });

  describe("when TPM is not available", () => {
    beforeEach(() => {
      mockUseEncryptionMethods.mockReturnValue(["luks1", "luks2"]);
    });

    it("does not offer TPM", () => {
      installerRender(<EncryptionSettingsPage />, { withL10n: true });
      expect(screen.queryByRole("checkbox", { name: /Use.*TPM/ })).toBeNull();
    });
  });
});
