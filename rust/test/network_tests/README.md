# Network scenarios for the ports of bonds and bridges

Scenarios to test how Agama handles the ports of bonds and bridges, from a simple bond to the stacked HA setups, plus the edge cases of moving, dropping and removing ports.

- `old/`: the format that predates the nested ports. Ports are given by name in `ports`, and the port connections, when given, sit at the top level.
- `new/`: the nested format. Ports are given in `portConnections`, as connections or by name.

## Running them

The same scenarios run in two ways, with the same report: every scenario and step, what is expected, and a ✓ or ✗ per check.

### Against the network model

No Agama system needed. Each step is checked against the profile schema and applied to the network model the way `agama config load` does it, and the resulting proposal is compared with the expectations. It takes less than a second and runs with the rest of the tests.

```bash
cd rust
cargo test -p agama-network --test network_scenarios -- --nocapture
NETWORK_SCENARIO=new/07 cargo test -p agama-network --test network_scenarios -- --nocapture
```

### On a live system

`run.sh` loads every step with `agama config load` and compares the network proposal (`/api/proposal`) with the expectations. Run it as root on the Agama live system, or on a machine with access to it.

```bash
./run.sh                          # all the scenarios, old/ first
./run.sh new/07 old/04-ha         # only the scenarios whose path contains any of the texts
ETH0=enp2s0 ETH1=enp3s0 ./run.sh  # use other NICs instead of eth0 and eth1
AGAMA_HOST=https://agama.local ./run.sh  # another server (default: http://localhost)
```

After each step, it saves the responses of the API in the `output/` directory of the scenario, to check them later. That directory is emptied when the scenario runs, and git ignores it:

- `<step>.config.json`, `<step>.extended_config.json`, `<step>.proposal.json` and `<step>.system.json`: the network connections of each endpoint (`SAVE_FULL=1` saves the whole responses).
- `<step>.profile.json`: the profile as it was loaded, with the NICs of `ETH0` / `ETH1`.
- `<step>.load.log`: the output of `agama config load`, and the network error logged by Agama, if any.

`SAVE=0` does not save anything.

It needs `agama`, `curl` and `jq`. Things to keep in mind:

- **Update the schema along with the binaries.** The server reads the profile schema from `/usr/share/agama/schema/profile.schema.json`, so copying a new `agama-web-server` is not enough: copy `rust/share/profile.schema.json` there too (no restart needed). With the old schema, every profile of `new/` is rejected, so `run.sh` checks it before running them.
- **Use spare NICs.** Every scenario runs on a clean system: when the script starts, it records the connections to keep, and deletes any other connection before and after each scenario, and when it exits (Ctrl-C included). The connections to keep are the ones in the system at that point, except the ones on `ETH0` / `ETH1` and the ones named like the connections of the scenarios (left by a previous run), and the script prints them. So do not point `ETH0` / `ETH1` at the NIC you reach the system through. `RESET=0` does not delete anything.
- **A name takes over the connection bound to that interface.** If the system already has a profile for `eth0` (e.g. `Wired connection 1`), a port named `eth0` updates it instead of creating a new one. The report then shows it as `eth0 (Wired connection 1)`.
- **Only schema errors reach the CLI.** `agama config load` checks the profile against the schema and fails right away. The errors found by the network service (`PortAlreadyClaimed`, `DuplicatedConnection`, `ControllerCycle`, `MissingPortId`, `RemovedPort`, `PortSettingsWithoutController`...) are only logged, so `run.sh` looks for "Failed to update the network configuration" in the logs of `agama-web-server`, which needs root and a local server (`AGAMA_HOST` on localhost). The log has the message of the error, not its name. The network keeps its previous state, although `agama config show` already reports the rejected profile.

## Writing a scenario

A scenario is a directory with the profiles of its steps (`1-*.json`, `2-*.json`...), loaded in order on the same system, and a `scenario.json` describing them:

```json
{
  "title": "Drop a port and define it at the top level",
  "description": "What the scenario is about.",
  "steps": [
    {
      "profile": "2-move-eth1-out.json",
      "description": "What the step does",
      "expect": {
        "connections": {
          "eth0": { "controller": "bond0" },
          "eth1": { "controller": null, "mtu": 9000, "method4": "manual" },
          "eth2": { "removed": true }
        }
      }
    }
  ]
}
```

- `connections`: the connections to check after the step, by ID. `controller` is the ID of the controller the connection is nested in (`null` at the top level), and `removed: true` means that the connection is not there. Any other key is compared with the field of the reported connection, `null` meaning that it is not set. Only the given keys are checked.
- `schema: "invalid"`: the schema must reject the profile.
- `error`: the network service must reject the profile with the given error (`NetworkStateError` variant). It is also checked when the schema rejects the profile, as if the schema was skipped.

The scenarios cannot check UUIDs, as the API does not report them. The unit tests of `agama-network` check that a moved port keeps its UUID.

Avoid the default values of NetworkManager in the expectations (e.g. a bridge port priority of 32 or a path cost of 100): NetworkManager does not report them, so they read back as not set on a live system, although the model test passes.

Also keep in mind that an update replaces the IP methods of a connection: a connection given without `method4` / `method6` loses them (see `old/09-omit-ports`).

## Scenarios

### Old format (`old/`)

- `01-bond`: Bond with ports given by name
- `02-bridge`: Bridge with ports given by name
- `03-flat-ports-with-ip-settings`: Ports at the top level with their IP methods disabled
- `04-ha-stack`: HA stack: eth0 + eth1 -> bond0 -> br0 -> br0.100 (VLAN)
- `05-ha-vlan-bridge`: HA with a VLAN bridge: bond0 -> br0, bond0.100 (VLAN) -> br100
- `06-drop-port`: Drop a port from the list
- `07-drop-port-and-define-it-at-the-top-level`: Drop a port and define it at the top level
- `08-move-port-to-another-bond`: Move a port to another bond
- `09-omit-ports`: Update a bridge without its list of ports
- `10-empty-ports`: Empty the list of ports
- `11-remove-controller`: Remove a bond
- `12-port-claimed-twice`: A port listed by two bonds

### New format (`new/`)

- `01-bond-by-name`: Bond with ports given by name
- `02-bond-nested`: Bond with a nested port
- `03-bridge-port-settings`: Bridge port settings
- `04-ha-stack`: HA stack: eth0 + eth1 -> bond0 -> br0 -> br0.100 (VLAN)
- `05-ha-vlan-bridge`: HA with a VLAN bridge: bond0 -> br0, bond0.100 (VLAN) -> br100
- `06-drop-port`: Drop a nested port
- `07-drop-port-and-define-it-at-the-top-level`: Drop a port and define it at the top level
- `08-move-port-to-another-bond`: Move a port to another bond
- `09-move-bond-to-another-bridge`: Move a bond, with its ports, to another bridge
- `10-remove-stack`: Remove a whole stack
- `11-edit-one-port`: Edit one port
- `12-port-alone-at-the-top-level`: Send a port alone at the top level
- `13-switch-from-names-to-nested`: Switch a bond from the old format to the new one
- `14-both-lists`: Both ports and portConnections
- `15-nested-port-with-ip-settings`: A nested port with IP settings
- `16-bridge-port-settings-on-a-bond-port`: Bridge port settings on a bond port
- `17-port-nested-twice`: A port nested in two bonds
- `18-nested-and-at-the-top-level`: A port nested and given at the top level too
- `19-controller-cycle`: A loop of controllers
- `20-port-without-id-nor-interface`: A nested port without an ID nor an interface
- `21-port-named-after-a-removed-connection`: A port named after a connection being removed
- `22-port-settings-on-a-connection-that-is-not-a-port`: Port settings on a connection that is not a port
