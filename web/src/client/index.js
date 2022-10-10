/*
 * Copyright (c) [2021] SUSE LLC
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

// @ts-check

import { DBusClient } from "./dbus";
import { LanguageClient } from "./language";
import { ManagerClient } from "./manager";
import { Monitor } from "./monitor";
import { SoftwareClient } from "./software";
import { StorageClient } from "./storage";
import { UsersClient } from "./users";
import phase from "./phase";
import { QuestionsClient } from "./questions";
import { NetworkClient } from "./network";

const SERVICE_NAME = "org.opensuse.DInstaller";

/**
 * Creates a D-Installer client
 */
const createClient = () => {
  const client = new DBusClient(SERVICE_NAME);

  return {
    language: new LanguageClient(client),
    manager: new ManagerClient(client),
    monitor: new Monitor(client, SERVICE_NAME),
    network: new NetworkClient(),
    software: new SoftwareClient(),
    storage: new StorageClient(),
    users: new UsersClient(),
    questions: new QuestionsClient()
  };
};

export { createClient, phase };
