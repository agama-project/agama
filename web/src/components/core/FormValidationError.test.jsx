/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { FormValidationError } from "~/components/core";

it("renders nothing when message is null", () => {
  const { container } = plainRender(<FormValidationError message={null} />);
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing when message is empty", () => {
  const { container } = plainRender(<FormValidationError message="" />);
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing when message is not defined", () => {
  const { container } = plainRender(<FormValidationError />);
  expect(container).toBeEmptyDOMElement();
});

it("renders a PatternFly error with given message", () => {
  plainRender(<FormValidationError message="Invalid input" />);
  const node = screen.getByText("Invalid input");
  expect(node.parentNode.classList.contains("pf-m-error")).toBe(true);
});
