import SoftwareClient from "./software";

const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";

const dbusClient = {};
const softProxy = {
  wait: jest.fn(),
  AvailableBaseProducts: [
    {
      t: "av",
      v: [
        { t: "s", v: "MicroOS" },
        { t: "s", v: "openSUSE MicroOS" },
        { t: "a{sv}", v: {} }
      ]
    }
  ],
  SelectedBaseProduct: "microos"
};

beforeEach(() => {
  dbusClient.proxy = jest.fn().mockImplementation(iface => {
    if (iface === SOFTWARE_IFACE) return softProxy;
  });
});

describe("#getProducts", () => {
  it("returns the list of available products", async () => {
    const client = new SoftwareClient(dbusClient);
    const availableProducts = await client.getProducts();
    expect(availableProducts).toEqual([{ id: "MicroOS", name: "openSUSE MicroOS" }]);
  });
});

describe("#getSelectedProduct", () => {
  it("returns the ID of the selected product", async () => {
    const client = new SoftwareClient(dbusClient);
    const selected = await client.getSelectedProduct();
    expect(selected).toEqual("microos");
  });
});
