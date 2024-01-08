/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { ValidationErrors } from "~/components/core";

jest.mock("~/components/core/IssuesDialog", () => ({ isOpen }) => isOpen && <div>IssuesDialog</div>);

let issues = [];

describe("when there are no errors", () => {
  it("renders nothing", async () => {
    const { container } = plainRender(<ValidationErrors sectionId="storage" errors={issues} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("when there is a single error", () => {
  beforeEach(() => {
    issues = [{ severity: 0, message: "It is wrong" }];
  });

  it("renders a list containing the given errors", () => {
    plainRender(<ValidationErrors sectionId="storage" errors={issues} />);

    expect(screen.queryByText("It is wrong")).toBeInTheDocument();
  });
});

describe("when there are multiple errors", () => {
  beforeEach(() => {
    issues = [
      { severity: 0, message: "It is wrong" },
      { severity: 1, message: "It might be better" }
    ];
  });

  it("shows a button for listing them and opens a dialog when user clicks on it", async () => {
    const { user } = plainRender(<ValidationErrors sectionId="storage" errors={issues} />);
    const button = await screen.findByRole("button", { name: "2 errors found" });

    // See IssuesDialog mock at the top of the file
    const dialog = await screen.queryByText("IssuesDialog");
    expect(dialog).toBeNull();

    await user.click(button);
    await screen.findByText("IssuesDialog");
  });
});
