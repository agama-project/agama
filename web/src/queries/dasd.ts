/*
 * Copyright (c) [2024] SUSE LLC
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

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { _ } from "~/i18n";
import {
    fetchDASDDevices,
} from "~/api/dasd";
import { useInstallerClient } from "~/context/installer";
import React from "react";

/**
 * Returns a query for retrieving the dasd devices
 */
const DASDDevicesQuery = () => ({
    queryKey: ["dasd", "devices"],
    queryFn: fetchDASDDevices,
});

/**
 * Hook that returns DASD devices.
 */
const useDASDDevices = () => {
    const { data: devices } = useSuspenseQuery(DASDDevicesQuery());
    return devices;
};

/**
 * Listens for DASD devices changes.
 */
const useDASDDevicesChanges = () => {
    const client = useInstallerClient();
    const queryClient = useQueryClient();

    React.useEffect(() => {
        if (!client) return;

        return client.ws().onEvent((event) => {
            // TODO: for simplicity we now just invalidate query instead of manually adding, removing or changing devices
            if (
                event.type === "DASDDeviceAdded" ||
                event.type === "DASDDeviceRemoved" ||
                event.type === "DASDDeviceChanged"
            ) {
                queryClient.invalidateQueries({ queryKey: ["dasd", "devices"] });
            }
        });
    });
    const { data: devices } = useSuspenseQuery(DASDDevicesQuery());
    return devices;
};

export { useDASDDevices, useDASDDevicesChanges };