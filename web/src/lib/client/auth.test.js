import AuthClient from "./auth";
import cockpit from "../cockpit";

const cockpitModule = {
  dbus: () => dbusClient,
  variant: cockpit.variant
};

// at this time, it is undefined; but let's be prepared in case it changes
const unmockedFetch = window.fetch;
afterAll(() => {
  window.fetch = unmockedFetch;
});

describe("#authenticate", () => {
  it("resolves to true if the user was successfully authenticated", async () => {
    const client = new AuthClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    client.authorize("linux", "password");
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login", {
      headers: {
        Authorization: "Basic bGludXg6cGFzc3dvcmQ=",
        "X-Superuser": "any"
      }
    });
  });

  it("resolves to false if the user was not authenticated", async () => {
    const client = new AuthClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    expect(client.authorize("linux", "password")).rejects.toBe("Password does not match");
  });
});

describe("#isLoggedIn", () => {
  beforeEach(() => {
    jest.spyOn(window, "fetch");
  });

  it("resolves to true if a user is logged in", async () => {
    const client = new AuthClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() => Promise.resolve({ status: 200 }));
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(true);
    expect(window.fetch).toHaveBeenCalledWith("/cockpit/login");
  });

  it("resolves to false if a user was not logged in", async () => {
    const client = new AuthClient(cockpitModule);
    window.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 401,
        statusText: "Password does not match"
      })
    );
    const logged = await client.isLoggedIn();
    expect(logged).toEqual(false);
  });
});

describe("#currentUser", () => {
  it("returns the user name from cockpit", async () => {
    cockpitModule.user = jest.fn().mockResolvedValue("linux");
    const client = new AuthClient(cockpitModule);
    const username = await client.currentUser();
    expect(username).toEqual("linux");
  });
});


