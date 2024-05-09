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

import { HTTPClient } from "./http";
import { L10nClient } from "./l10n";

jest.mock("./dbus");

const mockJsonFn = jest.fn();
const mockGetFn = jest.fn().mockImplementation(() => {
  return { ok: true, json: mockJsonFn };
});
const mockPatchFn = jest.fn().mockImplementation(() => {
  return { ok: true };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
        patch: mockPatchFn,
      };
    }),
  };
});

let client;

const locales = [
  {
    "id": "en_US.UTF-8",
    "language": "English",
    "territory": "United States",
  },
  {
    "id": "es_ES.UTF-8",
    "language": "Spanish",
    "territory": "Spain",
  },
];

const config = {
  "locales": [
    "en_US.UTF-8",
  ],
  "keymap": "us",
  "timezone": "Europe/Berlin",
  "uiLocale": "en_US.UTF-8",
  "uiKeymap": "us",
};

beforeEach(() => {
  client = new L10nClient(new HTTPClient(new URL("http://localhost")));
});

describe("#locales", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue(locales);
  });

  it("returns the list of available locales", async () => {
    const locales = await client.locales();

    expect(locales).toEqual([
      { id: "en_US.UTF-8", name: "English", territory: "United States" },
      { id: "es_ES.UTF-8", name: "Spanish", territory: "Spain" },
    ]);
    expect(mockGetFn).toHaveBeenCalledWith("/l10n/locales");
  });
});

describe("#getConfig", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue(config);
  });

  it("returns the list of selected locales", async () => {
    const l10nConfig = await client.getConfig();

    expect(l10nConfig).toEqual(config);
    expect(mockGetFn).toHaveBeenCalledWith("/l10n/config");
  });
});

describe("#setConfig", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue(config);
  });

  it("updates the l10n configuration", async () => {
    await client.setConfig(config);
    client.setConfig(config);
    expect(mockPatchFn).toHaveBeenCalledWith("/l10n/config", config);
  });
});

describe("#getLocales", () => {
  beforeEach(() => {
    mockJsonFn.mockResolvedValue(config);
  });

  it("returns the list of selected locales", async () => {
    const locales = await client.getLocales();

    expect(locales).toEqual(["en_US.UTF-8"]);
    expect(mockGetFn).toHaveBeenCalledWith("/l10n/config");
  });
});
