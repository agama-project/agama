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

// @ts-check

import { IssuesClient } from "./issues";
import { StorageClient } from "./storage";

const storageIssues = [
  { description: "Storage issue 1", severity: "error", details: "", source: "" },
  { description: "Storage issue 2", severity: "warn", details: "", source: "" },
  { description: "Storage issue 3", severity: "error", details: "", source: "" }
];

const issues = {
  storage: []
};

jest.spyOn(StorageClient.prototype, 'getIssues').mockImplementation(async () => issues.storage);
jest.spyOn(StorageClient.prototype, 'onIssuesChange');

const clientsWithIssues = {
  storage: new StorageClient()
};

describe("#getAll", () => {
  beforeEach(() => {
    issues.storage = storageIssues;
  });

  it("returns all the storage issues", async () => {
    const client = new IssuesClient(clientsWithIssues);

    const { storage } = await client.getAll();
    expect(storage).toEqual(expect.arrayContaining(storageIssues));
  });
});

describe("#any", () => {
  describe("if there are storage issues", () => {
    beforeEach(() => {
      issues.storage = storageIssues;
    });

    it("returns true", async () => {
      const client = new IssuesClient(clientsWithIssues);

      const result = await client.any();
      expect(result).toEqual(true);
    });
  });

  describe("if there are no issues", () => {
    beforeEach(() => {
      issues.storage = [];
    });

    it("returns false", async () => {
      const client = new IssuesClient(clientsWithIssues);

      const result = await client.any();
      expect(result).toEqual(false);
    });
  });
});

describe("#onIssuesChange", () => {
  it("subscribes to changes in storage issues", () => {
    const client = new IssuesClient(clientsWithIssues);

    const handler = jest.fn();
    client.onIssuesChange(handler);

    expect(clientsWithIssues.storage.onIssuesChange).toHaveBeenCalledWith(handler);
  });
});
