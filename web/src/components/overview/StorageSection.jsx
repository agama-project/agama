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

import React, { useReducer, useEffect } from "react";
import { Text } from "@patternfly/react-core";

import { toValidationError, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { BUSY } from "~/client/status";
import { deviceLabel } from "~/components/storage/utils";
import { Em, ProgressText, Section } from "~/components/core";
import { _ } from "~/i18n";

/**
 * Text explaining the storage proposal
 *
 * FIXME: this needs to be basically rewritten. See
 * https://github.com/openSUSE/agama/discussions/778#discussioncomment-7715244
 */
const ProposalSummary = ({ proposal }) => {
  const { availableDevices = [], result = {} } = proposal;

  const bootDevice = result.settings?.bootDevice;
  if (!bootDevice) return <Text>{_("No device selected yet")}</Text>;

  const device = availableDevices.find(d => d.name === bootDevice);
  const label = device ? deviceLabel(device) : bootDevice;

  const fullMsg = (policy) => {
    switch (policy) {
      case "resize":
        // TRANSLATORS: %s will be replaced by the device name and its size,
        // example: "/dev/sda, 20 GiB"
        return _("Install using device %s shrinking existing partitions as needed");
      case "keep":
        // TRANSLATORS: %s will be replaced by the device name and its size,
        // example: "/dev/sda, 20 GiB"
        return _("Install using device %s without modifying existing partitions");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size,
    // example: "/dev/sda, 20 GiB"
    return _("Install using device %s and deleting all its content");
  };

  const [msg1, msg2] = fullMsg(result.settings?.spacePolicy).split("%s");

  return (
    <Text>
      {msg1}<Em>{label}</Em>{msg2}
    </Text>
  );
};

const initialState = {
  busy: true,
  deprecated: false,
  proposal: undefined,
  errors: [],
  progress: { message: _("Probing storage devices"), current: 0, total: 0 }
};

const reducer = (state, action) => {
  switch (action.type) {
    case "UPDATE_PROGRESS": {
      const { message, current, total } = action.payload;
      return { ...state, progress: { message, current, total } };
    }

    case "UPDATE_STATUS": {
      return { ...initialState, busy: action.payload.status === BUSY };
    }

    case "UPDATE_DEPRECATED": {
      return { ...state, deprecated: action.payload.deprecated };
    }

    case "UPDATE_PROPOSAL": {
      if (state.busy) return state;

      const { proposal, errors } = action.payload;

      return { ...state, proposal, errors };
    }

    default: {
      return state;
    }
  }
};

/**
 * Section for storage config
 * @component
 *
 * @param {object} props
 * @param {boolean} [props.showErrors=false]
 */
export default function StorageSection({ showErrors = false }) {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const updateStatus = (status) => {
      dispatch({ type: "UPDATE_STATUS", payload: { status } });
    };

    cancellablePromise(client.getStatus()).then(updateStatus);

    return client.onStatusChange(updateStatus);
  }, [client, cancellablePromise]);

  useEffect(() => {
    const updateDeprecated = async (deprecated) => {
      dispatch({ type: "UPDATE_DEPRECATED", payload: { deprecated } });

      if (deprecated) {
        const result = await cancellablePromise(client.proposal.getResult());
        await cancellablePromise(client.probe());
        if (result.settings) await cancellablePromise(client.proposal.calculate(result.settings));
        dispatch({ type: "UPDATE_DEPRECATED", payload: { deprecated: false } });
      }
    };

    cancellablePromise(client.isDeprecated()).then(updateDeprecated);

    return client.onDeprecate(() => updateDeprecated(true));
  }, [client, cancellablePromise]);

  useEffect(() => {
    const updateProposal = async () => {
      const proposal = {
        availableDevices: await cancellablePromise(client.proposal.getAvailableDevices()),
        result: await cancellablePromise(client.proposal.getResult())
      };
      const issues = await cancellablePromise(client.getErrors());
      const errors = issues.map(toValidationError);

      dispatch({ type: "UPDATE_PROPOSAL", payload: { proposal, errors } });
    };

    if (!state.busy && !state.deprecated) updateProposal();
  }, [client, cancellablePromise, state.busy, state.deprecated]);

  useEffect(() => {
    cancellablePromise(client.getProgress()).then(({ message, current, total }) => {
      dispatch({
        type: "UPDATE_PROGRESS",
        payload: { message, current, total }
      });
    });
  }, [client, cancellablePromise]);

  useEffect(() => {
    return client.onProgressChange(({ message, current, total }) => {
      dispatch({
        type: "UPDATE_PROGRESS",
        payload: { message, current, total }
      });
    });
  }, [client, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  const busy = state.busy || !state.proposal;

  const SectionContent = () => {
    if (busy) {
      const { message, current, total } = state.progress;
      return (
        <ProgressText message={message} current={current} total={total} />
      );
    }

    return (
      <ProposalSummary proposal={state.proposal || {}} />
    );
  };

  return (
    <Section
      key="storage-section"
      // TRANSLATORS: page section title
      title={_("Storage")}
      path="/storage"
      icon="hard_drive"
      loading={busy}
      errors={errors}
    >
      <SectionContent />
    </Section>
  );
}
