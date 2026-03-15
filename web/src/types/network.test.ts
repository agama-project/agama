/*
 * Copyright (c) [2026] SUSE LLC
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

import { Connection, ConnectionStatus, NetworkConfig, NetworkProposal } from "./network";

describe("NetworkConfig", () => {
  describe("addOrUpdateConnection", () => {
    it("keeps connections with DELETE status in the array", () => {
      const config = new NetworkConfig([new Connection("eth0", { status: ConnectionStatus.UP })]);

      const toDelete = new Connection("eth0", { status: ConnectionStatus.DELETE });
      config.addOrUpdateConnection(toDelete);

      expect(config.connections).toHaveLength(1);
      expect(config.connections[0].status).toBe(ConnectionStatus.DELETE);
    });
  });
});

describe("NetworkProposal", () => {
  describe("addOrUpdateConnection", () => {
    it("keeps connections with DELETE status in the array", () => {
      const proposal = new NetworkProposal([
        new Connection("eth0", { status: ConnectionStatus.UP }),
      ]);

      const toDelete = new Connection("eth0", { status: ConnectionStatus.DELETE });
      proposal.addOrUpdateConnection(toDelete);

      expect(proposal.connections).toHaveLength(1);
      expect(proposal.connections[0].status).toBe(ConnectionStatus.DELETE);
    });
  });
});
