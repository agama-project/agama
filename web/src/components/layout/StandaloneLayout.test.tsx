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
import { _ } from "~/i18n";
import { Button } from "@patternfly/react-core";
import StandaloneLayout from "~/components/layout/StandaloneLayout";

/** True when `first` appears before `second` in document order. */
const precedes = (first: Element, second: Element) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("StandaloneLayout", () => {
  it("renders the primary content as a level 1 heading", () => {
    plainRender(<StandaloneLayout title={_("Installation complete")} />);

    screen.getByRole("heading", { level: 1, name: "Installation complete" });
  });

  it("keeps the reading order: title, description, then actionable content", () => {
    plainRender(
      <StandaloneLayout
        title={_("Installation complete")}
        description={_("You can reboot the machine.")}
      >
        <Button>Reboot</Button>
      </StandaloneLayout>,
    );

    const title = screen.getByRole("heading", { level: 1 });
    const description = screen.getByText("You can reboot the machine.");
    const action = screen.getByRole("button", { name: "Reboot" });

    expect(precedes(title, description)).toBe(true);
    expect(precedes(description, action)).toBe(true);
  });

  it("renders the icon as a decorative element", () => {
    const { container } = plainRender(
      <StandaloneLayout icon="done_all" title={_("Installation complete")} />,
    );

    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("renders no icon when none is given", () => {
    const { container } = plainRender(<StandaloneLayout title={_("Installation complete")} />);

    expect(container.querySelector("svg")).toBeNull();
  });
});
