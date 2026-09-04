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

// Manual mock for `useTerminalSession`. Applied by default to every test (see
// setupTests.ts), so components using it (TerminalPane) do not end up
// creating a real xterm.js instance or opening a real WebSocket in jsdom.
//
// Tests that need to exercise the real hook (see use-terminal-session.test.ts)
// can opt back in with `jest.unmock("~/hooks/use-terminal-session")`.
export const useTerminalSession = jest.fn(() => ({
  setFontSize: jest.fn(),
  clear: jest.fn(),
}));
