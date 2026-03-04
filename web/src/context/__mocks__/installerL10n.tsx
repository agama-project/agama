/*
 * Copyright (c) [2025-2026] SUSE LLC
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

const L10nContext = React.createContext(null);

export const useInstallerL10n = () => {
  const context = React.useContext(L10nContext);
  if (!context) {
    throw new Error("useInstallerL10n must be used within a InstallerL10nContext");
  }
  return context;
};

export const InstallerL10nProvider = ({ children }) => {
  const value = {
    language: "en-US",
    loadedLanguage: "en-US",
    keymap: "us",
    changeLanguage: jest.fn(),
    changeKeymap: jest.fn(),
  };

  return <L10nContext.Provider value={value}>{children}</L10nContext.Provider>;
};
