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
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDataInvalidator } from "~/queries/hooks.js";

const mockRevalidateFn = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useRevalidator: () => ({ revalidate: mockRevalidateFn })
}));

const queryClient = new QueryClient();
jest.spyOn(queryClient, "invalidateQueries");
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe("useDataInvalidator", () => {
  it("forces a data/cache refresh", () => {
    const { result } = renderHook(() => useDataInvalidator(), { wrapper });
    const { current: dataInvalidator } = result;
    dataInvalidator({ queryKey: "fakeQuery" });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: "fakeQuery" });
    expect(mockRevalidateFn).toHaveBeenCalled();
  });
});
