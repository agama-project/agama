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
import Summary from "~/components/core/Summary";

describe("Summary", () => {
  it("renders the title as a heading", () => {
    plainRender(<Summary icon="hard_drive" title="Storage" value="Use device vda" />);

    screen.getByRole("heading", { name: "Storage" });
  });

  it("renders the value and the description", () => {
    plainRender(
      <Summary
        icon="hard_drive"
        title="Storage"
        value="Use device vda"
        description="25 GiB available"
      />,
    );

    screen.getByText("Use device vda");
    screen.getByText("25 GiB available");
  });

  it("renders the requested icon", () => {
    const { container } = plainRender(
      <Summary icon="hard_drive" title="Storage" value="Use device vda" />,
    );

    expect(container.querySelector("svg")).toHaveAttribute("data-icon-name", "hard_drive");
  });

  describe("when the summary has issues", () => {
    it("replaces the icon with the one signalling an issue", () => {
      const { container } = plainRender(
        <Summary icon="hard_drive" title="Storage" value="Use device vda" hasIssues />,
      );

      expect(container.querySelector("svg")).toHaveAttribute("data-icon-name", "warning");
    });

    it("keeps a single icon beside the title", () => {
      const { container } = plainRender(
        <Summary icon="hard_drive" title="Storage" value="Use device vda" hasIssues />,
      );

      expect(container.querySelectorAll("svg")).toHaveLength(1);
    });
  });

  describe("when still loading", () => {
    it("renders placeholders instead of the value", () => {
      plainRender(<Summary icon="hard_drive" title="Storage" value="Use device vda" isLoading />);

      screen.getByLabelText("Waiting for proposal");
      expect(screen.queryByText("Use device vda")).toBeNull();
    });
  });
});
