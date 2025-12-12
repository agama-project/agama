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

import React, { useState } from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import SwitchEnhanced from "./SwitchEnhanced";
import { _ } from "~/i18n";

describe("SwitchEnhanced", () => {
  it("renders a switch with label and description", () => {
    plainRender(
      <SwitchEnhanced
        id="installation-only-connection"
        label={_("Use for installation only")}
        description="Not persisted to the installed system."
        isChecked={false}
      />,
    );

    const switchElement = screen.getByRole("switch");
    const label = screen.getByText(/Use for installation only/);
    const description = screen.getByText(/Not persisted to the installed system/);

    // Ensure aria-labelledby and aria-describedby point to the correct elements
    expect(switchElement).toHaveAttribute("aria-labelledby", label.id);
    expect(switchElement).toHaveAttribute("aria-describedby", description.id);
  });

  it("fires onChange handler when toggled", async () => {
    const SwitchEnhancedTestWrapper = () => {
      const [isChecked, setIsChecked] = useState(false);
      return (
        <SwitchEnhanced
          id="installation-only-connection"
          label={_("Use for installation only")}
          description="Not persisted to the installed system."
          isChecked={isChecked}
          onChange={() => setIsChecked(!isChecked)}
        />
      );
    };

    const { user } = plainRender(<SwitchEnhancedTestWrapper />);

    const switchElement = screen.getByRole("switch");
    expect(switchElement).not.toBeChecked();
    await user.click(switchElement);
    expect(switchElement).toBeChecked();
  });
});
