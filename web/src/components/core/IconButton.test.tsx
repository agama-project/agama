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
import IconButton from "./IconButton";

describe("IconButton", () => {
  it("renders a button with text", () => {
    plainRender(<IconButton variant="primary">Save</IconButton>);
    screen.getByRole("button", { name: "Save" });
  });

  it("renders without an icon when icon prop is not provided", () => {
    const { container } = plainRender(<IconButton variant="primary">Save</IconButton>);
    const icon = container.querySelector("svg");
    expect(icon).not.toBeInTheDocument();
  });

  it("renders with an icon when icon prop is provided", () => {
    const { container } = plainRender(
      <IconButton variant="primary" icon="check_circle">
        Save
      </IconButton>,
    );
    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("data-icon-name", "check_circle");
  });

  it("wraps content in Flex when icon is provided", () => {
    const { container } = plainRender(
      <IconButton variant="primary" icon="restart_alt">
        Reboot
      </IconButton>,
    );
    // Check that Flex wrapper exists
    const flexContainer = container.querySelector(".pf-v6-l-flex");
    expect(flexContainer).toBeInTheDocument();
  });

  it("does not wrap content in Flex when icon is not provided", () => {
    const { container } = plainRender(<IconButton variant="primary">Save</IconButton>);
    // Check that Flex wrapper does not exist
    const flexContainer = container.querySelector(".pf-v6-l-flex");
    expect(flexContainer).not.toBeInTheDocument();
  });

  it("calls onClick handler when clicked", async () => {
    const onClick = jest.fn();
    const { user } = plainRender(
      <IconButton variant="primary" onClick={onClick}>
        Click me
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Click me" });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the correct variant class", () => {
    plainRender(<IconButton variant="danger">Delete</IconButton>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveClass("pf-m-danger");
  });

  it("forwards all ButtonProps to the underlying Button", () => {
    plainRender(
      <IconButton variant="primary" type="submit" isDisabled data-testid="custom-button">
        Submit
      </IconButton>,
    );
    const button = screen.getByTestId("custom-button");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });

  it("renders children correctly with complex content", () => {
    plainRender(
      <IconButton variant="primary">
        <span>Complex</span> <strong>Content</strong>
      </IconButton>,
    );
    screen.getByText("Complex");
    screen.getByText("Content");
  });

  it("works with different button variants", () => {
    const { rerender } = plainRender(<IconButton variant="primary">Primary</IconButton>);
    expect(screen.getByRole("button")).toHaveClass("pf-m-primary");

    rerender(<IconButton variant="secondary">Secondary</IconButton>);
    expect(screen.getByRole("button")).toHaveClass("pf-m-secondary");

    rerender(<IconButton variant="link">Link</IconButton>);
    expect(screen.getByRole("button")).toHaveClass("pf-m-link");

    rerender(<IconButton variant="danger">Danger</IconButton>);
    expect(screen.getByRole("button")).toHaveClass("pf-m-danger");
  });
});
