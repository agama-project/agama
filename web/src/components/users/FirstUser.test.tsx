/*
 * Copyright (c) [2025] SUSE LLC
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
import { installerRender } from "~/test-utils";
import FirstUser from "./FirstUser";
import { USER } from "~/routes/paths";

const mockProposal = jest.fn();
const mockRemoveUser = jest.fn();

jest.mock("~/hooks/model/proposal", () => ({
  ...jest.requireActual("~/hooks/model/proposal"),
  useProposal: () => mockProposal(),
}));

jest.mock("~/hooks/model/config/user", () => ({
  ...jest.requireActual("~/hooks/model/config/user"),
  useRemoveUser: () => mockRemoveUser,
}));

describe("FirstUser", () => {
  describe("when the user is not defined yet", () => {
    beforeEach(() => {
      mockProposal.mockReturnValue({});
    });

    it("renders a link to define it", () => {
      installerRender(<FirstUser />);
      const createLink = screen.getByRole("link", { name: "Define a user now" });
      expect(createLink).toHaveAttribute("href", USER.firstUser.create);
    });
  });

  describe("when the user is already defined", () => {
    beforeEach(() => {
      mockProposal.mockReturnValue({ users: { user: { fullName: "Gecko Migo", userName: "gmigo" } } });
    });

    it("renders the fullname and username", () => {
      installerRender(<FirstUser />);
      screen.getByText("Gecko Migo");
      screen.getByText("gmigo");
    });

    it("renders a link to edit it", async () => {
      installerRender(<FirstUser />);
      const editLink = screen.getByRole("link", { name: "Edit" });
      expect(editLink).toHaveAttribute("href", USER.firstUser.edit);
    });

    it("renders an action to discard it (within an expandable menu)", async () => {
      const { user } = installerRender(<FirstUser />);
      const moreActionsToggle = screen.getByRole("button", { name: "More actions" });
      await user.click(moreActionsToggle);
      const discardAction = screen.getByRole("menuitem", { name: "Discard" });
      await user.click(discardAction);
      expect(mockRemoveUser).toHaveBeenCalled();
    });
  });
});
