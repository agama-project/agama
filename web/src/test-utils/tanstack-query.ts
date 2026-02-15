/*
 * Copyright (c) [2026] SUSE LLC
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

import type { UseSuspenseQueryOptions, QueryKey } from "@tanstack/react-query";

type QueryMock = { queryKey: QueryKey; data: unknown };

/**
 * Compare two query keys for equality
 *
 * @param keyA - First query key
 * @param keyB - Second query key
 * @returns true if the query keys are equal
 *
 * @example
 *   queryKeysEqual(["config"], ["config"]) // true
 *   queryKeysEqual(["users", 1], ["users", 1]) // true
 *   queryKeysEqual(["config"], ["users"]) // false
 */
function queryKeysEqual(keyA: QueryKey, keyB: QueryKey): boolean {
  return JSON.stringify(keyA) === JSON.stringify(keyB);
}

/**
 * Internal mock for manipulating React Query's useSuspenseQuery results.
 *
 * @remarks Last resort testing solution
 * **USE SPARINGLY** - Prefer mocking hooks directly when possible.
 *
 * This utility exists to work around Jest's limitation with mocking internal
 * module calls. When a hook that uses a query (e.g., useConfig) lives in the
 * same module as hooks that consume it (e.g., useAddDevice, useRemoveDevice),
 * Jest cannot mock the consumer hook because internal module calls bypass
 * Jest's module mocking system.
 *
 * Use only when a query hook and its consumer are in the same module and it is
 * not feasible to:
 *  - Restructure the module to make these hooks live in different modles
 *  - Extract the main logic for testing purposes
 *
 * @see ~/hooks/model/system/network#getNetworkStatus for an example of
 * extracting logic for testing
 *
 * @example Problem scenario
 * ```typescript
 * // ~/hooks/model/config/dasd.ts
 * export function useConfig() { return useSuspenseQuery(...); }
 * export function useAddDevice() {
 *   const config = useConfig(); // <- This internal call bypasses mocks!
 *   // ...
 * }
 * ```
 */
const mockUseSuspenseQuery: jest.Mock = jest.fn();

/**
 * Storage for mocked queries by query key
 */
let mockedQueries: QueryMock[] = [];

function clearMockedQueries() {
  mockedQueries = [];
}

/**
 * Mock data for a specific query key
 *
 * @example
 *   mockQuery(["config"], { dasd: { devices: [] } });
 *   mockQuery(["users"], { users: [{ id: 1, name: "Alice" }] });
 */
function mockQuery(queryKey: QueryKey, data: unknown) {
  const existingIndex = mockedQueries.findIndex((mock) => queryKeysEqual(mock.queryKey, queryKey));

  if (existingIndex >= 0) {
    mockedQueries[existingIndex].data = data;
  } else {
    mockedQueries.push({ queryKey, data });
  }
}

/**
 * Mock data for config query
 *
 * @example
 *   mockConfigQuery({ dasd: { devices: [] } });
 */
function mockConfigQuery(data: unknown) {
  mockQuery(["config"], data);
}

// Set up the mock implementation
mockUseSuspenseQuery.mockImplementation((options: UseSuspenseQueryOptions) => {
  const match = mockedQueries.find((mock) => queryKeysEqual(mock.queryKey, options.queryKey));

  if (match) {
    const data = options.select ? options.select(match.data) : match.data;
    return { data };
  }

  return { data: null };
});

jest.mock("@tanstack/react-query", () => ({
  ...jest.requireActual("@tanstack/react-query"),
  useSuspenseQuery: (options: UseSuspenseQueryOptions) => mockUseSuspenseQuery(options),
}));

export { mockQuery, mockConfigQuery, clearMockedQueries };
