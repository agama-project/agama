/*
 * Copyright (c) [2023] SUSE LLC
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
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";

import { _ } from "~/i18n";
import { RowActions } from "~/components/core";
import { InitiatorForm } from "~/components/storage/iscsi";
import { useInitiatorMutation } from "~/queries/storage/iscsi";

export default function InitiatorPresenter({ initiator }) {
  const { mutateAsync: updateInitiator } = useInitiatorMutation();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);
  const closeForm = () => setIsFormOpen(false);
  const submitForm = async ({ name }) => {
    await updateInitiator({ name });

    closeForm();
  };

  const initiatorActions = () => {
    const actions = {
      edit: { title: _("Edit"), onClick: openForm },
    };

    return [actions.edit];
  };

  const Content = () => {
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
      {isFormOpen && (
        <InitiatorForm initiator={initiator} onSubmit={submitForm} onCancel={closeForm} />
      )}
    </>
  );
}
