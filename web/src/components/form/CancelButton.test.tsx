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
import { installerRender, mockNavigateFn } from "~/test-utils";
import CancelButton from "~/components/form/CancelButton";

jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigateFn,
}));

describe("CancelButton", () => {
  it("renders a Cancel button", () => {
    installerRender(<CancelButton />);
    screen.getByRole("button", { name: "Cancel" });
  });

  it("navigates back when clicked", async () => {
    const { user } = installerRender(<CancelButton />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockNavigateFn).toHaveBeenCalledWith(-1);
  });
});
