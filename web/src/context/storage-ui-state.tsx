/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useCallback, useState } from "react";

const StorageUiStateContext = React.createContext(null);

/**
 * Temporary context to store the state of the different elements of the storage UI (tabs,
 * expandable sections, etc.) while the user navigates through the different storage routes.
 *
 * Initially that state information was stored in the URL (see previous commits), using
 * useSearchParams to update it. But the update function provided by useSearchParams triggers a
 * navigate, which resets the scroll to the top.
 *
 * We tried to solve the scroll problem while still using the URL to store the state, but the
 * following solutions were discarded for several reasons. Some of then could be re-evaluated if the
 * circumstances change.
 *
 * Discarded 1: Using ScrollRestoration to keep the scroll position when navigating. It does not work
 * because our problem is not with the scroll of the page, but with the scroll of a given container
 * within the page. We would need to patch ReactRouter to be able to use scroll restoration in an
 * element of the page. Something like
 * https://github.com/joshkel/react-router/commit/2bbf60ec00a3efc419e0d1f00761fecd43beeb9b
 *
 * Discarded 2: Preventing useSearchParams to rely on navigate. Discussed here
 * https://github.com/remix-run/react-router/discussions/9851
 * There is no official way to really prevent that navigation.
 *
 * Discarded 3: Using nuq. It really allows to implement that behavior, but integration in our
 * project is not trivial at this point in time.
 *
 * Discarded 4: Using Tansack Router. It allows both fine-grained control of the scroll for several
 * areas and changing the query params without re-rendering. But changing the router just for this
 * is too much.
 *
 * Discarded 5: Updating the browser history without relying on useSearchParams. Causes the router
 * and the browser histories to go out of sync, which is problematic when browsing through the
 * interface (eg. returning to the storage page after having visited a form).
 *
 * Discarded 6: Using shouldRevalidate to return false and interrupt the process (requires also
 * redefining the loader). This prevents the reloading of the information, but it does not really
 * prevent the re-render, so the scroll reset is still there.
 *
 * In the end, we implemented this context to store the state information of the UI elements.
 * Hopefully it can be reverted in the future to use the URL again.
 *
 * This returns the functions to check and to modify the status information.
 */
function useStorageUiState() {
  const context = React.useContext(StorageUiStateContext);
  if (context === undefined) {
    throw new Error("useStorageUiState must be used within a StorageUiStateProvider");
  }

  return context;
}

/*
 * Provider for the state of the storage UI elements. See useStorageUiState.
 */
function StorageUiStateProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState(new Map());
  const setUiState = useCallback(
    (newState) => {
      setState(typeof newState === "function" ? newState(new Map(state)) : newState);
    },
    [state, setState],
  );

  return (
    <StorageUiStateContext.Provider value={{ uiState: state, setUiState }}>
      {children}
    </StorageUiStateContext.Provider>
  );
}

export { StorageUiStateProvider, useStorageUiState };
