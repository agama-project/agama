/*
 * Copyright (c) [2024] SUSE LLC
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

import { get, post } from "~/api/http";

/**
 * Starts the probing process.
 */
const startProbing = () => post("/api/manager/probe");

/**
 * Starts the installation process.
 *
 * The progress of the installation process can be tracked through installer signals.
 */
const startInstallation = () => post("/api/manager/install");

/**
 * Clean-up when installation is done.
 */
const finishInstallation = () => post("/api/manager/finish");

/**
 * Returns the binary content of the YaST logs file.
 */
const fetchLogs = () => get("/api/manager/logs.tar.gz");

export { startProbing, startInstallation, finishInstallation, fetchLogs };
