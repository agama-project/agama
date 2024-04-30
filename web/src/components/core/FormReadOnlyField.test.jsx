/*
 * Copyright (c) [2024] SUSE LLC
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
import { FormReadOnlyField } from "~/components/core";

it("renders label and content wrapped in div nodes using expected PatternFly styles", () => {
  plainRender(<FormReadOnlyField label="Product">Agama</FormReadOnlyField>);
  const field = screen.getByText("Agama");
  const label = screen.getByText("Product");
  expect(field.classList.contains("pf-v5-c-form__group")).toBe(true);
  expect(label.classList.contains("pf-v5-c-form__label-text")).toBe(true);
});
