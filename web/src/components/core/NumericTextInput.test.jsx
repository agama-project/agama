/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { NumericTextInput } from "~/components/core";

// Using a controlled component for testing the rendered result instead of testing if
// the given onChange callback is called. The former is more aligned with the
// React Testing Library principles, https://testing-library.com/docs/guiding-principles
const Input = ({ value: initialValue = "" }) => {
  const [value, setValue] = useState(initialValue);
  return <NumericTextInput aria-label="Test input" value={value} onChange={setValue} />;
};

it("renders an input text control", () => {
  plainRender(<Input />);

  const input = screen.getByRole("textbox", { name: "Test input" });
  expect(input).toHaveAttribute("type", "text");
});

it("allows only digits and dot", async () => {
  const { user } = plainRender(<Input />);

  const input = screen.getByRole("textbox", { name: "Test input" });
  expect(input).toHaveValue("");

  await user.type(input, "-");
  expect(input).toHaveValue("");

  await user.type(input, "+");
  expect(input).toHaveValue("");

  await user.type(input, "1");
  expect(input).toHaveValue("1");

  await user.type(input, ".5");
  expect(input).toHaveValue("1.5");

  await user.type(input, " GiB");
  expect(input).toHaveValue("1.5");
});

it("allows clearing the input (empty values)", async () => {
  const { user } = plainRender(<Input value="120" />);

  const input = screen.getByRole("textbox", { name: "Test input" });
  expect(input).toHaveValue("120");
  await user.clear(input);
  expect(input).toHaveValue("");
});
