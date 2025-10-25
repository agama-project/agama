/*
 * Copyright (c) [2024] SUSE LLC
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
import { InstallerClientProvider } from "./installer";
import { InstallerL10nProvider } from "./installerL10n";
import { StorageUiStateProvider } from "./storage-ui-state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { localConnection } from "~/utils";

// Determines which "network mode" should Tanstack Query use
//
// When running on a local connection, we assume that the server is always
// available so Tanstack Query is expected to perform all the request, no
// matter whether the network is available on not.
//
// For remote connections, let's use the default "online" mode.
//
// See https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
const networkMode = (): "always" | "online" => {
  return localConnection() ? "always" : "online";
};

const sharedOptions = {
  networkMode: networkMode(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: sharedOptions,
    mutations: sharedOptions,
  },
});

/**
 * Combines all application providers.
 */
function AppProviders({ children }: React.PropsWithChildren) {
  return (
    <InstallerClientProvider>
      <QueryClientProvider client={queryClient}>
        <InstallerL10nProvider>
          <StorageUiStateProvider>{children}</StorageUiStateProvider>
        </InstallerL10nProvider>
      </QueryClientProvider>
    </InstallerClientProvider>
  );
}

export { AppProviders };
