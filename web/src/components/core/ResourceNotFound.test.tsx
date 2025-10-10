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
import { screen } from "@testing-library/dom";
import { installerRender } from "~/test-utils";
import ResourceNotFound from "./ResourceNotFound";
import { ROOT } from "~/routes/paths";

describe("ResourceNotFound", () => {
  it("renders the default title when none is given", () => {
    installerRender(<ResourceNotFound linkText={"Go to homepage"} linkPath={ROOT.root} />);
    screen.getByRole("heading", { name: "Resource not found or lost", level: 3 });
  });

  it("renders the given title", () => {
    installerRender(
      <ResourceNotFound title="Not found" linkText={"Go to homepage"} linkPath={ROOT.root} />,
    );
    screen.getByRole("heading", { name: "Not found", level: 3 });
  });

  it("renders the default body when none is given", () => {
    installerRender(<ResourceNotFound linkText={"Go to homepage"} linkPath={ROOT.root} />);
    screen.getByText("It doesn't exist or can't be reached.");
  });

  it("renders the given body", () => {
    installerRender(
      <ResourceNotFound
        body="Unexpected path, nothing to show"
        linkText={"Go to homepage"}
        linkPath={ROOT.root}
      />,
    );
    screen.getByText("Unexpected path, nothing to show");
  });

  it("renders a link with given text and path", () => {
    installerRender(<ResourceNotFound linkText={"Go to homepage"} linkPath={ROOT.root} />);
    const link = screen.getByRole("link", { name: "Go to homepage" });
    expect(link).toHaveAttribute("href", ROOT.root);
  });
});
