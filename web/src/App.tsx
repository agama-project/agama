/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { useStatusChanges, useStatus } from "~/hooks/model/status";
import { useSystemChanges } from "~/hooks/model/system";
import { useProposal, useProposalChanges } from "~/hooks/model/proposal";
import { useIssues, useIssuesChanges } from "~/hooks/model/issue";
import { useProductInfo } from "~/hooks/model/config/product";
import { useL10n } from "~/hooks/model/config/l10n";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import useProductAppearance from "~/hooks/use-product-appearance";
import { useQueryClient } from "@tanstack/react-query";
import { InstallationFinished, InstallationProgress } from "./components/core";
import InstallationFailed from "./components/core/InstallationFailed";
import TerminalDock from "~/components/core/TerminalDock";
import { isLanguageConfirmed } from "~/components/welcome/flags";
import { useInterfaceLanguageFromConfig } from "~/components/welcome/use-interface-language";
import { QUICK_SETUP, WELCOME } from "./routes/paths";

/**
 * Where a new installation goes while no product is selected: the language and
 * keyboard screen, until the language is confirmed, then Quick setup.
 *
 * The language counts as confirmed when the user accepted that screen in this
 * browser, or when the config already sets a locale, as a loaded profile may.
 */
const pendingPath = (configLocale?: string) =>
  isLanguageConfirmed() || configLocale ? QUICK_SETUP.root : WELCOME.root;

/**
 * Content guard and flow control component.
 *
 * It consumes global state and determines if a status-driven redirect is
 * necessary before rendering the nested route content via the <Outlet />.
 */
const Content = () => {
  // FIXME: we need to force TanStack query to retrieve the proposal to make
  // sure it is refreshed after being invalidated. Related to useProgressTracking
  // and useTrackQueriesRefetch.
  //
  // https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
  useProposal();
  useIssues();
  useConfigModel();

  const location = useLocation();
  const product = useProductInfo();
  const l10nConfig = useL10n();
  useInterfaceLanguageFromConfig();
  const status = useStatus();

  // Load the product's optional appearance overrides (assets/appearance/<id>.css).
  useProductAppearance(product?.id);

  console.log("App Content component", {
    stage: status?.stage,
    tasks: status?.tasks,
    progresses: status?.progresses,
    product,
    location: location.pathname,
  });

  // Without a product, only the screens of a new installation can be visited:
  // the one still pending, and the language and keyboard screen, which stays
  // reachable from the header.
  const allowedWithoutProduct = [pendingPath(l10nConfig?.locale), WELCOME.root];
  if (!product && !allowedWithoutProduct.includes(location.pathname)) {
    return <Navigate to={pendingPath(l10nConfig?.locale)} />;
  }

  // The terminal panel is rendered here, above the stage-driven swap below, so
  // that opening a shell before installing keeps it running (and reachable)
  // through the installing/failed/finished screens instead of losing it as
  // soon as the stage changes.
  return (
    <TerminalDock>
      {status?.stage === "failed" ? (
        <InstallationFailed />
      ) : status?.stage === "installing" ? (
        <InstallationProgress />
      ) : status?.stage === "finished" ? (
        <InstallationFinished />
      ) : (
        <Outlet />
      )}
    </TerminalDock>
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
