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

import React, { useState } from "react";
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { RowActions } from '~/components/core';
import { EditNodeForm, LoginForm, NodeStartupOptions } from "~/components/storage/iscsi";

export default function NodesPresenter ({ nodes, client }) {
  const [currentNode, setCurrentNode] = useState();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isLoginFormOpen, setIsLoginFormOpen] = useState(false);

  const openLoginForm = (node) => {
    setCurrentNode(node);
    setIsLoginFormOpen(true);
  };

  const closeLoginForm = () => setIsLoginFormOpen(false);

  const submitLoginForm = async (options) => {
    const result = await client.iscsi.login(currentNode, options);
    if (result === 0) closeLoginForm();

    return result;
  };

  const openEditForm = (node) => {
    setCurrentNode(node);
    setIsEditFormOpen(true);
  };

  const closeEditForm = () => setIsEditFormOpen(false);

  const submitEditForm = async (data) => {
    await client.iscsi.setStartup(currentNode, data.startup);
    closeEditForm();
  };

  const nodeStatus = (node) => {
    // TRANSLATORS: iSCSI connection status
    if (!node.connected) return _("Disconnected");

    const startup = Object.values(NodeStartupOptions).find(o => o.value === node.startup);
    // TRANSLATORS: iSCSI connection status, %s is replaced by node label
    return sprintf(_("Connected (%s)"), startup.label);
  };

  const nodeActions = (node) => {
    const actions = {
      edit: {
        title: _("Edit"),
        onClick: () => openEditForm(node)
      },
      delete: {
        title: _("Delete"),
        onClick: () => client.iscsi.delete(node),
        className: "danger-action"
      },
      login: {
        title: _("Login"),
        onClick: () => openLoginForm(node)
      },
      logout: {
        title: _("Logout"),
        onClick: () => client.iscsi.logout(node)
      }
    };

    if (node.connected)
      return [actions.edit, actions.logout];
    else
      return [actions.login, actions.delete];
  };

  const NodeRow = ({ node }) => {
    return (
      <Tr>
        <Td dataLabel={_("Name")}>{node.target}</Td>
        <Td dataLabel={_("Portal")}>{node.address + ":" + node.port}</Td>
        <Td dataLabel={_("Interface")}>{node.interface}</Td>
        <Td dataLabel={_("iBFT")}>{node.ibft ? _("Yes") : _("No")}</Td>
        <Td dataLabel={_("Status")}>{nodeStatus(node)}</Td>
        <Td isActionCell>
          <RowActions actions={nodeActions(node)} id={`actions-for-node${node.id}`} />
        </Td>
      </Tr>
    );
  };

  const Content = () => {
    return nodes.map(n => <NodeRow node={n} key={`node${n.id}`} />);
  };

  return (
    <>
      <Table variant="compact">
        <Thead>
          <Tr>
            <Th>{_("Name")}</Th>
            <Th>{_("Portal")}</Th>
            <Th>{_("Interface")}</Th>
            <Th>{_("iBFT")}</Th>
            <Th>{_("Status")}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          <Content />
        </Tbody>
      </Table>
      { isLoginFormOpen &&
        <LoginForm
          node={currentNode}
          onSubmit={submitLoginForm}
          onCancel={closeLoginForm}
        /> }
      { isEditFormOpen &&
        <EditNodeForm
          node={currentNode}
          onSubmit={submitEditForm}
          onCancel={closeEditForm}
        /> }
    </>
  );
}
