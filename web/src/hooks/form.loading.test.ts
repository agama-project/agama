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
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

/**
 * Guards against files importing each other in a circle around the form tools.
 *
 * `withForm` builds a component while its file is being read, before anything
 * renders. That works only if the form tools are fully loaded by then, which
 * stops being true when their own imports lead back to a component that uses
 * them. Files in a circle load in an order nobody chose, so one of them runs
 * too early and fails with "withForm is not a function", pointing at that
 * component instead of at the imports responsible for it.
 *
 * Asking for the form tools before anything else, as the first thing a fresh
 * test does, recreates exactly that situation. This stays quiet until an
 * import closes the circle again.
 */
describe("the form tools", () => {
  it("are ready for the components that build fields as they load", async () => {
    const { useAppForm, withForm } = await import("~/hooks/form");

    expect(typeof withForm).toBe("function");
    expect(typeof useAppForm).toBe("function");
  });
});
