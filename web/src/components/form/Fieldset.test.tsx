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
import { Fieldset } from "./Fieldset";

describe("Fieldset", () => {
  it("renders the legend", () => {
    installerRender(
      <Fieldset legend="Network Settings">
        <input type="text" />
      </Fieldset>,
    );
    screen.getByText("Network Settings");
  });

  it("renders children", () => {
    installerRender(
      <Fieldset legend="Settings">
        <input aria-label="Test input" />
      </Fieldset>,
    );
    screen.getByLabelText("Test input");
  });

  it("renders description when provided", () => {
    installerRender(
      <Fieldset legend="Advanced" description="Configure advanced options">
        <input type="text" />
      </Fieldset>,
    );
    screen.getByText("Configure advanced options");
  });

  it("passes through native fieldset attributes", () => {
    installerRender(
      <Fieldset legend="Disabled Fieldset" disabled data-testid="test-fieldset">
        <input aria-label="Disabled input" />
      </Fieldset>,
    );
    const fieldset = screen.getByTestId("test-fieldset");
    expect(fieldset).toBeDisabled();
  });

  it("supports className attribute", () => {
    installerRender(
      <Fieldset legend="Styled" className="custom-class" data-testid="styled-fieldset">
        <input type="text" />
      </Fieldset>,
    );
    const fieldset = screen.getByTestId("styled-fieldset");
    expect(fieldset).toHaveClass("custom-class");
  });
});
