# Network planning

## Different upstream alternatives

### Netplan

- renderer
- python only
- support networkd and NetworkManager (backend agnostic)
- DBUS Api for reading and applying configs

### NMState

- declarative
- based on devices / interfaces no connections
- could support multiple network providers but currently only NM is supported
- rust
- many bindings and a cli
- does not have WiFi Support
- does not have VPN support


## Design / Support use cases

- Installation using different WiFi networks (via the interface or autoinstallation profile)
  - as a user I could provide multiple network and the client will choose the one accesible or with
    strongest signal.

- A DHCP server provides the configuration
  - be able to modiy it

- A DHCP server is not available
  - IPv4 / IPv6 configuration (static)
  - DNS configuration (need to solve repositories)
  - Routes configuration (need to reach some specific network)

- Install through a proxy

- HA configuration
  - Bonding / Bridge / VLAN should be supported
  - NTP configuration is very important in this scenarios
  - very important in HA scenarios (with storage and network redundancy..)

- s390 deployment
  - devices activation (port no and layer 2/3 configuration)

- VPN connection is required
  - support for openVPN / Wireguard / ipSEC ?


NetworkManager supports all the scenarios through the DBUS API.
NMState does not have support for multiple networks / WiFI / VPNS.
Netplan supports rendering and applying the configuration to all the use cases through a YAML
definition.

### Model 

- interfaces:
  - virtual
  - physical -> params
- connection/configuration (settings in NM)
- routing
- dns
- proxy
- wireless networks and/or access points

## Approaches

1. Build a D-Bus interface as part of Agama. Use that interface from the web UI and the CLI. Use
   NMstate to write the changes.
   - Good: consistency (same code path)
   - Bad: complexity and maintenance
   - Idea: minimal D-Bus interface on top of nmstate (basically a translation) extended with
     wireless and udev handling
2. Support nmstate as part of the profile.json. Keep using the NetworkManager from the web UI.
   - Good: we can easily embed the parsing/writing of the nmstate section (it is a just library
     after all)
   - Bad: different code paths for each client
   - Meh: what to do with nmstate unsupported cases? They are supported by NM though.
   - Meh: what to do with udev rules?

## D-Bus API proposal

* `org.opensuse.Agama.Network1`
  * `/org/opensuse/Agama/Network1/Manager`
    - it features methods to add elements
  * `/org/opensuse.Agama/Network1/Interfaces/1`
    - `org.opensuse.Agama.Network1.Interface`
    - `org.opensuse.Agama.Network1.Ethernet`
    - `org.opensuse.Agama.Network1.IPv4`
  * `/org/opensuse.Agama/Network1/Interfaces/2`
    - `org.opensuse.Agama.Network1.Interface`
    - `org.opensuse.Agama.Network1.Wireless`
    - `org.opensuse.Agama.Network1.IPv4`
  * /org/opensuse/Agama/Network1/Interfaces/3
    - `org.opensuse.Agama.Network1.Interface`


## Problems/Questions

* Device names (persistent, etc.). What if I want to reuse the same profile for multiple
  machines with different device names?
* Should we split interaces/connections.
* What about network signals? nispor?
