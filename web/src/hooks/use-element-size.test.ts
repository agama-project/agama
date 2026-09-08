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

import { act, renderHook } from "@testing-library/react";
import { useElementSize } from "~/hooks/use-element-size";

type Size = { width: number; height: number };
type Watcher = { node: Element; report: (size: Size) => void };

let watchers: Watcher[] = [];

/* jsdom lays nothing out and has no ResizeObserver. This one records what it
   watches, so a test can say how big something became and check that nothing
   is left watching an element that has gone. */
class ResizeObserverMock {
  private callback: ResizeObserverCallback;
  private own: Watcher[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(node: Element) {
    const watcher = {
      node,
      report: (contentRect: Size) =>
        this.callback(
          [{ target: node, contentRect } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        ),
    };

    this.own.push(watcher);
    watchers.push(watcher);
  }

  unobserve() {}

  disconnect() {
    watchers = watchers.filter((watcher) => !this.own.includes(watcher));
  }
}

const watching = (node: Element) => watchers.some((watcher) => watcher.node === node);

const resizeTo = (node: Element, size: Size) =>
  act(() =>
    watchers.filter((watcher) => watcher.node === node).forEach((watcher) => watcher.report(size)),
  );

beforeEach(() => {
  watchers = [];
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

afterEach(() => {
  delete (window as { ResizeObserver?: unknown }).ResizeObserver;
});

describe("useElementSize", () => {
  it("reports no size until the element is measured", () => {
    const { result } = renderHook(() => useElementSize(document.createElement("div")));

    expect(result.current).toEqual({});
  });

  it("reports the size the observer sees", () => {
    const node = document.createElement("div");
    const { result } = renderHook(() => useElementSize(node));

    resizeTo(node, { width: 800, height: 600 });

    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it("reports every later change", () => {
    const node = document.createElement("div");
    const { result } = renderHook(() => useElementSize(node));

    resizeTo(node, { width: 800, height: 600 });
    resizeTo(node, { width: 320, height: 600 });

    expect(result.current).toEqual({ width: 320, height: 600 });
  });

  describe("when the element is replaced", () => {
    it("measures the new one and lets go of the old", () => {
      const first = document.createElement("div");
      const second = document.createElement("div");
      const { result, rerender } = renderHook((node: HTMLElement) => useElementSize(node), {
        initialProps: first,
      });

      resizeTo(first, { width: 800, height: 600 });
      rerender(second);

      expect(watching(first)).toBe(false);

      resizeTo(second, { width: 320, height: 240 });

      expect(result.current).toEqual({ width: 320, height: 240 });
    });
  });

  describe("when the element goes away", () => {
    it("reports no size, rather than the size it last had", () => {
      const node = document.createElement("div");
      const { result, rerender } = renderHook(
        (element: HTMLElement | null) => useElementSize(element),
        {
          initialProps: node as HTMLElement | null,
        },
      );

      resizeTo(node, { width: 800, height: 600 });
      rerender(null);

      expect(result.current).toEqual({});
      expect(watching(node)).toBe(false);
    });
  });

  it("stops watching when the caller unmounts", () => {
    const node = document.createElement("div");
    const { unmount } = renderHook(() => useElementSize(node));

    unmount();

    expect(watching(node)).toBe(false);
  });
});
