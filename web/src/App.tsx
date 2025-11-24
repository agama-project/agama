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

import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useProductChanges } from "~/queries/software";
import {
  useSystemChanges,
  useProposalChanges,
  useIssuesChanges,
  useStatus,
  useExtendedConfig,
} from "~/hooks/api";
import { useInstallerStatusChanges } from "~/queries/status";
import { ROOT, PRODUCT } from "~/routes/paths";
import { useQueryClient } from "@tanstack/react-query";
import AlertOutOfSync from "~/components/core/AlertOutOfSync";
import { isEmpty } from "radashi";

/**
 * Content guard and flow control component.
 *
 * It consumes global state and determines if a status-driven redirect is
 * necessary before rendering the nested route content via the <Outlet />.
 */
const Content = () => {
  const location = useLocation();
  const { product } = useExtendedConfig({ suspense: true });
  const { progresses, state } = useStatus({ suspense: true });
  const isBusy = !isEmpty(progresses);

  console.log("App Content component", {
    progresses,
    state,
    product,
    location: location.pathname,
  });

  if (state === "installing") {
    console.log("Navigating to the installation progress page");
    return <Navigate to={ROOT.installationProgress} />;
  }

  if (state === "finished") {
    console.log("Navigating to the finished page");
    return <Navigate to={ROOT.installationFinished} />;
  }

  if (product?.id === undefined && !isBusy && location.pathname !== PRODUCT.root) {
    console.log("Navigating to the product selection page");
    return <Navigate to={PRODUCT.root} />;
  }

  return (
    <>
      {/* So far, only the storage backend is able to detect external changes.*/}
      <AlertOutOfSync scope={"Storage"} />
      <Outlet />;
    </>
  );
};

/**
 * Structural wrapper of all protected routes responsible for initializing
 * global background listeners (e.g., useXYZChanges hooks).
 *
 * @performance This component sits high in the route tree, directly wrapping
 * the entire application layout. This makes it critical to avoid consuming
 * application state directly within it to prevent unnecessary cascade layout
 * re-renders.
 */
function App() {
  useProposalChanges();
  useSystemChanges();
  useProductChanges();
  useIssuesChanges();
  useInstallerStatusChanges();
  const queryClient = useQueryClient();

  // FIXME: check if still needed
  useEffect(() => {
    // Invalidate the queries when unmounting this component.
    return () => {
      queryClient.invalidateQueries();
    };
  }, [queryClient]);

  return <Content />;
}

export default App;
