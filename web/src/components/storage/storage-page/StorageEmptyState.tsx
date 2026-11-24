/*
 * Copyright (c) [2026] SUSE LLC
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
import InvalidConfigMessage from "~/components/storage/storage-page/InvalidConfigMessage";
import NoDevicesMessage from "~/components/storage/storage-page/NoDevicesMessage";
import UnsupportedConfigMessage from "~/components/storage/storage-page/UnsupportedConfigMessage";
import UnknownConfigMessage from "~/components/storage/storage-page/UnknownConfigMessage";
import type { PageState } from "~/components/storage/storage-page/use-page-state";

export type StorageEmptyStateProps = {
  /** Why the page is not shown: any state of the page but the page itself. */
  state: Exclude<PageState, { kind: "page" }>;
};

/**
 * What takes the whole storage page when it cannot be shown: no disk to
 * install on, a configuration with problems that cannot be fixed here, or one
 * this interface cannot represent, either with a layout that can be installed
 * or without one.
 *
 * All the actions they offer are tertiary buttons: none is the one to take.
 */
export default function StorageEmptyState({ state }: StorageEmptyStateProps): React.ReactNode {
  switch (state.kind) {
    case "noDevices":
      return <NoDevicesMessage />;
    case "invalid":
      return <InvalidConfigMessage issues={state.issues} />;
    case "unknown":
      return state.hasProposal ? <UnsupportedConfigMessage /> : <UnknownConfigMessage />;
  }
}
