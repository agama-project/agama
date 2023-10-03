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
import { Skeleton } from "@patternfly/react-core";
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import { _ } from "~/i18n";
import { RowActions } from '~/components/core';
import { InitiatorForm } from "~/components/storage/iscsi";

export default function InitiatorPresenter({ initiator, client }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    setIsLoading(initiator === undefined);
  }, [initiator]);

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);
  const submitForm = async (data) => {
    await client.iscsi.setInitiatorName(data.name);

    setIsLoading(true);
    closeForm();
  };

  const initiatorActions = () => {
    const actions = {
      edit: { title: _("Edit"), onClick: openForm }
    };

    return [actions.edit];
  };

  const Content = () => {
    if (isLoading) {
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
        <Td dataLabel={_("Name")}>{initiator.name}</Td>
        {/* TRANSLATORS: usually just keep the original text */}
        {/* iBFT = iSCSI Boot Firmware Table, HW support for booting from iSCSI */}
        <Td dataLabel={_("iBFT")}>{initiator.ibft ? _("Yes") : _("No")}</Td>
        <Td dataLabel={_("Offload card")}>{initiator.offloadCard || _("None")}</Td>
        <Td isActionCell>
          <RowActions actions={initiatorActions()} id="actions-for-initiator" />
        </Td>
      </Tr>
    );
  };

  return (
    <>
      <Table variant="compact">
        <Thead>
          <Tr>
            <Th width={50}>{_("Name")}</Th>
            <Th>{_("iBFT")}</Th>
            <Th>{_("Offload card")}</Th>
            <Th />
          </Tr>
        </Thead>
        <Tbody>
          <Content />
        </Tbody>
      </Table>
      { isFormOpen &&
        <InitiatorForm
          initiator={initiator}
          onSubmit={submitForm}
          onCancel={closeForm}
        /> }
    </>
  );
}
