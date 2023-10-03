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
import { useNavigate } from "react-router-dom";
import { Button } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { MainActions } from "~/components/layout";
import { If, Page } from "~/components/core";
import { DASDFormatProgress, DASDTable } from "~/components/storage";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";

const reducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case "SET_DEVICES": {
      return { ...state, devices: payload.devices };
    }

    case "ADD_DEVICE": {
      const { device } = payload;
      if (state.devices.find(d => d.id === device.id)) return state;

      return { ...state, devices: [...state.devices, device] };
    }

    case "UPDATE_DEVICE": {
      const { device } = payload;
      const index = state.devices.findIndex(d => d.id === device.id);
      const devices = [...state.devices];
      index !== -1 ? devices[index] = device : devices.push(device);

      const selectedDevicesIds = state.selectedDevices.map(d => d.id);
      const selectedDevices = devices.filter(d => selectedDevicesIds.includes(d.id));

      return { ...state, devices, selectedDevices };
    }

    case "REMOVE_DEVICE": {
      const { device } = payload;

      return { ...state, devices: state.devices.filter(d => d.id !== device.id) };
    }

    case "SET_MIN_CHANNEL": {
      return { ...state, minChannel: payload.minChannel, selectedDevices: [] };
    }

    case "SET_MAX_CHANNEL": {
      return { ...state, maxChannel: payload.maxChannel, selectedDevices: [] };
    }

    case "SELECT_DEVICE": {
      const { device } = payload;

      return { ...state, selectedDevices: [...state.selectedDevices, device] };
    }

    case "UNSELECT_DEVICE": {
      const { device } = payload;

      return { ...state, selectedDevices: state.selectedDevices.filter(d => d.id !== device.id) };
    }

    case "SELECT_ALL_DEVICES": {
      return { ...state, selectedDevices: payload.devices };
    }

    case "UNSELECT_ALL_DEVICES": {
      return { ...state, selectedDevices: [] };
    }

    case "START_FORMAT_JOB": {
      const { data: formatJob } = payload;

      if (!formatJob.running) return state;
      const newState = { ...state, formatJob };

      return newState;
    }

    case "UPDATE_FORMAT_JOB": {
      const { data: formatJob } = payload;

      if (formatJob.path !== state.formatJob.path) return state;

      return { ...state, formatJob };
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
  devices: [],
  selectedDevices: [],
  minChannel: "",
  maxChannel: "",
  isLoading: true,
  formatJob: {},
};

export default function DASDPage() {
  const { storage: client } = useInstallerClient();
  const navigate = useNavigate();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const loadDevices = async () => {
      dispatch({ type: "START_LOADING" });
      const devices = await cancellablePromise(client.dasd.getDevices());
      dispatch({ type: "SET_DEVICES", payload: { devices } });
      dispatch({ type: "STOP_LOADING" });
    };

    const loadJobs = async () => {
      const jobs = await cancellablePromise(client.dasd.getJobs());
      if (jobs.length > 0) {
        dispatch({ type: "START_FORMAT_JOB", payload: { data: jobs[0] } });
      }
    };

    loadDevices().catch(console.error);
    loadJobs().catch(console.error);
  }, [client.dasd, cancellablePromise]);

  useEffect(() => {
    const subscriptions = [];

    const subscribe = async () => {
      const action = (type, device) => dispatch({ type, payload: { device } });

      subscriptions.push(
        await client.dasd.deviceEventListener("added", d => action("ADD_DEVICE", d)),
        await client.dasd.deviceEventListener("removed", d => action("REMOVE_DEVICE", d)),
        await client.dasd.deviceEventListener("changed", d => action("UPDATE_DEVICE", d))
      );

      await client.dasd.onJobAdded((data) => dispatch({ type: "START_FORMAT_JOB", payload: { data } }));
      await client.dasd.onJobChanged((data) => dispatch({ type: "UPDATE_FORMAT_JOB", payload: { data } }));
    };

    const unsubscribe = () => {
      subscriptions.forEach(fn => fn());
    };

    subscribe();
    return unsubscribe;
  }, [client.dasd]);

  return (
    // TRANSLATORS: DASD = Direct Access Storage Device, IBM mainframe storage technology
    <Page title={_("Storage DASD")} icon="hard_drive">
      <MainActions>
        <Button size="lg" variant="secondary" onClick={() => navigate("/storage")}>{_("Back")}</Button>
      </MainActions>

      <DASDTable state={state} dispatch={dispatch} />

      <If
        condition={state.formatJob.running}
        then={<DASDFormatProgress job={state.formatJob} devices={state.devices} />}
      />
    </Page>
  );
}
