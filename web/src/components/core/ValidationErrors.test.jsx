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
import ValidationErrors from "./ValidationErrors";

describe("when there is a single error", () => {
  it("renders a list containing the given errors", () => {
    const errors = [
      { severity: 0, message: "It is wrong" },
    ];
    plainRender(<ValidationErrors title="Errors" errors={errors} />);

    expect(screen.queryByText("It is wrong")).toBeInTheDocument();
  });
});

describe("when there are multiple errors", () => {
  it("renders a list containing the given errors", async () => {
    const errors = [
      { severity: 0, message: "It is wrong" },
      { severity: 1, message: "It might be better" }
    ];

    const { user } = plainRender(<ValidationErrors title="Errors" errors={errors} />);
    const button = await screen.findByRole("button", { name: "2 errors found" });
    await user.click(button);

    await waitFor(() => {
      expect(screen.queryByText(/It is wrong/)).toBeInTheDocument();
    });
  });
});
