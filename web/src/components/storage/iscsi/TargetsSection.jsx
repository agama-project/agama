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

import React, { useEffect, useReducer } from "react";
import {
  Button,
  Toolbar, ToolbarItem, ToolbarContent,
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Section, SectionSkeleton } from "~/components/core";
import { NodesPresenter, DiscoverForm } from "~/components/storage/iscsi";
import { useInstallerClient } from "~/context/installer";
import { useCancellablePromise } from "~/utils";

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_NODES": {
      return { ...state, nodes: action.payload.nodes };
    }

    case "ADD_NODE": {
      if (state.nodes.find(n => n.id === action.payload.node.id)) return state;

      const nodes = [...state.nodes];
      nodes.push(action.payload.node);
      return { ...state, nodes };
    }

    case "UPDATE_NODE": {
      const index = state.nodes.findIndex(n => n.id === action.payload.node.id);
      if (index === -1) return state;

      const nodes = [...state.nodes];
      nodes[index] = action.payload.node;
      return { ...state, nodes };
    }

    case "REMOVE_NODE": {
      const nodes = state.nodes.filter(n => n.id !== action.payload.node.id);
      return { ...state, nodes };
    }

    case "OPEN_DISCOVER_FORM": {
      return { ...state, isDiscoverFormOpen: true };
    }

    case "CLOSE_DISCOVER_FORM": {
      return { ...state, isDiscoverFormOpen: false };
    }

    case "START_LOADING": {
      return { ...state, isLoading: true };
    }

    case "STOP_LOADING": {
      return { ...state, isLoading: false };
    }

    default: {
      return state;
    }
  }
};

const initialState = {
  nodes: [],
  isDiscoverFormOpen: false,
  isLoading: true
};

export default function TargetsSection() {
  const { storage: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const loadNodes = async () => {
      dispatch({ type: "START_LOADING" });
      const nodes = await cancellablePromise(client.iscsi.getNodes());
      dispatch({ type: "SET_NODES", payload: { nodes } });
      dispatch({ type: "STOP_LOADING" });
    };

    loadNodes().catch(console.error);
  }, [cancellablePromise, client.iscsi]);

  useEffect(() => {
    const action = (type, node) => dispatch({ type, payload: { node } });

    client.iscsi.onNodeAdded(n => action("ADD_NODE", n));
    client.iscsi.onNodeChanged(n => action("UPDATE_NODE", n));
    client.iscsi.onNodeRemoved(n => action("REMOVE_NODE", n));
  }, [client.iscsi]);

  const openDiscoverForm = () => {
    dispatch({ type: "OPEN_DISCOVER_FORM" });
  };

  const closeDiscoverForm = () => {
    dispatch({ type: "CLOSE_DISCOVER_FORM" });
  };

  const submitDiscoverForm = async (data) => {
    const { username, password, reverseUsername, reversePassword } = data;
    const result = await client.iscsi.discover(data.address, parseInt(data.port), {
      username, password, reverseUsername, reversePassword
    });

    if (result === 0) closeDiscoverForm();

    return result;
  };

  const SectionContent = () => {
    if (state.isLoading) return <SectionSkeleton />;

    if (state.nodes.length === 0) {
      return (
        <div className="stack">
          <div className="bold">{_("No iSCSI targets found")}</div>
          <div>{_("Please, perform an iSCSI discovery in order to find available iSCSI targets.")}</div>
          {/* TRANSLATORS: button label, starts iSCSI discovery */}
          <Button variant="primary" onClick={openDiscoverForm}>{_("Discover iSCSI targets")}</Button>
        </div>
      );
    }

    return (
      <>
        <Toolbar className="no-stack-gutter">
          <ToolbarContent>
            <ToolbarItem align={{ default: "alignRight" }}>
              {/* TRANSLATORS: button label, starts iSCSI discovery */}
              <Button onClick={openDiscoverForm}>{_("Discover")}</Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>
        <NodesPresenter
          nodes={state.nodes}
          client={client}
        />
      </>
    );
  };

  return (
    // TRANSLATORS: iSCSI targets section title
    <Section title={_("Targets")}>
      <SectionContent />
      { state.isDiscoverFormOpen &&
        <DiscoverForm
          onSubmit={submitDiscoverForm}
          onCancel={closeDiscoverForm}
        /> }
    </Section>
  );
}
