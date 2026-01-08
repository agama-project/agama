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
import { Alert, Content, ExpandableSection, List, ListItem } from "@patternfly/react-core";
import { _, formatList } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useDestructiveActions } from "~/hooks/use-destructive-actions";

// FIXME: this component has a bunch of logic/calls copied from
// storage/ProposalResultSection that should be moved to a reusable hook.
export default function PotentialDataLossAlert({
  isCompact = false,
  hint = _("If you are unsure, check and adjust the storage settings."),
}) {
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
    <Alert title={title} variant="danger">
      <Content component="p">{hint}</Content>
      {!isCompact && (
        <ExpandableSection
          toggleTextCollapsed={_("View details")}
          toggleTextExpanded={_("Hide details")}
        >
          <List>
            {actions.map((a, i) => (
              <ListItem key={i}>{a.text}</ListItem>
            ))}
          </List>
        </ExpandableSection>
      )}
    </Alert>
  );
}
