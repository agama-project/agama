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

import { renderHook } from "@testing-library/react";
import { usePageState } from "~/components/storage/storage-page/use-page-state";
import type { Issue } from "~/model/issue";

const mockConfigModel = jest.fn();
const mockAvailableDevices = jest.fn();
const mockProposal = jest.fn();
const mockIssues = jest.fn();

jest.mock("~/hooks/model/storage/config-model", () => ({
  ...jest.requireActual("~/hooks/model/storage/config-model"),
  useConfigModel: () => mockConfigModel(),
}));

jest.mock("~/hooks/model/system/storage", () => ({
  ...jest.requireActual("~/hooks/model/system/storage"),
  useAvailableDevices: () => mockAvailableDevices(),
}));

jest.mock("~/hooks/model/proposal/storage", () => ({
  ...jest.requireActual("~/hooks/model/proposal/storage"),
  useProposal: () => mockProposal(),
}));

jest.mock("~/hooks/model/issue", () => ({
  ...jest.requireActual("~/hooks/model/issue"),
  useIssues: () => mockIssues(),
}));

const issue = (klass: string): Issue => ({ class: klass, description: klass }) as Issue;

describe("usePageState", () => {
  beforeEach(() => {
    mockConfigModel.mockReturnValue({ drives: [] });
    mockAvailableDevices.mockReturnValue([{ sid: 1 }]);
    mockProposal.mockReturnValue({ actions: [] });
    mockIssues.mockReturnValue([]);
  });

  it("is the page when everything can be shown", () => {
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "page" });
  });

  it("has no devices when none is available, whatever else is true", () => {
    mockAvailableDevices.mockReturnValue([]);
    mockConfigModel.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("somethingElse")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "noDevices" });
  });

  it("is invalid when there is a model and an issue that cannot be fixed here", () => {
    mockProposal.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("configNoRoot"), issue("somethingElse")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({
      kind: "invalid",
      issues: [issue("configNoRoot"), issue("somethingElse")],
    });
  });

  it("does not list the proposal issue among the invalid ones", () => {
    mockProposal.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("somethingElse"), issue("proposal")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "invalid", issues: [issue("somethingElse")] });
  });

  it("is invalid when there is no model and the configuration has issues", () => {
    mockConfigModel.mockReturnValue(null);
    mockProposal.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("configNoRoot")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "invalid", issues: [issue("configNoRoot")] });
  });

  it("is unknown, once the issues are fixed, if there is still no model", () => {
    mockConfigModel.mockReturnValue(null);
    mockProposal.mockReturnValue(null);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "unknown", hasProposal: false });
  });

  it("is unknown with a proposal when there is no model but a layout was calculated", () => {
    mockConfigModel.mockReturnValue(null);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "unknown", hasProposal: true });
  });

  it("is the page when the issues can be fixed here", () => {
    mockProposal.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("configNoRoot"), issue("proposal")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "page" });
  });

  it("is the page when only the layout failed", () => {
    mockProposal.mockReturnValue(null);
    mockIssues.mockReturnValue([issue("proposal")]);
    const { result } = renderHook(() => usePageState());
    expect(result.current).toEqual({ kind: "page" });
  });
});
