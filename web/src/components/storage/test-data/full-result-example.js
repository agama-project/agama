export const settings = {
  "bootDevice": "/dev/vdc",
  "lvm": false,
  "spacePolicy": "custom",
  "spaceActions": [
    {
      "device": "/dev/vdc3",
      "action": "force_delete"
    },
    {
      "device": "/dev/vdc4",
      "action": "resize"
    },
    {
      "device": "/dev/vdc1",
      "action": "force_delete"
    }
  ],
  "systemVGDevices": [],
  "encryptionPassword": "",
  "encryptionMethod": "luks2",
  "volumes": [
    {
      "mountPath": "/",
      "fsType": "Btrfs",
      "minSize": 18790481920,
      "autoSize": true,
      "snapshots": true,
      "transactional": false,
      "outline": {
        "required": true,
        "fsTypes": [
          "Btrfs",
          "Ext2",
          "Ext3",
          "Ext4",
          "XFS"
        ],
        "supportAutoSize": true,
        "snapshotsConfigurable": true,
        "snapshotsAffectSizes": true,
        "sizeRelevantVolumes": [
          "/home"
        ]
      }
    },
    {
      "mountPath": "swap",
      "fsType": "Swap",
      "minSize": 1610612736,
      "maxSize": 1610612736,
      "autoSize": false,
      "snapshots": false,
      "transactional": false,
      "outline": {
        "required": false,
        "fsTypes": [
          "Swap"
        ],
        "supportAutoSize": false,
        "snapshotsConfigurable": false,
        "snapshotsAffectSizes": false,
        "sizeRelevantVolumes": []
      }
    }
  ],
  "installationDevices": [
    {
      "sid": 70,
      "name": "/dev/vdc",
      "description": "Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 32212254720,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0"
      ],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 78,
            "name": "/dev/vdc1",
            "description": "Part of md0",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 5368709120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part1"
            ],
            "isEFI": false,
            "component": {
              "type": "md_device",
              "deviceNames": [
                "/dev/md0"
              ]
            }
          },
          {
            "sid": 79,
            "name": "/dev/vdc2",
            "description": "Part of md0",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 10487808,
            "size": 5368709120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [
              "openSUSE Leap 15.2",
              "Fedora 10.30"
            ],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part2"
            ],
            "isEFI": false,
            "component": {
              "type": "md_device",
              "deviceNames": [
                "/dev/md0"
              ]
            }
          },
          {
            "sid": 80,
            "name": "/dev/vdc3",
            "description": "XFS Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 20973568,
            "size": 1073741824,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part3"
            ],
            "isEFI": false,
            "filesystem": {
              "sid": 92,
              "type": "xfs"
            }
          },
          {
            "sid": 81,
            "name": "/dev/vdc4",
            "description": "Linux",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 23070720,
            "size": 2147483648,
            "shrinking": { "supported": 2147483136 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part4"
            ],
            "isEFI": false
          }
        ],
        "unpartitionedSize": 18253611008,
        "unusedSlots": [
          {
            "start": 27265024,
            "size": 18252545536
          }
        ]
      }
    }
  ]
};

export const devices = {
  "system": [
    {
      "sid": 71,
      "name": "/dev/vda",
      "description": "Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 53687091200,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0"
      ],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 83,
            "name": "/dev/vda1",
            "description": "BIOS Boot Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 8388608,
            "shrinking": { "supported": 8388096 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:04:00.0-part1"
            ],
            "isEFI": false
          },
          {
            "sid": 84,
            "name": "/dev/vda2",
            "description": "PV of system",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 18432,
            "size": 53677637120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:04:00.0-part2"
            ],
            "isEFI": false,
            "component": {
              "type": "physical_volume",
              "deviceNames": [
                "/dev/system"
              ]
            }
          }
        ],
        "unpartitionedSize": 1065472,
        "unusedSlots": []
      }
    },
    {
      "sid": 69,
      "name": "/dev/vdb",
      "description": "Ext4 Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 5368709120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:08:00.0"
      ],
      "filesystem": {
        "sid": 87,
        "type": "ext4"
      }
    },
    {
      "sid": 70,
      "name": "/dev/vdc",
      "description": "Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 32212254720,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0"
      ],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 78,
            "name": "/dev/vdc1",
            "description": "Part of md0",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 5368709120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part1"
            ],
            "isEFI": false,
            "component": {
              "type": "md_device",
              "deviceNames": [
                "/dev/md0"
              ]
            }
          },
          {
            "sid": 79,
            "name": "/dev/vdc2",
            "description": "Part of md0",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 10487808,
            "size": 5368709120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [
              "openSUSE Leap 15.2",
              "Fedora 10.30"
            ],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part2"
            ],
            "isEFI": false,
            "component": {
              "type": "md_device",
              "deviceNames": [
                "/dev/md0"
              ]
            }
          },
          {
            "sid": 80,
            "name": "/dev/vdc3",
            "description": "XFS Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 20973568,
            "size": 1073741824,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part3"
            ],
            "isEFI": false,
            "filesystem": {
              "sid": 92,
              "type": "xfs"
            }
          },
          {
            "sid": 81,
            "name": "/dev/vdc4",
            "description": "Linux",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 23070720,
            "size": 2147483648,
            "shrinking": { "supported": 2147483136 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part4"
            ],
            "isEFI": false
          }
        ],
        "unpartitionedSize": 18253611008,
        "unusedSlots": [
          {
            "start": 27265024,
            "size": 18252545536
          }
        ]
      }
    },
    {
      "sid": 72,
      "name": "/dev/md0",
      "description": "Disk",
      "isDrive": false,
      "type": "md",
      "level": "raid0",
      "uuid": "644aeee1:5f5b946a:4da99758:3f85b3ea",
      "devices": [
        {
          "sid": 78,
          "name": "/dev/vdc1",
          "description": "Part of md0",
          "isDrive": false,
          "type": "partition",
          "active": true,
          "encrypted": false,
          "start": 2048,
          "size": 5368709120,
          "shrinking": { "unsupported": ["Resizing is not supported"] },
          "systems": [],
          "udevIds": [],
          "udevPaths": [
            "pci-0000:09:00.0-part1"
          ],
          "isEFI": false,
          "component": {
            "type": "md_device",
            "deviceNames": [
              "/dev/md0"
            ]
          }
        },
        {
          "sid": 79,
          "name": "/dev/vdc2",
          "description": "Part of md0",
          "isDrive": false,
          "type": "partition",
          "active": true,
          "encrypted": false,
          "start": 10487808,
          "size": 5368709120,
          "shrinking": { "unsupported": ["Resizing is not supported"] },
          "systems": [
            "openSUSE Leap 15.2",
            "Fedora 10.30"
          ],
          "udevIds": [],
          "udevPaths": [
            "pci-0000:09:00.0-part2"
          ],
          "isEFI": false,
          "component": {
            "type": "md_device",
            "deviceNames": [
              "/dev/md0"
            ]
          }
        }
      ],
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 10737287168,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [
        "md-uuid-644aeee1:5f5b946a:4da99758:3f85b3ea"
      ],
      "udevPaths": [],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 86,
            "name": "/dev/md0p1",
            "description": "Ext4 Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 2147483648,
            "shrinking": { "supported": 2040147968 },
            "systems": [],
            "udevIds": [
              "md-uuid-644aeee1:5f5b946a:4da99758:3f85b3ea-part1"
            ],
            "udevPaths": [],
            "isEFI": false,
            "filesystem": {
              "sid": 93,
              "type": "ext4"
            }
          }
        ],
        "unpartitionedSize": 8589803520,
        "unusedSlots": [
          {
            "start": 4196352,
            "size": 8588738048
          }
        ]
      }
    },
    {
      "sid": 73,
      "name": "/dev/system",
      "description": "LVM",
      "isDrive": false,
      "type": "lvmVg",
      "size": 53674508288,
      "physicalVolumes": [
        {
          "sid": 84,
          "name": "/dev/vda2",
          "description": "PV of system",
          "isDrive": false,
          "type": "partition",
          "active": true,
          "encrypted": false,
          "start": 18432,
          "size": 53677637120,
          "shrinking": { "unsupported": ["Resizing is not supported"] },
          "systems": [],
          "udevIds": [],
          "udevPaths": [
            "pci-0000:04:00.0-part2"
          ],
          "isEFI": false,
          "component": {
            "type": "physical_volume",
            "deviceNames": [
              "/dev/system"
            ]
          }
        }
      ],
      "logicalVolumes": [
        {
          "sid": 75,
          "name": "/dev/system/root",
          "description": "Ext4 LV",
          "isDrive": false,
          "type": "lvmLv",
          "active": true,
          "encrypted": false,
          "start": 0,
          "size": 51527024640,
          "shrinking": { "supported": 30647779328 },
          "systems": [],
          "udevIds": [],
          "udevPaths": [],
          "filesystem": {
            "sid": 88,
            "type": "ext4",
            "mountPath": "/"
          }
        },
        {
          "sid": 76,
          "name": "/dev/system/swap",
          "description": "Swap LV",
          "isDrive": false,
          "type": "lvmLv",
          "active": true,
          "encrypted": false,
          "start": 0,
          "size": 2147483648,
          "shrinking": { "supported": 2143289344 },
          "systems": [],
          "udevIds": [],
          "udevPaths": [],
          "filesystem": {
            "sid": 90,
            "type": "swap",
            "mountPath": "swap"
          }
        }
      ]
    },
    {
      "sid": 75,
      "name": "/dev/system/root",
      "description": "Ext4 LV",
      "isDrive": false,
      "type": "lvmLv",
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 51527024640,
      "shrinking": { "supported": 30647779328 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [],
      "filesystem": {
        "sid": 88,
        "type": "ext4",
        "mountPath": "/"
      }
    },
    {
      "sid": 76,
      "name": "/dev/system/swap",
      "description": "Swap LV",
      "isDrive": false,
      "type": "lvmLv",
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 2147483648,
      "shrinking": { "supported": 2143289344 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [],
      "filesystem": {
        "sid": 90,
        "type": "swap",
        "mountPath": "swap"
      }
    },
    {
      "sid": 83,
      "name": "/dev/vda1",
      "description": "BIOS Boot Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 2048,
      "size": 8388608,
      "shrinking": { "supported": 8388096 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0-part1"
      ],
      "isEFI": false
    },
    {
      "sid": 84,
      "name": "/dev/vda2",
      "description": "PV of system",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 18432,
      "size": 53677637120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0-part2"
      ],
      "isEFI": false,
      "component": {
        "type": "physical_volume",
        "deviceNames": [
          "/dev/system"
        ]
      }
    },
    {
      "sid": 78,
      "name": "/dev/vdc1",
      "description": "Part of md0",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 2048,
      "size": 5368709120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part1"
      ],
      "isEFI": false,
      "component": {
        "type": "md_device",
        "deviceNames": [
          "/dev/md0"
        ]
      }
    },
    {
      "sid": 79,
      "name": "/dev/vdc2",
      "description": "Part of md0",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 10487808,
      "size": 5368709120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [
        "openSUSE Leap 15.2",
        "Fedora 10.30"
      ],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part2"
      ],
      "isEFI": false,
      "component": {
        "type": "md_device",
        "deviceNames": [
          "/dev/md0"
        ]
      }
    },
    {
      "sid": 80,
      "name": "/dev/vdc3",
      "description": "XFS Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 20973568,
      "size": 1073741824,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part3"
      ],
      "isEFI": false,
      "filesystem": {
        "sid": 92,
        "type": "xfs"
      }
    },
    {
      "sid": 81,
      "name": "/dev/vdc4",
      "description": "Linux",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 23070720,
      "size": 2147483648,
      "shrinking": { "supported": 2147483136 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part4"
      ],
      "isEFI": false
    },
    {
      "sid": 86,
      "name": "/dev/md0p1",
      "description": "Ext4 Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 2048,
      "size": 2147483648,
      "shrinking": { "supported": 2040147968 },
      "systems": [],
      "udevIds": [
        "md-uuid-644aeee1:5f5b946a:4da99758:3f85b3ea-part1"
      ],
      "udevPaths": [],
      "isEFI": false,
      "filesystem": {
        "sid": 93,
        "type": "ext4"
      }
    }
  ],
  "staging": [
    {
      "sid": 71,
      "name": "/dev/vda",
      "description": "Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 53687091200,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0"
      ],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 83,
            "name": "/dev/vda1",
            "description": "BIOS Boot Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 8388608,
            "shrinking": { "supported": 8388096 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:04:00.0-part1"
            ],
            "isEFI": false
          },
          {
            "sid": 84,
            "name": "/dev/vda2",
            "description": "PV of system",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 18432,
            "size": 53677637120,
            "shrinking": { "unsupported": ["Resizing is not supported"] },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:04:00.0-part2"
            ],
            "isEFI": false,
            "component": {
              "type": "physical_volume",
              "deviceNames": [
                "/dev/system"
              ]
            }
          }
        ],
        "unpartitionedSize": 1065472,
        "unusedSlots": []
      }
    },
    {
      "sid": 69,
      "name": "/dev/vdb",
      "description": "Ext4 Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 5368709120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:08:00.0"
      ],
      "filesystem": {
        "sid": 87,
        "type": "ext4"
      }
    },
    {
      "sid": 70,
      "name": "/dev/vdc",
      "description": "Disk",
      "isDrive": true,
      "type": "disk",
      "vendor": "",
      "model": "Disk",
      "driver": [
        "virtio-pci",
        "virtio_blk"
      ],
      "bus": "None",
      "busId": "",
      "transport": "unknown",
      "sdCard": false,
      "dellBOSS": false,
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 32212254720,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0"
      ],
      "partitionTable": {
        "type": "gpt",
        "partitions": [
          {
            "sid": 79,
            "name": "/dev/vdc2",
            "description": "Linux RAID",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 10487808,
            "size": 5368709120,
            "shrinking": { "supported": 5368708608 },
            "systems": [
              "openSUSE Leap 15.2",
              "Fedora 10.30"
            ],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part2"
            ],
            "isEFI": false
          },
          {
            "sid": 81,
            "name": "/dev/vdc4",
            "description": "Linux",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 23070720,
            "size": 1608515584,
            "shrinking": { "supported": 1608515072 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part4"
            ],
            "isEFI": false
          },
          {
            "sid": 459,
            "name": "/dev/vdc1",
            "description": "BIOS Boot Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 2048,
            "size": 8388608,
            "shrinking": { "supported": 8388096 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part1"
            ],
            "isEFI": false
          },
          {
            "sid": 460,
            "name": "/dev/vdc3",
            "description": "Swap Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 18432,
            "size": 1610612736,
            "shrinking": { "supported": 1610571776 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part3"
            ],
            "isEFI": false,
            "filesystem": {
              "sid": 461,
              "type": "swap",
              "mountPath": "swap"
            }
          },
          {
            "sid": 463,
            "name": "/dev/vdc5",
            "description": "Btrfs Partition",
            "isDrive": false,
            "type": "partition",
            "active": true,
            "encrypted": false,
            "start": 26212352,
            "size": 18791513600,
            "shrinking": { "supported": 18523078144 },
            "systems": [],
            "udevIds": [],
            "udevPaths": [
              "pci-0000:09:00.0-part5"
            ],
            "isEFI": false,
            "filesystem": {
              "sid": 464,
              "type": "btrfs",
              "mountPath": "/"
            }
          }
        ],
        "unpartitionedSize": 4824515072,
        "unusedSlots": [
          {
            "start": 3164160,
            "size": 3749707776
          },
          {
            "start": 20973568,
            "size": 1073741824
          }
        ]
      }
    },
    {
      "sid": 73,
      "name": "/dev/system",
      "description": "LVM",
      "isDrive": false,
      "type": "lvmVg",
      "size": 53674508288,
      "physicalVolumes": [
        {
          "sid": 84,
          "name": "/dev/vda2",
          "description": "PV of system",
          "isDrive": false,
          "type": "partition",
          "active": true,
          "encrypted": false,
          "start": 18432,
          "size": 53677637120,
          "shrinking": { "unsupported": ["Resizing is not supported"] },
          "systems": [],
          "udevIds": [],
          "udevPaths": [
            "pci-0000:04:00.0-part2"
          ],
          "isEFI": false,
          "component": {
            "type": "physical_volume",
            "deviceNames": [
              "/dev/system"
            ]
          }
        }
      ],
      "logicalVolumes": [
        {
          "sid": 75,
          "name": "/dev/system/root",
          "description": "Ext4 LV",
          "isDrive": false,
          "type": "lvmLv",
          "active": true,
          "encrypted": false,
          "start": 0,
          "size": 51527024640,
          "shrinking": { "supported": 30647779328 },
          "systems": [],
          "udevIds": [],
          "udevPaths": [],
          "filesystem": {
            "sid": 88,
            "type": "ext4",
            "mountPath": "/"
          }
        },
        {
          "sid": 76,
          "name": "/dev/system/swap",
          "description": "Swap LV",
          "isDrive": false,
          "type": "lvmLv",
          "active": true,
          "encrypted": false,
          "start": 0,
          "size": 2147483648,
          "shrinking": { "supported": 2143289344 },
          "systems": [],
          "udevIds": [],
          "udevPaths": [],
          "filesystem": {
            "sid": 90,
            "type": "swap",
            "mountPath": "swap"
          }
        }
      ]
    },
    {
      "sid": 75,
      "name": "/dev/system/root",
      "description": "Ext4 LV",
      "isDrive": false,
      "type": "lvmLv",
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 51527024640,
      "shrinking": { "supported": 30647779328 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [],
      "filesystem": {
        "sid": 88,
        "type": "ext4",
        "mountPath": "/"
      }
    },
    {
      "sid": 76,
      "name": "/dev/system/swap",
      "description": "Swap LV",
      "isDrive": false,
      "type": "lvmLv",
      "active": true,
      "encrypted": false,
      "start": 0,
      "size": 2147483648,
      "shrinking": { "supported": 2143289344 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [],
      "filesystem": {
        "sid": 90,
        "type": "swap",
        "mountPath": "swap"
      }
    },
    {
      "sid": 83,
      "name": "/dev/vda1",
      "description": "BIOS Boot Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 2048,
      "size": 8388608,
      "shrinking": { "supported": 8388096 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0-part1"
      ],
      "isEFI": false
    },
    {
      "sid": 84,
      "name": "/dev/vda2",
      "description": "PV of system",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 18432,
      "size": 53677637120,
      "shrinking": { "unsupported": ["Resizing is not supported"] },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:04:00.0-part2"
      ],
      "isEFI": false,
      "component": {
        "type": "physical_volume",
        "deviceNames": [
          "/dev/system"
        ]
      }
    },
    {
      "sid": 79,
      "name": "/dev/vdc2",
      "description": "Linux RAID",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 10487808,
      "size": 5368709120,
      "shrinking": { "supported": 5368708608 },
      "systems": [
        "openSUSE Leap 15.2",
        "Fedora 10.30"
      ],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part2"
      ],
      "isEFI": false
    },
    {
      "sid": 81,
      "name": "/dev/vdc4",
      "description": "Linux",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 23070720,
      "size": 1608515584,
      "shrinking": { "supported": 1608515072 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part4"
      ],
      "isEFI": false
    },
    {
      "sid": 459,
      "name": "/dev/vdc1",
      "description": "BIOS Boot Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 2048,
      "size": 8388608,
      "shrinking": { "supported": 8388096 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part1"
      ],
      "isEFI": false
    },
    {
      "sid": 460,
      "name": "/dev/vdc3",
      "description": "Swap Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 18432,
      "size": 1610612736,
      "shrinking": { "supported": 1610571776 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part3"
      ],
      "isEFI": false,
      "filesystem": {
        "sid": 461,
        "type": "swap",
        "mountPath": "swap"
      }
    },
    {
      "sid": 463,
      "name": "/dev/vdc5",
      "description": "Btrfs Partition",
      "isDrive": false,
      "type": "partition",
      "active": true,
      "encrypted": false,
      "start": 26212352,
      "size": 18791513600,
      "shrinking": { "supported": 18523078144 },
      "systems": [],
      "udevIds": [],
      "udevPaths": [
        "pci-0000:09:00.0-part5"
      ],
      "isEFI": false,
      "filesystem": {
        "sid": 464,
        "type": "btrfs",
        "mountPath": "/"
      }
    }
  ]
};

export const actions = [
  {
    "device": 86,
    "text": "Delete partition /dev/md0p1 (2.00 GiB)",
    "subvol": false,
    "delete": true
  },
  {
    "device": 72,
    "text": "Delete RAID0 /dev/md0 (10.00 GiB)",
    "subvol": false,
    "delete": true
  },
  {
    "device": 80,
    "text": "Delete partition /dev/vdc3 (1.00 GiB)",
    "subvol": false,
    "delete": true
  },
  {
    "device": 78,
    "text": "Delete partition /dev/vdc1 (5.00 GiB)",
    "subvol": false,
    "delete": true
  },
  {
    "device": 81,
    "text": "Shrink partition /dev/vdc4 from 2.00 GiB to 1.50 GiB",
    "subvol": false,
    "delete": false
  },
  {
    "device": 459,
    "text": "Create partition /dev/vdc1 (8.00 MiB) as BIOS Boot Partition",
    "subvol": false,
    "delete": false
  },
  {
    "device": 460,
    "text": "Create partition /dev/vdc3 (1.50 GiB) for swap",
    "subvol": false,
    "delete": false
  },
  {
    "device": 463,
    "text": "Create partition /dev/vdc5 (17.50 GiB) for / with btrfs",
    "subvol": false,
    "delete": false
  },
  {
    "device": 467,
    "text": "Create subvolume @ on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 482,
    "text": "Create subvolume @/boot/grub2/x86_64-efi on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 480,
    "text": "Create subvolume @/boot/grub2/i386-pc on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 478,
    "text": "Create subvolume @/var on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 476,
    "text": "Create subvolume @/usr/local on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 474,
    "text": "Create subvolume @/srv on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 472,
    "text": "Create subvolume @/root on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 470,
    "text": "Create subvolume @/opt on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  },
  {
    "device": 468,
    "text": "Create subvolume @/home on /dev/vdc5 (17.50 GiB)",
    "subvol": true,
    "delete": false
  }
];
