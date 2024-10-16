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

import React, { Suspense } from "react";
// import { createRemoteComponent } from "@module-federation/bridge-react";
import { init, loadRemote } from "@module-federation/enhanced/runtime";

/* disable translation check, this is just an example file */
/* -eslint-disable i18next/no-literal-string */

// define progress component
const PluginLoading = <div>Loading...</div>;

init({
  name: "agama-main-app",
  remotes: [
    {
      name: "plugin",
      entry: "http://localhost:3000/agamaPlugin.js",
    },
  ],
});

const AgamaPlugin = React.lazy(() => loadRemote("plugin/Plugin"));

/**
 * Renders an example plugin card
 */
export default function PluginLoader() {
  return (
    <Suspense fallback={PluginLoading}>
      <AgamaPlugin />
    </Suspense>
  );
}
