/*
 * Copyright (c) [2022] SUSE LLC
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

// @ts-check
// cspell:ignore Cestina

import DBusClient from "./dbus";
import { LanguageClient } from "./language";

jest.mock("./dbus");

const langProxy = {
  wait: jest.fn(),
  AvailableLanguages: [
    ["cs_CZ", "Cestina", {}]
  ]
};

jest.mock("./dbus");

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return { proxy: () => langProxy };
  });
});

describe("#getLanguages", () => {
  it("returns the list of available languages", async () => {
    const client = new LanguageClient();
    const availableLanguages = await client.getLanguages();
    expect(availableLanguages).toEqual([{ id: "cs_CZ", name: "Cestina" }]);
  });
});
