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
import { useParams } from "react-router-dom";
import {
  Alert,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { useConnections, useNetworkChanges } from "~/queries/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import WiredConnectionDetails from "./WiredConnectionDetails";
import { Icon } from "../layout";
import { NETWORK } from "~/routes/paths";

// FIXME: Choose between EmptyState or Alert. Or work to make Empty State to
// look better on big screens. Empty State puts the content too
// far in big resolution.
const ConnectionNotFound = ({
  id,
  variant = "alert",
}: {
  id: string;
  variant: "emptystate" | "alert";
}) => {
  if (variant === "emptystate") {
    return (
      <EmptyState headingLevel="h3" titleText={_("Not found")} icon={() => <Icon name="error" />}>
        <EmptyStateBody>{sprintf(_("There is not a connection with id `%s`"), id)}</EmptyStateBody>

        <EmptyStateFooter>
          <EmptyStateActions>
            <Link to={NETWORK.root} variant="link" isInline>
              {_("Go to network page")}
            </Link>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    );
  }

  return (
    <Alert
      title={_("Not found")}
      variant="danger"
      actionLinks={
        <Link to={NETWORK.root} variant="link" isInline>
          {_("Go to network page")}
        </Link>
      }
    >
      {sprintf(_("There is not a connection with id `%s`"), id)}
    </Alert>
  );
};

export default function WiredConnectionPage() {
  useNetworkChanges();
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
        {connection ? (
          <WiredConnectionDetails connection={connection} />
        ) : (
          <ConnectionNotFound id={id} variant="emptystate" />
        )}
      </Page.Content>
    </Page>
  );
}
