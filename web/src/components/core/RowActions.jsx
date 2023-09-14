/*
 * Copyright (c) [2023] SUSE LLC
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

import React from "react";
import { MenuToggle } from '@patternfly/react-core';
import { ActionsColumn } from '@patternfly/react-table';

import { Icon } from '~/components/layout';
import { _ } from "~/i18n";

/**
 * Renders icon for selecting the options of a row in a table
 * @component
 *
 * @example
 *  <RowActions
 *    id="actions-for-row1"
 *    actions={[
 *      {
 *        title: "Edit",
 *        onClick: () => editItem(1)
 *      },
 *      {
 *        title: "Delete",
 *        onClick: () => deleteItem(1),
 *        className="danger"
 *      }
 *    ]}
 *  />
 *
 * @param {object} props
 * @param {string} props.id
 * @param {Action[]} props.actions
 * @param {object} [props.rest]
 *
 * @typedef {import("@patternfly/react-table").IAction} Action
 *
 * @return {React.ActionsColumn}
 */
export default function RowActions({ id, actions, "aria-label": toggleAriaLabel, ...rest }) {
  const actionsToggle = (props) => (
    <MenuToggle
      id={id}
      variant="plain"
      ref={props.toggleRef}
      isDisabled={props.isDisabled}
      onClick={props.onToggle}
      aria-label={toggleAriaLabel || _("Actions")}
    >
      <Icon name="more_vert" size="24" />
    </MenuToggle>
  );

  return (
    <ActionsColumn
      items={actions}
      actionsToggle={actionsToggle}
      popperProps={{ position: "right" }}
      {...rest}
    />
  );
}
