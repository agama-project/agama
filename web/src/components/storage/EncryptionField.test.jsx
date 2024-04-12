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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { EncryptionMethods } from "~/client/storage";
import EncryptionField from "~/components/storage/EncryptionField";

let props;
const onChangeFn = jest.fn();

const openEncryptionSettings = async ({ password = "", onChange = onChangeFn }) => {
  const { user } = plainRender(<EncryptionField password={password} onChange={onChange} />);
  const button = screen.getByRole("button", { name: /Encryption/ });
  await user.click(button);
  const dialog = await screen.findByRole("dialog");
  screen.getByRole("heading", { name: "Encryption" });

  return { user, dialog };
};

describe("Encryption field", () => {
  beforeEach(() => {
    props = { onChange: onChangeFn };
  });

  it("renders proper value depending of encryption status", () => {
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

  it("allows setting the encryption", async () => {
    const { user } = await openEncryptionSettings({});

    const switchField = screen.getByRole("switch", { name: "Encrypt the system" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmInput = screen.getByLabelText("Password confirmation");
    const accept = screen.getByRole("button", { name: "Accept" });
    expect(switchField).toHaveAttribute("aria-checked", "false");
    expect(passwordInput).not.toBeEnabled();
    expect(passwordConfirmInput).not.toBeEnabled();
    await user.click(switchField);
    expect(switchField).toHaveAttribute("aria-checked", "true");
    expect(passwordInput).toBeEnabled();
    expect(passwordConfirmInput).toBeEnabled();
    await user.type(passwordInput, "1234");
    await user.type(passwordConfirmInput, "1234");
    await user.click(accept);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ password: "1234" })
    );
  });

  it("allows unsetting the encryption", async () => {
    const { user } = await openEncryptionSettings({ password: "1234" });

    const switchField = screen.getByRole("switch", { name: "Encrypt the system" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmInput = screen.getByLabelText("Password confirmation");
    const accept = screen.getByRole("button", { name: "Accept" });
    expect(switchField).toHaveAttribute("aria-checked", "true");
    expect(passwordInput).toBeEnabled();
    expect(passwordConfirmInput).toBeEnabled();
    await user.click(switchField);
    expect(switchField).toHaveAttribute("aria-checked", "false");
    expect(passwordInput).not.toBeEnabled();
    expect(passwordConfirmInput).not.toBeEnabled();
    await user.click(accept);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).toHaveBeenCalledWith({ password: "" });
  });

  it("allows discarding the encryption settings dialog", async () => {
    const { user } = await openEncryptionSettings({});
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancel);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(props.onChange).not.toHaveBeenCalled();
  });

  test.todo("allows setting the TPM");
  test.todo("improve above tests");
});
