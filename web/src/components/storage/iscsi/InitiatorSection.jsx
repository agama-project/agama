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

import { Section } from "~/components/core";
import { InitiatorPresenter } from "~/components/storage/iscsi";
import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";

export default function InitiatorSection() {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [initiator, setInitiator] = useState();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    client.setUp().then(() => setInitialized(true));
  }, [client]);

  useEffect(() => {
    if (!initialized) return;

    const loadInitiator = async () => {
      setInitiator(undefined);
      const name = await cancellablePromise(client.iscsi.getInitiatorName());
      const ibft = await cancellablePromise(client.iscsi.getInitiatorIbft());
      setInitiator({ name, ibft, offloadCard: "" });
    };

    loadInitiator().catch(console.error);

    return client.iscsi.onInitiatorChanged(loadInitiator);
  }, [cancellablePromise, client, initialized]);

  return (
    <Section title="Initiator" iconName="settings">
      <InitiatorPresenter
        initiator={initiator}
        client={client}
      />
    </Section>
  );
}
