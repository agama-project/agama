/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ServerError } from "~/components/core";
import { Loading, PlainLayout } from "~/components/layout";
import { Questions } from "~/components/questions";
import { useInstallerL10n } from "~/context/installerL10n";
import { useInstallerClientStatus } from "~/context/installer";
import { useProduct, useProductChanges } from "~/queries/software";
import { useL10nConfigChanges } from "~/queries/l10n";
import { useIssuesChanges } from "~/queries/issues";
import { useInstallerStatus, useInstallerStatusChanges } from "~/queries/status";
import { useDeprecatedChanges } from "~/queries/storage";
import { PATHS as PRODUCT_PATHS } from "~/routes/products";
import { PATHS as ROOT_PATHS } from "~/router";
import { InstallationPhase } from "~/types/status";

/**
 * Main application component.
 *
 * @param {object} props
 * @param {number} [props.max_attempts=3] - Connection attempts before displaying an
 *   error (3 by default). The component will keep trying to connect.
 */
function App() {
  const location = useLocation();
  const { isBusy, phase } = useInstallerStatus({ suspense: true });
  const { connected, error } = useInstallerClientStatus();
  const { selectedProduct, products } = useProduct();
  const { language } = useInstallerL10n();
  useL10nConfigChanges();
  useProductChanges();
  useIssuesChanges();
  useInstallerStatusChanges();
  useDeprecatedChanges();

  const Content = () => {
    if (error)
      return (
        <PlainLayout>
          <ServerError />
        </PlainLayout>
      );

    if (phase === InstallationPhase.Install && isBusy) {
      return <Navigate to={ROOT_PATHS.installationProgress} />;
    }

    if (phase === InstallationPhase.Install && !isBusy) {
      return <Navigate to={ROOT_PATHS.installationFinished} />;
    }

    if (!products || !connected) return <Loading />;

    if (phase === InstallationPhase.Startup && isBusy) {
      return (
        <PlainLayout>
          <Loading />
        </PlainLayout>
      );
    }

    if (selectedProduct === undefined && location.pathname !== PRODUCT_PATHS.root) {
      return <Navigate to={PRODUCT_PATHS.products} />;
    }

    if (
      phase === InstallationPhase.Config &&
      isBusy &&
      location.pathname !== PRODUCT_PATHS.progress
    ) {
      return <Navigate to={PRODUCT_PATHS.progress} />;
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
