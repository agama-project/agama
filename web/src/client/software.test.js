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

// @ts-check

import { DBusClient } from "./dbus";
import { SoftwareClient } from "./software";

const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";

const softProxy = {
  wait: jest.fn(),
  AvailableBaseProducts: [
    ["MicroOS", "openSUSE MicroOS", {}],
    ["Tumbleweed", "openSUSE Tumbleweed", {}]
  ],
  SelectedBaseProduct: "MicroOS"
};

const dbusClient = new DBusClient("");
beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    if (iface === SOFTWARE_IFACE) return softProxy;
  });
});

describe("#getProducts", () => {
  it("returns the list of available products", async () => {
    const client = new SoftwareClient(dbusClient);
    const availableProducts = await client.getProducts();
    expect(availableProducts).toEqual([
      { id: "MicroOS", name: "openSUSE MicroOS" },
      { id: "Tumbleweed", name: "openSUSE Tumbleweed" }
    ]);
  });
});

describe('#getSelectedProduct', () => {
  it("returns the selected product", async () => {
    const client = new SoftwareClient(dbusClient);
    const selectedProduct = await client.getSelectedProduct();
    expect(selectedProduct).toEqual(
      { id: "MicroOS", name: "openSUSE MicroOS" }
    );
  });
});
