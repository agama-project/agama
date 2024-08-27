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
import DASDTable from "~/components/storage/DASDTable";
import DASDFormatProgress from "~/components/storage/DASDFormatProgress";
import { _ } from "~/i18n";
import { hex, useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { Page } from "~/components/core";
import { useDASDDevices, useDASDDevicesChanges, useDASDFormatJobChanges, useDASDFormatJobs } from "~/queries/dasd";
import { DASDDevice } from "~/types/dasd";

const reducer = (state, action) => {
  const { type, payload } = action;

  switch (type) {
    case "SET_DEVICES": {
      return { ...state, devices: payload.devices };
    }

    case "ADD_DEVICE": {
      const { device } = payload;
      if (state.devices.find((d) => d.id === device.id)) return state;

      return { ...state, devices: [...state.devices, device] };
    }

    case "UPDATE_DEVICE": {
      const { device } = payload;
      const index = state.devices.findIndex((d) => d.id === device.id);
      const devices = [...state.devices];
      index !== -1 ? (devices[index] = device) : devices.push(device);

      const selectedDevicesIds = state.selectedDevices.map((d) => d.id);
      const selectedDevices = devices.filter((d) => selectedDevicesIds.includes(d.id));

      return { ...state, devices, selectedDevices };
    }

    case "REMOVE_DEVICE": {
      const { device } = payload;

      return { ...state, devices: state.devices.filter((d) => d.id !== device.id) };
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

export default function DASDPage() {
  useDASDDevicesChanges();
  const jobs = useDASDFormatJobs().filter((j) => j.running);
  const job = jobs[0];

  const devices: DASDDevice[] = useDASDDevices();

  return (
    <Page>
      <Page.Header>
        <h2>{_("DASD")}</h2>
      </Page.Header>

      <Page.MainContent>
        <DASDTable />
        {job && (
          <DASDFormatProgress job={job} devices={devices} />
        )}
      </Page.MainContent>
    </Page>
  );
}
