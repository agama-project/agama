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

import React from "react";
import Page from "~/components/layout/Page";
import IssuesAlert from "~/components/core/IssuesAlert";
import ConnectedDevicesMenu from "~/components/storage/ConnectedDevicesMenu";
import StoragePageContent from "~/components/storage/storage-page/StoragePageContent";
import { SpacePolicyMemory } from "~/components/storage/shared/space-policy";
import { useIssues } from "~/hooks/model/issue";
import { STORAGE_MODEL_QUERY_KEY } from "~/hooks/model/storage/config-model";
import { PROPOSAL_QUERY_KEY } from "~/hooks/model/proposal";
import { _ } from "~/i18n";

/**
 * Where the overview's Storage card leads: what the new system will be
 * installed on, and everything the reader can change about it.
 */
export default function StoragePage(): React.ReactNode {
  const zfcpIssues = useIssues("zfcp");

  return (
    <Page
      breadcrumbs={[{ label: _("Storage") }]}
      additionalContent={<ConnectedDevicesMenu />}
      progress={{
        scope: "storage",
        awaitQueriesRefetch: [PROPOSAL_QUERY_KEY, STORAGE_MODEL_QUERY_KEY],
      }}
    >
      <Page.Content>
        <IssuesAlert issues={zfcpIssues} />
        {/* Here rather than around either control that offers the decision: the
            page and the sheet both do, and they have to agree about it. */}
        <SpacePolicyMemory>
          <StoragePageContent />
        </SpacePolicyMemory>
      </Page.Content>
    </Page>
  );
}
