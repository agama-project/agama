/*
 * Copyright (c) [2022] SUSE LLC
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
import userEvent from "@testing-library/user-event";
import { render } from "@testing-library/react";

import { InstallerClientProvider } from "@context/installer";
import Layout from "@components/layout/Layout.jsx";
import { createClient } from "@client/index";

const InstallerProvider = ({ children }) => {
  const client = createClient();
  return (
    <InstallerClientProvider client={client}>
      {children}
    </InstallerClientProvider>
  );
};

const content = (ui, usingLayout) => {
  if (!usingLayout) return ui;

  return <Layout>{ui}</Layout>;
};

const installerRender = (ui, options = { usingLayout: true }) => {
  const { usingLayout, ...testingLibraryOptions } = options;

  return (
    {
      user: userEvent.setup(),
      ...render(content(ui, usingLayout), { wrapper: InstallerProvider, ...testingLibraryOptions })
    }
  );
};

const plainRender = (ui, options = { usingLayout: true }) => {
  const { usingLayout, ...testingLibraryOptions } = options;

  return (
    {
      user: userEvent.setup(),
      ...render(content(ui, usingLayout), testingLibraryOptions)
    }
  );
};

export { installerRender, plainRender };
