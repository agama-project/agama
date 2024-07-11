/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loading } from "./components/layout";
import { Questions } from "~/components/questions";
import { ServerError, Installation } from "~/components/core";
import { useInstallerL10n } from "./context/installerL10n";
import { useInstallerClientStatus } from "~/context/installer";
import { useProduct, useProductChanges } from "./queries/software";
import { CONFIG, INSTALL, STARTUP } from "~/client/phase";
import { BUSY } from "~/client/status";
import { useL10nConfigChanges } from "~/queries/l10n";

/**
 * Main application component.
 *
 * @param {object} props
 * @param {number} [props.max_attempts=3] - Connection attempts before displaying an
 *   error (3 by default). The component will keep trying to connect.
 */
function App() {
  const location = useLocation();
  const { connected, error, phase, status } = useInstallerClientStatus();
  const { selectedProduct, products } = useProduct();
  const { language } = useInstallerL10n();
  useL10nConfigChanges();
  useProductChanges();

  const Content = () => {
    if (error) return <ServerError />;

    if (phase === INSTALL) {
      return <Installation status={status} />;
    }

    if (!products || !connected) return <Loading />;

    if ((phase === STARTUP && status === BUSY) || phase === undefined || status === undefined) {
      return <Loading />;
    }

    if ((selectedProduct === undefined) && (location.pathname !== "/products")) {
      return <Navigate to="/products" />;
    }

    if (phase === CONFIG && status === BUSY && location.pathname !== "/products/progress") {
      return <Navigate to="/products/progress" />;
    }

    return <Outlet />;
  };

  if (!language) return null;

  return (
    <>
      <Content />
      <Questions />
    </>
  );
}

export default App;
