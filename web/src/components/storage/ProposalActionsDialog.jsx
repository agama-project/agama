/*
 * Copyright (c) [2022-2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { List, ListItem, ExpandableSection, } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import { partition } from "~/utils";
import { If, Popup } from "~/components/core";

const ActionsList = ({ actions }) => {
  // Some actions (e.g., deleting a LV) are reported as several actions joined by a line break
  const actionItems = (action, id) => {
    return action.text.split("\n").map((text, index) => {
      return (
        <ListItem key={`${id}-${index}`} className={action.delete ? "proposal-action--delete" : null}>
          {text}
        </ListItem>
      );
    });
  };

  const items = actions.map(actionItems).flat();

  return <List className="proposal-actions">{items}</List>;
};

/**
 * Renders a dialog with the given list of actions
 * @component
 *
 * @param {object} props
 * @param {object[]} [props.actions=[]] - The actions to perform in the system.
 * @param {boolean} [props.isOpen=false] - Whether the dialog is visible or not.
 * @param {() => void} props.onClose - Whether the dialog is visible or not.
 */
export default function ProposalActionsDialog({ actions = [], isOpen = false, onClose }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (typeof onClose !== 'function') {
    console.error("Missing ProposalActionsDialog#onClose callback");
  }

  if (actions.length === 0) return null;

  const [generalActions, subvolActions] = partition(actions, a => !a.subvol);
  const toggleText = isExpanded
    // TRANSLATORS: show/hide toggle action, this is a clickable link
    ? sprintf(n_("Hide %d subvolume action", "Hide %d subvolume actions", subvolActions.length), subvolActions.length)
    // TRANSLATORS: show/hide toggle action, this is a clickable link
    : sprintf(n_("Show %d subvolume action", "Show %d subvolume actions", subvolActions.length), subvolActions.length);

  const blockSize = actions.length < 15 ? "medium" : "large";

  return (
    <Popup
      // TRANSLATORS: The storage "Planned Actions" dialog's title. The
      // dialog shows a list of planned actions for the selected device, e.g.
      // "delete partition A", "create partition B with filesystem C", ...
      title={_("Planned Actions")}
      isOpen={isOpen}
      blockSize={subvolActions.length === 0 ? "auto" : blockSize}
    >
      <ActionsList actions={generalActions} />
      <If
        condition={subvolActions.length > 0}
        then={
          <ExpandableSection
            isIndented
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
            toggleText={toggleText}
            className="expandable-actions"
          >
            <ActionsList actions={subvolActions} />
          </ExpandableSection>
        }
      />
      <Popup.Actions>
        <Popup.SecondaryAction onClick={onClose}>{_("Close")}</Popup.SecondaryAction>
      </Popup.Actions>
    </Popup>
  );
}
