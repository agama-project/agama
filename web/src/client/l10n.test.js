/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { L10nClient } from "./l10n";

jest.mock("./dbus");

const L10N_IFACE = "org.opensuse.Agama1.Locale";

const l10nProxy = {
  ListLocales: jest.fn().mockResolvedValue(
    [
      ["es_ES.UTF-8", "Spanish", "Spain"],
      ["en_US.UTF-8", "English", "United States"]
    ]
  ),
};

beforeEach(() => {
  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: (iface) => {
        if (iface === L10N_IFACE) return l10nProxy;
      }
    };
  });
});

describe("#locales", () => {
  it("returns the list of available locales", async () => {
    const client = new L10nClient();
    const locales = await client.locales();

    expect(locales).toEqual([
      { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
      { id: "en_US.UTF-8", name: "English", territory: "United States" }
    ]);
  });
});
