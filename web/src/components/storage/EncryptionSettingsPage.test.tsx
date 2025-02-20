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
import { plainRender } from "~/test-utils";
import EncryptionSettingsPage from "./EncryptionSettingsPage";

describe("EncryptionSettingsPage", () => {
  describe("when encryption is not set", () => {
    it.todo("write the test");
  });

  describe("when encryption is set", () => {
    describe("and user chooses to not use encryption", () => {
      // FIXME: adapt and enable below example once real hooks are available to be
      // imported and properly mocked.
      it.skip("allows unsetting the encryption", async () => {
        const { user } = plainRender(<EncryptionSettingsPage />);
        const toggle = screen.getByRole("switch", { name: "Encrypt the system" });
        expect(toggle).toBeChecked();
        await user.click(toggle);
        const passwordInput = screen.getByLabelText("Password");
        const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
        const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });

        expect(passwordInput).toBeDisabled();
        expect(passwordConfirmationInput).toBeDisabled();
        expect(tpmCheckbox).toBeDisabled();

        const acceptButton = screen.getByRole("button", { name: "Accept" });
        await user.click(acceptButton);

        // expect(mockMutation).toHaveBeenCalledWith({ password: "" });
      });
    });
  });

  describe("when using TPM", () => {
    it.skip("allows to stop using it", async () => {
      const { user } = plainRender(<EncryptionSettingsPage />);
      const tpmCheckbox = screen.getByRole("checkbox", { name: /Use.*TPM/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(tpmCheckbox).toBeChecked();
      await user.click(tpmCheckbox);
      expect(tpmCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      //   expect(mockMutation).toHaveBeenCalledWith(
      //     expect.not.objectContaining({ method: EncryptionMethods.TPM }),
      //   );
    });
  });

  describe("when TPM is not included in given methods", () => {
    it.skip("does not render the TPM checkbox", () => {
      plainRender(<EncryptionSettingsPage />);
      expect(screen.queryByRole("checkbox", { name: /Use.*TPM/ })).toBeNull();
    });
  });
});
