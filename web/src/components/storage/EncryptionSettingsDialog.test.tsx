/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { EncryptionMethods } from "~/client/storage";
import EncryptionSettingsDialog, {
  EncryptionSettingsDialogProps,
} from "~/components/storage/EncryptionSettingsDialog";

let props: EncryptionSettingsDialogProps;
const onCancelFn = jest.fn();
const onAcceptFn = jest.fn();

describe("EncryptionSettingsDialog", () => {
  beforeEach(() => {
    props = {
      password: "1234",
      method: EncryptionMethods.LUKS2,
      methods: Object.values(EncryptionMethods),
      isOpen: true,
      onCancel: onCancelFn,
      onAccept: onAcceptFn,
    };
  });

  describe("when password is not set", () => {
    beforeEach(() => {
      props.password = "";
    });

    it("allows settings the encryption", async () => {
      const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
      const checkbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      const passwordInput = screen.getByLabelText("Password");
      const confirmationInput = screen.getByLabelText("Password confirmation");
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      expect(checkbox).not.toBeChecked();
      expect(passwordInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(tpmCheckbox).toBeDisabled();

      await user.click(checkbox);

      expect(checkbox).toBeChecked();
      expect(passwordInput).toBeEnabled();
      expect(passwordInput).toBeEnabled();
      expect(tpmCheckbox).toBeEnabled();

      await user.type(passwordInput, "2345");
      await user.type(confirmationInput, "2345");
      await user.click(acceptButton);

      expect(props.onAccept).toHaveBeenCalledWith(expect.objectContaining({ password: "2345" }));
    });
  });

  describe("when password is set", () => {
    it("allows changing the encryption", async () => {
      const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
      const passwordInput = screen.getByLabelText("Password");
      const confirmationInput = screen.getByLabelText("Password confirmation");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });

      await user.clear(passwordInput);
      await user.type(passwordInput, "9876");
      await user.clear(confirmationInput);
      await user.type(confirmationInput, "9876");
      await user.click(tpmCheckbox);
      await user.click(acceptButton);

      expect(props.onAccept).toHaveBeenCalledWith({
        password: "9876",
        method: EncryptionMethods.TPM,
      });
    });

    it("allows unsetting the encryption", async () => {
      const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
      const checkbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(props.onAccept).toHaveBeenCalledWith({ password: "" });
    });
  });

  describe("when using TPM", () => {
    beforeEach(() => {
      props.method = EncryptionMethods.TPM;
    });

    it("allows to stop using it", async () => {
      const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(tpmCheckbox).toBeChecked();
      await user.click(tpmCheckbox);
      expect(tpmCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(props.onAccept).toHaveBeenCalledWith(
        expect.not.objectContaining({ method: EncryptionMethods.TPM }),
      );
    });
  });

  describe("when TPM is not included in given methods", () => {
    beforeEach(() => {
      props.methods = [EncryptionMethods.LUKS2];
    });

    it("does not render the TPM checkbox", () => {
      plainRender(<EncryptionSettingsDialog {...props} />);
      expect(screen.queryByRole("checkbox", { name: /Use.*TPM/ })).toBeNull();
    });
  });

  it("does not allow sending not valid settings", async () => {
    const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
    const checkbox = screen.getByRole("checkbox", { name: "Encrypt the system" });
    const passwordInput = screen.getByLabelText("Password");
    const confirmationInput = screen.getByLabelText("Password confirmation");
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    expect(acceptButton).toBeEnabled();
    await user.clear(confirmationInput);
    // Now password and passwordConfirmation do not match
    expect(acceptButton).toBeDisabled();
    await user.click(checkbox);
    // But now the user is trying to unset the encryption
    expect(acceptButton).toBeEnabled();
    await user.click(checkbox);
    // Back to a not valid settings state
    expect(acceptButton).toBeDisabled();
    await user.clear(passwordInput);
    await user.clear(confirmationInput);
    // Passwords match... but are empty
    expect(acceptButton).toBeDisabled();
    await user.type(passwordInput, "valid");
    await user.type(confirmationInput, "valid");
    // Not empty passwords matching!
    expect(acceptButton).toBeEnabled();
  });

  it("triggers onCancel callback when dialog is discarded", async () => {
    const { user } = plainRender(<EncryptionSettingsDialog {...props} />);
    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(props.onCancel).toHaveBeenCalled();
  });
});
