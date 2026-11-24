/*
 * Copyright (c) [2026] SUSE LLC
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
import TechnicalDetails from "~/components/questions/TechnicalDetails";

describe("TechnicalDetails", () => {
  it("renders a 'Technical details' heading and the given text", () => {
    plainRender(<TechnicalDetails text="Error: Something went wrong" />);

    screen.getByRole("figure", { name: "Technical details" });
    screen.getByText("Error: Something went wrong");
  });

  it("renders multi-line text correctly", () => {
    const multiLineText = `Error: Failed to commit
  Caused by:
  - Storage device not found
  - Invalid configuration`;

    plainRender(<TechnicalDetails text={multiLineText} />);

    screen.getByText(/Error: Failed to commit/);
    screen.getByText(/Caused by:/);
    screen.getByText(/Storage device not found/);
    screen.getByText(/Invalid configuration/);
  });

  it("renders nothing when text is undefined", () => {
    const { container } = plainRender(<TechnicalDetails text={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when text is empty", () => {
    const { container } = plainRender(<TechnicalDetails text="" />);

    expect(container.firstChild).toBeNull();
  });

  it("copies the text to the clipboard when clicking the copy button", async () => {
    const { user } = plainRender(<TechnicalDetails text="Error: Something went wrong" />);

    const copyButton = await screen.findByRole("button", { name: "Copy to clipboard" });
    await user.click(copyButton);

    await expect(navigator.clipboard.readText()).resolves.toBe("Error: Something went wrong");
  });
});
