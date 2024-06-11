/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { EncryptionMethods } from "~/client/storage";
import EncryptionField from "~/components/storage/EncryptionField";

describe.skip("EncryptionField", () => {
  it("renders proper value depending on encryption status", () => {
    // No encryption set
    const { rerender } = plainRender(<EncryptionField />);
    screen.getByText("disabled");

    // Encryption set with LUKS2
    rerender(<EncryptionField password="1234" method={EncryptionMethods.LUKS2} />);
    screen.getByText("enabled");

    // Encryption set with TPM
    rerender(<EncryptionField password="1234" method={EncryptionMethods.TPM} />);
    screen.getByText("using TPM unlocking");
  });

  it("allows opening the encryption settings dialog", async () => {
    const { user } = plainRender(<EncryptionField />);
    const button = screen.getByRole("button", { name: /Encryption/ });
    await user.click(button);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByRole("heading", { name: "Encryption" });
  });
});
