/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useState } from "react";
import { List, ListItem, ExpandableSection } from "@patternfly/react-core";
import { n_ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { partition } from "~/utils";
import { Action } from "~/types/storage";

const ActionsList = ({ actions }: { actions: Action[] }) => {
  // Some actions (e.g., deleting a LV) are reported as several actions joined by a line break
  const actionItems = (action: Action, id: number) => {
    return action.text.split("\n").map((text, index) => {
      const Wrapper = action.delete ? "strong" : "span";

      return (
        <ListItem key={`${id}-${index}`}>
          <Wrapper>{text}</Wrapper>
        </ListItem>
      );
    });
  };

  const items = actions.map(actionItems).flat();

  return <List>{items}</List>;
};

/**
 * Renders a dialog with the given list of actions
 * @component
 *
 * @param props
 * @param [props.actions=[]] - The actions to perform in the system.
 * @param [props.isOpen=false] - Whether the dialog is visible or not.
 * @param [props.onClose] - Whether the dialog is visible or not.
 */
export default function ProposalActionsDialog({
  actions = [],
}: {
  actions?: Action[];
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (actions.length === 0) return null;

  const [generalActions, subvolActions] = partition(actions, (a: Action) => !a.subvol);
  const toggleText = isExpanded
    ? // TRANSLATORS: show/hide toggle action, this is a clickable link
      sprintf(
        n_("Hide %d subvolume action", "Hide %d subvolume actions", subvolActions.length),
        subvolActions.length,
      )
    : // TRANSLATORS: show/hide toggle action, this is a clickable link
      sprintf(
        n_("Show %d subvolume action", "Show %d subvolume actions", subvolActions.length),
        subvolActions.length,
      );

  return (
    <>
      <ActionsList actions={generalActions} />
      {subvolActions.length > 0 && (
        <ExpandableSection
          isIndented
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          toggleText={toggleText}
        >
          <ActionsList actions={subvolActions} />
        </ExpandableSection>
      )}
    </>
  );
}
