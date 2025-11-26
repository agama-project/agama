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

import React from "react";
import { useParams } from "react-router";
import {
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { useConnections } from "~/hooks/api/proposal/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import WiredConnectionDetails from "./WiredConnectionDetails";
import { Icon } from "../layout";
import { NETWORK } from "~/routes/paths";
import NoPersistentConnectionsAlert from "./NoPersistentConnectionsAlert";

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

export default function WiredConnectionPage() {
  const { id } = useParams();
  const connections = useConnections();
  const connection = connections.find((c) => c.id === id);

  const title = _("Connection details");

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{title}</Content>
      </Page.Header>
      <Page.Content>
        <NoPersistentConnectionsAlert />
        {connection ? (
          <WiredConnectionDetails connection={connection} />
        ) : (
          <ConnectionNotFound id={id} />
        )}
      </Page.Content>
    </Page>
  );
}
