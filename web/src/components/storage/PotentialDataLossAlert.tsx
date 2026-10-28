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
import { Alert, Content, List, ListItem, Stack } from "@patternfly/react-core";
import Link from "~/components/core/Link";
import Interpolate from "~/components/core/Interpolate";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";
import { STORAGE } from "~/routes/paths";

/**
 * Warns the user about pending destructive storage actions before they
 * proceed with the installation.
 *
 * Renders nothing when there are no destructive actions to report, so
 * callers can mount it unconditionally. The headline adapts to whether
 * existing systems will be wiped, and the sub-line offers a direct link to
 * the storage section so the user can review or adjust settings without
 * having to cancel the current flow manually.
 */
export default function PotentialDataLossAlert() {
  let title: string;
  const { actions, affectedSystems } = useDestructiveActions();

  if (actions.length === 0) return;

  if (affectedSystems.length) {
    title = sprintf(
      // TRANSLATORS: %s will be replaced by a formatted list of affected
      // systems like "Windows and openSUSE Tumbleweed".
      _("Proceeding will delete existing data, including %s"),
      formatList(affectedSystems),
    );
  } else {
    title = _("Proceeding may result in data loss");
  }

  return (
    <Alert isInline title={title} variant="danger">
      <Stack hasGutter>
        <List>
          {actions.map((a, i) => (
            <ListItem key={i}>{a.text}</ListItem>
          ))}
        </List>
        <Content component="p">
          <Interpolate
            // TRANSLATORS: advice shown when destructive actions are pending.
            // The text inside [] becomes a link that navigates to the storage section.
            sentence={_("If unsure, cancel and review [storage] settings.")}
          >
            {(text) => (
              <Link to={STORAGE.root} variant="link" isInline>
                {text}
              </Link>
            )}
          </Interpolate>
        </Content>
      </Stack>
    </Alert>
  );
}
