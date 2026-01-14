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
import { Outlet, useLocation } from "react-router";
import { useStatusChanges, useStatus } from "~/hooks/model/status";
import { useSystemChanges } from "~/hooks/model/system";
import { useProposalChanges } from "~/hooks/model/proposal";
import { useIssuesChanges } from "~/hooks/model/issue";
import { useProductInfo } from "~/hooks/model/config/product";
import { useQueryClient } from "@tanstack/react-query";
import { InstallationFinished, InstallationProgress } from "./components/core";

/**
 * Content guard and flow control component.
 *
 * It consumes global state and determines if a status-driven redirect is
 * necessary before rendering the nested route content via the <Outlet />.
 */
const Content = () => {
  const location = useLocation();
  const product = useProductInfo();
  const { progresses, stage } = useStatus();

  console.log("App Content component", {
    progresses,
    stage,
    product,
    location: location.pathname,
  });

  if (stage === "installing") {
    return <InstallationProgress />;
  }

  if (stage === "finished") {
    return <InstallationFinished />;
  }

  return <Outlet />;
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
  useIssuesChanges();
  useStatusChanges();
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
