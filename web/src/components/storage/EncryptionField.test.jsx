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

let props;
const onChangeFn = jest.fn();

describe("Encryption field", () => {
  beforeEach(() => {
    props = { onChange: onChangeFn };
  });

  it("renders proper value depending of encryption status", () => {
    // No encryption set
    const { rerender } = plainRender(<EncryptionField />);
    screen.getByText("disabled");

    // Encryption set with LUKS2
    rerender(<EncryptionField password="s3cr3t" method={EncryptionMethods.LUKS2} />);
    screen.getByText("enabled");

    // Encryption set with TPM
    rerender(<EncryptionField password="s3cr3t" method={EncryptionMethods.TPM} />);
    screen.getByText("enabled using TPM");
  });

  it("allows changing the encryption settings", async () => {
    const { user } = plainRender(<EncryptionField {...props} />);

    const button = screen.getByRole("button", { name: /Encryption/ });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    screen.getByText("Encryption settings");
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmInput = screen.getByLabelText("Password confirmation");
    const accept = within(popup).getByRole("button", { name: "Accept" });
    await user.type(passwordInput, "1234");
    await user.type(passwordConfirmInput, "1234");
    await user.click(accept);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).toHaveBeenCalled();
  });

  it("allows closing the encryption settings without triggering changes", async () => {
    const { user } = plainRender(<EncryptionField {...props} />);

    const button = screen.getByRole("button", { name: /Encryption settings/ });
    await user.click(button);

    const popup = await screen.findByRole("dialog");
    screen.getByText("Encryption settings");

    const cancel = within(popup).getByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
  });
});
