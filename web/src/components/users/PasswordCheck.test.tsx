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
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import PasswordCheck from "./PasswordCheck";

const mockCheckPasswordFn = jest.fn();

jest.mock("~/api/users", () => ({
  ...jest.requireActual("~/api/users"),
  checkPassword: (password) => mockCheckPasswordFn(password),
}));

describe("when the password is empty", () => {
  it("renders nothing", () => {
    const { container } = plainRender(<PasswordCheck password={""} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("when the password is not valid", () => {
  beforeEach(() => {
    mockCheckPasswordFn.mockResolvedValueOnce({
      failure: "Shorter than 8 characters",
    });
  });

  it("informs the user", async () => {
    plainRender(<PasswordCheck password={"short"} />);
    await screen.findByText("Shorter than 8 characters");
  });
});

describe("when the password is weak", () => {
  beforeEach(() => {
    mockCheckPasswordFn.mockResolvedValueOnce({
      success: 30,
    });
  });

  it("informs the user", async () => {
    plainRender(<PasswordCheck password={"weak-password"} />);
    await screen.findByText("The password is weak");
  });
});

describe("when the password is strong", () => {
  beforeEach(() => {
    mockCheckPasswordFn.mockResolvedValueOnce({
      success: 90,
    });
  });

  it("renders nothing", () => {
    const { container } = plainRender(<PasswordCheck password={""} />);
    expect(container).toBeEmptyDOMElement();
  });
});
