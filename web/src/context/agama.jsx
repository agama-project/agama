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

import React from "react";
import { InstallerClientProvider } from "./installer";
import { L10nProvider } from "./l10n";
import { ProductProvider } from "./product";
import { NotificationProvider } from "./notification";

/**
 * Combines all application providers.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - content to display within the provider.
 */
function AgamaProviders({ children }) {
  return (
    <InstallerClientProvider>
      <L10nProvider>
        <ProductProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ProductProvider>
      </L10nProvider>
    </InstallerClientProvider>
  );
}

export {
  AgamaProviders
};
