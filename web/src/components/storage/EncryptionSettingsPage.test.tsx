/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { type EncryptionHook, useEncryption } from "~/queries/storage/config-model";
import { useEncryptionMethods } from "~/hooks/api/system/storage";
import { useSystem } from "~/hooks/api/system";

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);
jest.mock("~/hooks/api/system/storage");
jest.mock("~/queries/storage/config-model");
jest.mock("~/hooks/api/system");

const mockLuks2Encryption: EncryptionHook = {
  encryption: {
    method: "luks2",
    password: "12345",
  },
  enable: jest.fn(),
  disable: jest.fn(),
};

const mockTpmEncryption: EncryptionHook = {
  encryption: {
    method: "tpmFde",
    password: "12345",
  },
  enable: jest.fn(),
  disable: jest.fn(),
};

const mockNoEncryption: EncryptionHook = {
  encryption: undefined,
  enable: jest.fn(),
  disable: jest.fn(),
};

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>registration alert</div>
));

describe("EncryptionSettingsPage", () => {
  const mockedUseEncryptionMethods = useEncryptionMethods as jest.Mock;
  const mockedUseEncryption = useEncryption as jest.Mock;
  const mockedUseSystem = useSystem as jest.Mock;

  beforeEach(() => {
    mockedUseSystem.mockReturnValue({ l10n: { locale: "en-US" } });
    mockedUseEncryptionMethods.mockReturnValue(["luks2", "tpmFde"]);
  });

  describe("when encryption is not enabled", () => {
    beforeEach(() => {
      mockedUseEncryption.mockReturnValue(mockNoEncryption);
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
      expect(mockNoEncryption.enable).toHaveBeenCalledWith("luks2", "12345");
    });
  });

  describe("when encryption is enabled", () => {
    beforeEach(() => {
      mockedUseEncryption.mockReturnValue(mockLuks2Encryption);
    });

    it("allows disabling the encryption", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />, { withL10n: true });
      const encryptionCheckbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      expect(encryptionCheckbox).toBeChecked();
      await user.click(encryptionCheckbox);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockLuks2Encryption.disable).toHaveBeenCalled();
    });
  });

  describe("when using TPM", () => {
    beforeEach(() => {
      mockedUseEncryption.mockReturnValue(mockTpmEncryption);
    });

    it("allows disabling TPM", async () => {
      const { user } = installerRender(<EncryptionSettingsPage />, { withL10n: true });
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(tpmCheckbox).toBeChecked();
      await user.click(tpmCheckbox);
      expect(tpmCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockTpmEncryption.enable).toHaveBeenCalledWith("luks2", "12345");
    });
  });

  describe("when TPM is not available", () => {
    beforeEach(() => {
      mockedUseEncryptionMethods.mockReturnValue(["luks1", "luks2"]);
    });

    it("does not offer TPM", () => {
      installerRender(<EncryptionSettingsPage />, { withL10n: true });
      expect(screen.queryByRole("checkbox", { name: /Use.*TPM/ })).toBeNull();
    });
  });
});
