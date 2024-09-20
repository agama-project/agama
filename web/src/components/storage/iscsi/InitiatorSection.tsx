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

import React from "react";

import { _ } from "~/i18n";
import { Section } from "~/components/core";
import { InitiatorPresenter } from "~/components/storage/iscsi";
import { useInitiator, useInitiatorChanges } from "~/queries/storage/iscsi";

export default function InitiatorSection() {
  const initiator = useInitiator();
  useInitiatorChanges();

  return (
    // TRANSLATORS: iSCSI initiator section name
    <Section title={_("Initiator")}>
      <InitiatorPresenter initiator={initiator} />
    </Section>
  );
}
