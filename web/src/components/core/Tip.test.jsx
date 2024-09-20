/*
 * Copyright (c) [2023] SUSE LLC
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
import { Tip } from "~/components/core";

describe("Tip", () => {
  const description = "Some great description";
  const label = "Label";

  describe("The description is not empty", () => {
    it("displays the label with the 'info' icon and show the description after click", async () => {
      const { user, container } = plainRender(<Tip description={description}>{label}</Tip>);

      // an icon is displayed
      expect(container.querySelector("svg")).toBeInTheDocument();

      // the description is not displayed just after the render
      expect(screen.queryByText(description)).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // click it
      const label_node = screen.getByText(label);
      await user.click(label_node);

      // then the description is visible in a dialog
      screen.getByRole("dialog");
      screen.getByText(description);
    });
  });

  describe("The description is not defined", () => {
    it("displays the label without the 'info' icon and clicking does not show any popup", async () => {
      const { user, container } = plainRender(<Tip>{label}</Tip>);

      // no icon
      expect(container.querySelector("svg")).not.toBeInTheDocument();

      // click it
      const label_node = screen.getByText(label);
      await user.click(label_node);

      // no popup
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
