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
import { render } from "@testing-library/react";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import Text from "./Text";

describe("Text component", () => {
  it("renders children", () => {
    const { getByText } = render(<Text>Installer</Text>);
    expect(getByText("Installer")).toBeInTheDocument();
  });

  it("applies bold style when isBold is true", () => {
    const { getByText } = render(<Text isBold>Installer</Text>);
    expect(getByText("Installer")).toHaveClass(textStyles.fontWeightBold);
  });

  it("applies screenReader class when srOnly is true", () => {
    const { getByText } = render(<Text srOnly>Installer</Text>);
    expect(getByText("Installer")).toHaveClass(a11yStyles.screenReader);
  });

  it("applies screenReader class when srOn is 'default'", () => {
    const { getByText } = render(<Text srOn="default">Installer</Text>);
    expect(getByText("Installer")).toHaveClass(a11yStyles.screenReader);
  });

  it("srOnly takes precedence over srOn", () => {
    const { getByText } = render(
      <Text srOnly srOn="md">
        Installer
      </Text>,
    );
    const element = getByText("Installer");

    expect(element).toHaveClass(a11yStyles.screenReader);
    expect(element).not.toHaveClass(a11yStyles.screenReaderOnMd);
  });

  it("applies screenReaderOn class for non-default srOn", () => {
    const { getByText } = render(<Text srOn="md">Installer</Text>);
    expect(getByText("Installer")).toHaveClass(a11yStyles.screenReaderOnMd);
  });

  it("merges custom className", () => {
    const { getByText } = render(
      <Text className="custom-class" srOnly>
        Installer
      </Text>,
    );
    expect(getByText("Installer")).toHaveClass("custom-class", a11yStyles.screenReader);
  });
});
