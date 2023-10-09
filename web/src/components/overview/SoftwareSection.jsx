/*
 * Copyright (c) [2022] SUSE LLC
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
import { Button } from "@patternfly/react-core";
import { Em, ProgressText, Section } from "~/components/core";
import { Icon } from "~/components/layout";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { BUSY } from "~/client/status";
import { _ } from "~/i18n";

const initialState = {
  busy: true,
  errors: [],
  errorsRead: false,
  size: "",
  progress: { message: _("Reading software repositories"), current: 0, total: 0, finished: false }
};

const reducer = (state, action) => {
  switch (action.type) {
    case "UPDATE_PROGRESS": {
      const { message, current, total, finished } = action.payload;
      return { ...state, progress: { message, current, total, finished } };
    }

    case "UPDATE_STATUS": {
      return { ...initialState, busy: action.payload.status === BUSY };
    }

    case "UPDATE_PROPOSAL": {
      if (state.busy) return state;

      const { errors, size } = action.payload;
      return { ...state, errors, size, errorsRead: true };
    }

    default: {
      return state;
    }
  }
};

export default function SoftwareSection({ showErrors }) {
  const { software: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const updateStatus = (status) => {
    dispatch({ type: "UPDATE_STATUS", payload: { status } });
  };

  const probe = () => client.probe();

  useEffect(() => {
    cancellablePromise(client.getStatus()).then(updateStatus);

    return client.onStatusChange(updateStatus);
  }, [client, cancellablePromise]);

  useEffect(() => {
    cancellablePromise(client.getStatus()).then(updateStatus);
  }, [client, cancellablePromise]);

  useEffect(() => {
    const updateProposal = async () => {
      const errors = await cancellablePromise(client.getIssues());
      const size = await cancellablePromise(client.getUsedSpace());

      dispatch({ type: "UPDATE_PROPOSAL", payload: { errors, size } });
    };

    updateProposal();
  }, [client, cancellablePromise, state.busy]);

  useEffect(() => {
    cancellablePromise(client.getProgress()).then(({ message, current, total, finished }) => {
      dispatch({
        type: "UPDATE_PROGRESS",
        payload: { message, current, total, finished }
      });
    });
  }, [client, cancellablePromise]);

  useEffect(() => {
    return client.onProgressChange(({ message, current, total, finished }) => {
      dispatch({
        type: "UPDATE_PROGRESS",
        payload: { message, current, total, finished }
      });
    });
  }, [client, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  const UsedSize = () => {
    if (state.size === "" || state.size === "0 B") return null;

    // TRANSLATORS: %s will be replaced by the estimated installation size,
    // example: "728.8 MiB"
    const [msg1, msg2] = _("Installation will take %s").split("%s");
    return (
      <>{msg1}<Em>{state.size}</Em>{msg2}</>
    );
  };

  const SectionContent = () => {
    if (state.busy) {
      const { message, current, total } = state.progress;
      return (
        <ProgressText message={message} current={current} total={total} />
      );
    }

    return (
      <>
        <UsedSize />
        {errors.length > 0 &&
          <Button
            isInline
            variant="link"
            icon={<Icon name="refresh" size="16" />}
            onClick={probe}
          >
            {/* TRANSLATORS: clickable link label */}
            {_("Refresh the repositories")}
          </Button>}
      </>
    );
  };

  return (
    <Section
      key="software-section"
      // TRANSLATORS: page section
      title={_("Software")}
      icon="apps"
      loading={state.busy}
      errors={errors.map(e => ({ message: e.description }))}
    >
      <SectionContent />
    </Section>
  );
}
