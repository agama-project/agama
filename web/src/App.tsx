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
import { useIssuesChanges } from "~/hooks/api/issue";
import { useProposalChanges } from "~/hooks/api/proposal";
import { useStatus } from "~/hooks/api/status";
import { useExtendedConfig } from "~/hooks/api/config";
import { useSystemChanges } from "~/hooks/api/system";
import { useInstallerStatusChanges } from "~/queries/status";
import { ROOT, PRODUCT } from "~/routes/paths";
import { useQueryClient } from "@tanstack/react-query";
import AlertOutOfSync from "~/components/core/AlertOutOfSync";
import { isEmpty } from "radashi";

/**
 * Main application component.
 */
function App() {
  useProposalChanges();
  useSystemChanges();
  useProductChanges();
  useIssuesChanges();
  useInstallerStatusChanges();

  const location = useLocation();
  const { product } = useExtendedConfig();
  const { progresses, state } = useStatus();
  const queryClient = useQueryClient();
  const isBusy = !isEmpty(progresses);

  // FIXME: check if still needed
  useEffect(() => {
    // Invalidate the queries when unmounting this component.
    return () => {
      queryClient.invalidateQueries();
    };
  }, [queryClient]);

  console.log("App component", {
    progresses,
    state,
    product,
    location: location.pathname,
  });

  const Content = () => {
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

    return <Outlet />;
  };

  return (
    <>
      {/* So far, only the storage backend is able to detect external changes.*/}
      <AlertOutOfSync scope={"Storage"} />
      <Content />
    </>
  );
}

export default App;
