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

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { getConfig, putConfig } from "~/api";
import { configQuery, useUpdateConfig } from "~/hooks/model/config";

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  getConfig: jest.fn(),
  putConfig: jest.fn(),
}));

const mockGetConfig = getConfig as jest.Mock;
const mockPutConfig = putConfig as jest.Mock;

describe("useUpdateConfig", () => {
  let queryClient: QueryClient;

  const renderUpdateConfig = () =>
    renderHook(() => useUpdateConfig(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }).result.current;

  beforeEach(async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // A config loaded earlier and already stale, so submitting fetches it again.
    mockGetConfig.mockResolvedValueOnce({ hostname: { static: "old" } });
    await queryClient.fetchQuery(configQuery);
    mockPutConfig.mockResolvedValue({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("puts the patch on top of a freshly fetched config", async () => {
    mockGetConfig.mockResolvedValue({ hostname: { static: "fresh" } });
    const updateConfig = renderUpdateConfig();

    await act(() => updateConfig({ l10n: { keymap: "es" } }));

    expect(mockPutConfig).toHaveBeenCalledWith({
      hostname: { static: "fresh" },
      l10n: { keymap: "es" },
    });
  });

  it("still puts the patch when a refetch cancels the config fetch it joined", async () => {
    const fresh = { hostname: { static: "fresh" } };
    mockGetConfig
      .mockReturnValueOnce(new Promise(() => {}))
      .mockReturnValueOnce(new Promise((resolve) => setTimeout(() => resolve(fresh), 10)));
    const updateConfig = renderUpdateConfig();

    await act(async () => {
      // A background refetch is in flight (held by a busy backend) ...
      queryClient.refetchQueries({ queryKey: ["config"] });
      // ... the submit joins it ...
      const submit = updateConfig({ l10n: { keymap: "es" } });
      // ... and a newer refetch (as on a ProposalChanged event) cancels it.
      queryClient.refetchQueries({ queryKey: ["config"] });
      await submit;
    });

    expect(mockPutConfig).toHaveBeenCalledWith({
      hostname: { static: "fresh" },
      l10n: { keymap: "es" },
    });
  });

  it("does not put the patch when fetching the config fails", async () => {
    mockGetConfig.mockRejectedValue(new Error("Network error"));
    const updateConfig = renderUpdateConfig();

    await expect(act(() => updateConfig({ l10n: { keymap: "es" } }))).rejects.toThrow(
      "Network error",
    );
    expect(mockPutConfig).not.toHaveBeenCalled();
  });
});
