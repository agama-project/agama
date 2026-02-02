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
import Breadcrumbs from "./Breadcrumbs";

import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

describe("Breadcrumbs", () => {
  it("renders the correct number of breadcrumb items", () => {
    installerRender(
      <Breadcrumbs>
        <Breadcrumbs.Item label="Software" path="/software" />
        <Breadcrumbs.Item label="Patterns Selection" path="/software/patterns/select" />
      </Breadcrumbs>,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});

describe("Breadcrumbs.Item", () => {
  it("renders label and link when path is provided", () => {
    installerRender(<Breadcrumbs.Item label="Software" path="/software" />);

    screen.getByText("Software");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/software");
  });

  it("renders label without link when path is not provided", () => {
    installerRender(<Breadcrumbs.Item label="Software" />);

    screen.getByText("Software");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders as heading when isCurrent is true", () => {
    installerRender(<Breadcrumbs.Item label="Current Page" isCurrent />);

    const heading = screen.getByRole("heading", { level: 1, name: "Current Page" });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("sets aria-current='page' when isCurrent is true", () => {
    installerRender(<Breadcrumbs.Item label="Current Page" isCurrent />);

    const listItem = screen.getByRole("listitem");
    expect(listItem).toHaveAttribute("aria-current", "page");
  });

  it("does not set aria-current when isCurrent is false", () => {
    installerRender(<Breadcrumbs.Item label="Software" path="/software" />);

    const listItem = screen.getByRole("listitem");
    expect(listItem).not.toHaveAttribute("aria-current");
  });

  it("renders divider if hideDivider is false", () => {
    const { container } = installerRender(
      <Breadcrumbs.Item label="Software" path="/software" hideDivider={false} />,
    );

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("data-icon-name", "chevron_right");
  });

  it("does not render divider if hideDivider is true", () => {
    const { container } = installerRender(
      <Breadcrumbs.Item label="Software" path="/software" hideDivider />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("applies editorial styles when isEditorial is true", () => {
    installerRender(<Breadcrumbs.Item label="Software" path="/software" isEditorial />);

    const label = screen.getByText("Software");
    expect(label).toHaveClass(textStyles.fontSizeLg);
    expect(label).toHaveClass(textStyles.fontWeightBold);
  });

  it("does not apply editorial styles when isEditorial is false", () => {
    installerRender(<Breadcrumbs.Item label="Software" path="/software" isEditorial={false} />);
    const label = screen.getByText("Software");
    expect(label).not.toHaveClass(textStyles.fontSizeLg);
    expect(label).not.toHaveClass(textStyles.fontWeightBold);
  });
});
