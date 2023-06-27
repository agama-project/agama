local agama = import 'hw.libsonnet';
local findBiggestDisk(disks) =
  local sizedDisks = std.filter(function(d) std.objectHas(d, 'size'), disks);
  local sorted = std.sort(sizedDisks, function(x) x.size);
  sorted[0].logicalname;

{
  software: {
    product: 'ALP-Bedrock',
  },
  user: {
    fullName: 'Jane Doe',
    userName: 'jane.doe',
    password: '123456',
  },
  root: {
    password: 'nots3cr3t',
    sshKey: '...',
  },
  // look ma, there are comments!
  localization: {
    language: 'en_US',
    keyboard: 'en_US',
  },
  storage: {
    devices: [
      {
        name: findBiggestDisk(agama.disks),
      },
    ],
  },
  network: {
    connections: [
      {
        name: 'AgamaNetwork',
        wireless: {
          password: 'agama.test',
          security: 'wpa-psk',
          ssid: 'AgamaNetwork'
        }
      },
      {
        name: 'Etherned device 1',
        method: 'manual',
        gateway: '192.168.122.1',
        addresses: [
          '192.168.122.100/24,'
        ],
        nameservers: [
          '1.2.3.4'
        ]
      }
    ]
  }
}
