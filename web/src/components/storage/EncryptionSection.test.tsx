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
import EncryptionSection from "./EncryptionSection";
import { STORAGE } from "~/routes/paths";

describe("EncryptionSection", () => {
  it("renders proper value depending on encryption mode", () => {
    // No encryption set
    plainRender(<EncryptionSection />);
    screen.getByText("Disabled");
  });

  // Replace previous example with below one after adapting it accordingly once
  // the real hook is in use and can be mocked.
  it.skip("renders proper value depending on encryption mode", () => {
    // No encryption set
    const { rerender } = plainRender(<EncryptionSection />);
    screen.getByText("Disabled");

    // Encryption set with LUKS2
    rerender(<EncryptionSection />);
    screen.getByText("Enabled");

    // Encryption set with TPM
    rerender(<EncryptionSection />);
    screen.getByText("Using TPM unlocking");
  });

  it("renders a link for navigating to encryption settings", () => {
    plainRender(<EncryptionSection />);
    const editLink = screen.getByRole("link", { name: "Edit" });
    expect(editLink).toHaveAttribute("href", STORAGE.encryption);
  });
});
