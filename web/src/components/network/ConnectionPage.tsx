/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { useParams } from "react-router";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { useConnections } from "~/hooks/model/proposal/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import ConnectionDetails from "~/components/network/ConnectionDetails";
import { Icon } from "~/components/layout";
import { NETWORK } from "~/routes/paths";
import NoPersistentConnectionsAlert from "~/components/network/NoPersistentConnectionsAlert";

const ConnectionNotFound = ({ id }) => {
  // TRANSLATORS: %s will be replaced with connection id
  const text = sprintf(_('"%s" does not exist or is no longer available.'), id);

  return (
    <EmptyState
      headingLevel="h3"
      titleText={_("Connection not found or lost")}
      icon={() => <Icon name="error" />}
    >
      <EmptyStateBody>{text}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Link to={NETWORK.root} variant="link" isInline>
            {_("Go to network page")}
          </Link>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
};

// TODO: evaluate whether this page and ConnectionDetails should merge config
// and system connections (like EditConnectionForm does) so that displayed values
// reflect what the user actually configured. Currently useConnections reads from
// the proposal source, which always reports e.g. method4: "auto" even when the
// config has no method set. If merging is not adopted here, ConnectionForm should
// be made consistent and drop its own merge too.
export default function ConnectionPage() {
  const { id } = useParams();
  const connections = useConnections();
  const connection = connections.find((c) => c.id === id);

  return (
    <Page
      breadcrumbs={[{ label: _("Network"), path: NETWORK.root }, { label: connection?.id }]}
      progress={{ scope: "network", ensureRefetched: "system" }}
    >
      <Page.Content>
        <NoPersistentConnectionsAlert />
        {connection ? (
          <ConnectionDetails connection={connection} />
        ) : (
          <ConnectionNotFound id={id} />
        )}
      </Page.Content>
    </Page>
  );
}
