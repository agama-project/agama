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
import { installerRender } from "~/test-utils";
import PreservedValueField from "./PreservedValueField";

describe("PreservedValueField", () => {
  const onEdit = jest.fn();

  beforeEach(() => {
    onEdit.mockClear();
  });

  describe("when preserving", () => {
    it("renders the preserved message", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      screen.getByText("Using a hashed password.");
    });

    it("renders the change button with default label", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      screen.getByRole("button", { name: "Change" });
    });

    it("renders the change button with custom label", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          changeButtonLabel="Edit password"
          isPreserving
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      screen.getByRole("button", { name: "Edit password" });
    });

    it("calls onEdit when clicking the change button", async () => {
      const { user } = installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      await user.click(screen.getByRole("button", { name: "Change" }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it("does not render children", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving
          onEdit={onEdit}
        >
          <input type="text" aria-label="Password field" />
        </PreservedValueField>,
      );

      expect(screen.queryByLabelText("Password field")).not.toBeInTheDocument();
    });
  });

  describe("when not preserving", () => {
    it("renders the children", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving={false}
          onEdit={onEdit}
        >
          <input type="text" aria-label="Password field" />
        </PreservedValueField>,
      );

      screen.getByLabelText("Password field");
    });

    it("does not render the preserved message", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving={false}
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      expect(screen.queryByText("Using a hashed password.")).not.toBeInTheDocument();
    });

    it("does not render the change button", () => {
      installerRender(
        <PreservedValueField
          preservedMessage="Using a hashed password."
          isPreserving={false}
          onEdit={onEdit}
        >
          <input type="text" />
        </PreservedValueField>,
      );

      expect(screen.queryByRole("button", { name: "Change" })).not.toBeInTheDocument();
    });
  });
});
