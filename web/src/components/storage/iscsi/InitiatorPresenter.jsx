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

import React, { useEffect, useState } from "react";
import { DropdownToggle, Skeleton } from "@patternfly/react-core";
import { TableComposable, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';

import { Icon } from '~/components/layout';
import { InitiatorForm } from "~/components/storage/iscsi";

const RowActions = ({ actions, id, ...props }) => {
  const actionsToggle = (props) => (
    <DropdownToggle
      id={id}
      aria-label="Actions"
      toggleIndicator={null}
      isDisabled={props.isDisabled}
      onToggle={props.onToggle}
    >
      <Icon name="more_vert" size="24" />
    </DropdownToggle>
  );

  return (
    <ActionsColumn
      items={actions}
      actionsToggle={actionsToggle}
      {...props}
    />
  );
};

export default function InitiatorPresenter({ initiator, client }) {
  const [data, setData] = useState();
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (initiator !== undefined) setData({ ...initiator });
  }, [setData, initiator]);

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);

  const onSuccess = () => {
    setData(undefined);
    closeForm();
  };

  const initiatorActions = () => {
    const actions = {
      edit: { title: "Edit", onClick: openForm }
    };

    return [actions.edit];
  };

  const Content = () => {
    if (data === undefined) {
      return (
        <Tr>
          <Td colSpan={4}>
            <Skeleton />
          </Td>
        </Tr>
      );
    }

    return (
      <Tr>
        <Td>{data.name}</Td>
        <Td>{data.ibft ? "Yes" : "No"}</Td>
        <Td>{data.offloadCard || "None"}</Td>
        <Td isActionCell>
          <RowActions actions={initiatorActions()} id="actions-for-initiator" />
        </Td>
      </Tr>
    );
  };

  return (
    <>
      <TableComposable gridBreakPoint="grid-sm" variant="compact" className="users">
        <Thead>
          <Tr>
            <Th width={50}>Name</Th>
            <Th>iBFT</Th>
            <Th>Offload card</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          <Content />
        </Tbody>
      </TableComposable>
      { isFormOpen &&
        <InitiatorForm
          initiator={initiator}
          client={client}
          onSuccess={onSuccess}
          onCancel={closeForm}
        /> }
    </>
  );
}
