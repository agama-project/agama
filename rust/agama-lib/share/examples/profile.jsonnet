// This is a Jsonnet file. Please, check https://jsonnet.org/ for more
// information about the language.
// For the schema, see
// https://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/profile.schema.json

// The "hw.libsonnet" file contains hardware information from the "lshw" tool.
// Agama generates this file at runtime by running (with root privileges):
//
//   lshw -json
//
// There are included also helpers to search this hardware tree. To see helpers check
// "/usr/share/agama-cli/agama.libsonnet"
local agama = import 'hw.libsonnet';

// Find the biggest disk which is suitable for installing the system.
local findBiggestDisk(disks) =
  local sizedDisks = std.filter(function(d) std.objectHas(d, 'size'), disks);
  local sorted = std.sort(sizedDisks, function(x) -x.size);
  sorted[0].logicalname;

// Find how much physical memory system has.
local memory = agama.findByID(agama.lshw, 'memory').size;

{
  product: {
    id: if memory < 8000000000 then 'MicroOS' else 'Tumbleweed',
  },
  software: {
    patterns: [
      'gnome',
    ],
  },
  user: {
    fullName: 'Jane Doe',
    userName: 'jane.doe',
    password: '123456',
  },
  root: {
    password: 'nots3cr3t',
    sshPublicKey: '...',
  },
  // look ma, there are comments!
  localization: {
    language: 'en_US.UTF-8',
    keyboard: 'us',
  },
  storage: {
    drives: [
      {
        search: findBiggestDisk(agama.selectByClass(agama.lshw, 'disk')),
        partitions: [
          {
            filesystem: { path: '/' },
            size: { min: '10 GiB' },
          },
          {
            filesystem: { path: 'swap' },
            size: memory * 2,
          },
        ],
      },
    ],
  },
  network: {
    connections: [
      {
        id: 'AgamaNetwork',
        wireless: {
          password: 'agama.test',
          security: 'wpa-psk',
          ssid: 'AgamaNetwork',
          mode: 'infrastructure',
        },
      },
      {
        id: 'Etherned device 1',
        method4: 'manual',
        gateway4: '192.168.122.1',
        addresses: [
          '192.168.122.100/24',
        ],
        nameservers: [
          '1.2.3.4',
        ],
        match: {
          path: ['pci-0000:00:19.0'],
        },
      },
      {
        id: 'bond0',
        bond: {
          ports: ['eth0', 'eth1'],
          mode: 'active-backup',
          options: 'primary=eth1',

        },
      },
    ],
  },
}
