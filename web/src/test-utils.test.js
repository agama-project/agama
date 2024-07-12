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

import { resetLocalStorage } from "./test-utils";

beforeAll(() => {
  jest.spyOn(Storage.prototype, "clear");
  jest.spyOn(Storage.prototype, "setItem");
});

afterAll(() => jest.clearAllMocks());

describe("resetLocalStorage", () => {
  it("clears window.localStorage", () => {
    resetLocalStorage();
    expect(window.localStorage.clear).toHaveBeenCalled();
  });

  it("does not set an initial state if it is not given", () => {
    resetLocalStorage();
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("does not set an initial state if given value is not an object", () => {
    resetLocalStorage(["wrong", "initial state"]);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("sets an initial state if given value is an object", () => {
    resetLocalStorage({
      storage: "something",
      for: "later",
    });
    expect(window.localStorage.setItem).toHaveBeenCalledWith("storage", "something");
    expect(window.localStorage.setItem).toHaveBeenCalledWith("for", "later");
  });
});
