/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loading } from "~/components/layout";
import { useProduct, useProductChanges } from "~/queries/software";
import { useL10nConfigChanges } from "~/queries/l10n";
import { useIssuesChanges } from "~/queries/issues";
import { useInstallerStatus, useInstallerStatusChanges } from "~/queries/status";
import { useDeprecatedChanges } from "~/queries/storage";
import { ROOT, PRODUCT } from "~/routes/paths";
import { InstallationPhase } from "~/types/status";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Main application component.
 */
function App() {
  useL10nConfigChanges();
  useProductChanges();
  useIssuesChanges();
  useInstallerStatusChanges();
  useDeprecatedChanges();

  const location = useLocation();
  const { isBusy, phase } = useInstallerStatus({ suspense: true });
  const { selectedProduct, products } = useProduct({
    suspense: phase !== InstallationPhase.Install,
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidate the queries when unmounting this component.
    return () => {
      queryClient.invalidateQueries();
    };
  }, [queryClient]);

  const Content = () => {
    if (phase === InstallationPhase.Install) {
      console.log("Navigating to the installation progress page");
      return <Navigate to={ROOT.installationProgress} />;
    }

    if (phase === InstallationPhase.Finish) {
      console.log("Navigating to the finished page");
      return <Navigate to={ROOT.installationFinished} />;
    }

    if (!products || (selectedProduct === undefined && isBusy)) {
      console.log("Loading screen: Initialization", {
        products,
        selectedProduct,
        isBusy,
      });
      return <Loading listenQuestions />;
    }

    if (phase === InstallationPhase.Startup && isBusy) {
      console.log("Loading screen: Installer start phase");
      return <Loading listenQuestions />;
    }

    if (selectedProduct === undefined && location.pathname !== PRODUCT.root) {
      console.log("Navigating to the product selection page");
      return <Navigate to={PRODUCT.root} />;
    }

    if (phase === InstallationPhase.Config && isBusy && location.pathname !== PRODUCT.progress) {
      console.log("Navigating to the probing progress page");
      return <Navigate to={PRODUCT.progress} />;
    }

    return <Outlet />;
  };

  return <Content />;
}

export default App;
