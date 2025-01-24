/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Loading } from "~/components/layout";
import { useInstallerL10n } from "~/context/installerL10n";
import { useInstallerClientStatus } from "~/context/installer";
import { useProduct, useProductChanges } from "~/queries/software";
import { useL10nConfigChanges } from "~/queries/l10n";
import { useIssuesChanges } from "~/queries/issues";
import { useInstallerStatus, useInstallerStatusChanges } from "~/queries/status";
import { useDeprecatedChanges } from "~/queries/storage";
import { useRootUser } from "~/queries/users";
import { ROOT, PRODUCT, USER } from "~/routes/paths";
import { InstallationPhase } from "~/types/status";
import { isEmpty, useLocalStorage } from "~/utils";

/**
 * Main application component.
 */
function App() {
  const [showWelcomePage] = useLocalStorage("agm-show-welcome-page", true);
  const location = useLocation();
  const { isBusy, phase } = useInstallerStatus({ suspense: true });
  const { connected, error } = useInstallerClientStatus();
  const { selectedProduct, products } = useProduct({ suspense: true });
  const { language } = useInstallerL10n();
  const { password: isRootPasswordDefined, sshkey: rootSSHKey } = useRootUser();
  useL10nConfigChanges();
  useProductChanges();
  useIssuesChanges();
  useInstallerStatusChanges();
  useDeprecatedChanges();

  const Content = () => {
    if (error) return <ServerError />;

    if (showWelcomePage) {
      return <Navigate to={ROOT.welcomePage} />;
    }

    if (phase === InstallationPhase.Install && isBusy) {
      return <Navigate to={ROOT.installationProgress} />;
    }

    if (phase === InstallationPhase.Install && !isBusy) {
      return <Navigate to={ROOT.installationFinished} />;
    }

    if (!products || !connected) return <Loading useLayout />;

    if (phase === InstallationPhase.Startup && isBusy) {
      return <Loading useLayout />;
    }

    if (selectedProduct === undefined && location.pathname !== PRODUCT.root) {
      return <Navigate to={PRODUCT.root} />;
    }

    if (phase === InstallationPhase.Config && isBusy && location.pathname !== PRODUCT.progress) {
      return <Navigate to={PRODUCT.progress} />;
    }

    if (
      phase === InstallationPhase.Config &&
      !isBusy &&
      !isRootPasswordDefined &&
      isEmpty(rootSSHKey) &&
      location.pathname !== USER.rootUser.edit
    ) {
      return <Navigate to={USER.rootUser.edit} state={{ from: location.pathname }} />;
    }

    return <Outlet />;
  };

  if (!language) return null;

  return <Content />;
}

export default App;
