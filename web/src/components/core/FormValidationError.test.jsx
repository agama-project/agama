/*
 * Copyright (c) [2023] SUSE LLC
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
import { FormValidationError } from "~/components/core";

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

it("renders nothing when message is null", () => {
  const { container } = installerRender(<FormValidationError message={null} />);
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing when message is empty", () => {
  const { container } = installerRender(<FormValidationError message="" />);
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing when message is not defined", () => {
  const { container } = installerRender(<FormValidationError />);
  expect(container).toBeEmptyDOMElement();
});

it("renders a PatternFly error with given message", () => {
  installerRender(<FormValidationError message="Invalid input" />);
  const node = screen.getByText("Invalid input");
  expect(node.parentNode.classList.contains("pf-m-error")).toBe(true);
});
