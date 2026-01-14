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
import { plainRender } from "~/test-utils";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import Text from "./Text";

describe("Text", () => {
  it("renders children", () => {
    plainRender(<Text>Installer</Text>);
    expect(screen.getByText("Installer")).toBeInTheDocument();
  });

  it("renders a 'span' HTML element when component is not given", () => {
    plainRender(<Text>Installer</Text>);
    const element = screen.getByText("Installer");
    expect(element.tagName).toBe("SPAN");
  });

  it("renders a 'small' HTML element when component='small'", () => {
    plainRender(<Text component="small">Installer</Text>);
    const element = screen.getByText("Installer");
    expect(element.tagName).toBe("SMALL");
  });

  it("applies bold style when isBold is true", () => {
    plainRender(<Text isBold>Installer</Text>);
    expect(screen.getByText("Installer")).toHaveClass(textStyles.fontWeightBold);
  });

  it("applies screenReader class when srOnly is true", () => {
    plainRender(<Text srOnly>Installer</Text>);
    expect(screen.getByText("Installer")).toHaveClass(a11yStyles.screenReader);
  });

  it("applies screenReader class when srOn is 'default'", () => {
    plainRender(<Text srOn="default">Installer</Text>);
    expect(screen.getByText("Installer")).toHaveClass(a11yStyles.screenReader);
  });

  it("srOnly takes precedence over srOn", () => {
    plainRender(
      <Text srOnly srOn="md">
        Installer
      </Text>,
    );
    const element = screen.getByText("Installer");

    expect(element).toHaveClass(a11yStyles.screenReader);
    expect(element).not.toHaveClass(a11yStyles.screenReaderOnMd);
  });

  it("applies screenReaderOn class for non-default srOn", () => {
    plainRender(<Text srOn="md">Installer</Text>);
    expect(screen.getByText("Installer")).toHaveClass(a11yStyles.screenReaderOnMd);
  });

  it("merges custom className", () => {
    plainRender(
      <Text className="custom-class" srOnly>
        Installer
      </Text>,
    );
    expect(screen.getByText("Installer")).toHaveClass("custom-class", a11yStyles.screenReader);
  });
});
