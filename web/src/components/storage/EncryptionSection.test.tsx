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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { EncryptionMethods } from "~/types/storage";
import EncryptionField from "~/components/storage/EncryptionField";

describe("EncryptionField", () => {
  it("renders proper value depending on encryption status", () => {
    // No encryption set
    const { rerender } = plainRender(<EncryptionField />);
    screen.getByText("Disabled");

    // Encryption set with LUKS2
    rerender(<EncryptionField password="1234" method={EncryptionMethods.LUKS2} />);
    screen.getByText("Enabled");

    // Encryption set with TPM
    rerender(<EncryptionField password="1234" method={EncryptionMethods.TPM} />);
    screen.getByText("Using TPM unlocking");
  });

  it("allows opening the encryption settings dialog", async () => {
    const { user } = plainRender(<EncryptionField />);
    const button = screen.getByRole("button", { name: /Enable/ });
    await user.click(button);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByRole("heading", { name: "Encryption" });
  });
});
