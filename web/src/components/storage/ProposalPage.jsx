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
import { useNavigate } from "react-router-dom";

import {
  Alert,
  Button,
  Flex,
  FlexItem,
  Text,
  TextVariants
} from "@patternfly/react-core";

import { InfoCircleIcon } from '@patternfly/react-icons';

import { EOS_VOLUME as Icon } from "eos-icons-react";

import { useInstallerClient } from "@context/installer";
import { useCancellablePromise } from "@/utils";
import { Title, PageIcon, MainActions } from "@components/layout";
import { InstallerSkeleton } from "@components/core";
import {
  ProposalTargetSection,
  ProposalSettingsSection,
  ProposalActionsSection
} from "@components/storage";

const initialState = {
  busy: false,
  proposal: undefined,
  errors: []
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_BUSY" : {
      return { ...state, busy: true };
    }

    case "LOAD": {
      const { proposal, errors } = action.payload;
      return { ...state, proposal, errors, busy: false };
    }

    case "CALCULATE": {
      return initialState;
    }

    default: {
      return state;
    }
  }
};

export default function ProposalPage() {
  const client = useInstallerClient();
  const navigate = useNavigate();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const loadProposal = async () => {
      dispatch({ type: "SET_BUSY" });

      const proposal = await cancellablePromise(client.storage.getProposal());
      const errors = await client.storage.getValidationErrors();

      dispatch({
        type: "LOAD",
        payload: { proposal, errors }
      });
    };

    if (!state.proposal) loadProposal().catch(console.error);
  }, [client.storage, cancellablePromise, state.proposal]);

  const calculateProposal = async (settings) => {
    dispatch({ type: "SET_BUSY" });
    await client.storage.calculateProposal({ ...state.proposal, ...settings });
    dispatch({ type: "CALCULATE" });
  };

  const content = () => {
    if (state.busy) return <InstallerSkeleton lines={3} />;

    if (!state.proposal) return (
      <Text component={TextVariants.h5}>
        No proposal yet
      </Text>
    );

    const categories = [
      <ProposalTargetSection key="target" proposal={state.proposal} calculateProposal={calculateProposal} />,
      <ProposalSettingsSection key="settings" proposal={state.proposal} calculateProposal={calculateProposal} />,
      <ProposalActionsSection key="actions" proposal={state.proposal} errors={state.errors} />,
    ];

    return (
      <Flex direction={{ default: "column" }}>
        <FlexItem>
          <Alert isInline customIcon={<InfoCircleIcon />} title="Devices will not be modified until installation starts." />
        </FlexItem>
        {categories.map((category, i) => (
          <FlexItem key={i} className="installation-overview-section">
            {category}
          </FlexItem>))}
      </Flex>
    );
  };

  return (
    <>
      <Title>Storage</Title>
      <PageIcon><Icon /></PageIcon>
      <MainActions>
        <Button isLarge variant="primary" form="storage-config" onClick={() => navigate("/")}>
          Accept
        </Button>
      </MainActions>

      {content()}
    </>
  );
}
