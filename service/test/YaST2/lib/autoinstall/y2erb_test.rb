# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require_relative "../../../test_helper"

require "tempfile"
require "autoinstall/y2erb"

# reduced probe agent output
# rubocop:disable Metrics/MethodLength
def hardware_mock_data
  {
    "disk"    => [{
      "bios_id"           => "0x80",
      "bus"               => "PCI",
      "bus_hwcfg"         => "pci",
      "class_id"          => 262,
      "detail"            => { "channel" => 0, "host" => 0, "id" => 0, "lun" => 0 },
      "dev_name"          => "/dev/nvme0n1",
      "dev_names"         => ["/dev/nvme0n1"],
      "dev_num"           => { "major" => 259, "minor" => 0, "range" => 0, "type" => "b" },
      "device_id"         => 87056,
      "driver"            => "nvme",
      "driver_module"     => "nvme",
      "model"             => "Micron Disk",
      "old_unique_key"    => "m6To.U1c9LpxaqD7",
      "parent_unique_key" => "svHJ.xTzyOFkYIiA",
      "resource"          => {
        "disk_log_geo" => [{ "cylinders" => 488386, "heads" => 64, "sectors" => 32 }],
        "size"         => [{ "unit" => "sectors", "x" => 1000215216, "y" => 512 }]
      },
      "sub_class_id"      => 0,
      "sub_device_id"     => 65792,
      "sub_vendor"        => "Micron Technology Inc",
      "sub_vendor_id"     => 70468,
      "sysfs_bus_id"      => "nvme0",
      "sysfs_id"          => "/class/block/nvme0n1",
      "unique_key"        => "wLCS.U1c9LpxaqD7",
      "vendor"            => "Micron Technology Inc",
      "vendor_id"         => 70468
    }],
    "netcard" => [
      {
        "bus"               => "PCI",
        "bus_hwcfg"         => "pci",
        "bus_id"            => 2,
        "class_id"          => 2,
        "dev_name"          => "enp2s0",
        "dev_names"         => ["enp2s0"],
        "device"            => "RTL8111/8168/8411 PCI Express Gigabit Ethernet Controller",
        "device_id"         => 98664,
        "driver"            => "r8169",
        "driver_module"     => "r8169",
        "drivers"           => [{ "active" => true, "modprobe" => true,
        "modules" => [["r8169", ""]] }],
        "modalias"          => "pci:v000010ECd00008168sv00001043sd0000208Fbc02sc00i00",
        "model"             =>
                               "Realtek RTL8111/8168/8411 PCI Express Gigabit Ethernet Controller",
        "old_unique_key"    => "bbxe.g1yJ3amPfwB",
        "parent_unique_key" => "e6j0.CB0G3oMQsS4",
        "resource"          => {
          "hwaddr"  => [{ "addr"=>"a8:5e:45:c1:2f:eb" }],
          "io"      => [{ "active" => true, "length" => 256,
                                                            "mode" => "rw", "start" => 57344 }],
          "irq"     => [{ "count" => 0, "enabled" => true,
                                                            "irq" => 71 }],
          "link"    => [{ "state"=>false }],
          "mem"     =>
                       [{ "active" => true, "length" => 4096,
                        "start" => 4152377344 },
                        { "active" => true, "length" => 16384,
                        "start" => 4152360960 }],
          "phwaddr" => [{ "addr"=>"a8:5e:45:c1:2f:eb" }]
        },
        "rev"               => "21",
        "sub_class_id"      => 0,
        "sub_device_id"     => 73871,
        "sub_vendor"        => "ASUSTeK Computer Inc.",
        "sub_vendor_id"     => 69699,
        "sysfs_bus_id"      => "0000:02:00.0",
        "sysfs_id"          => "/devices/pci0000:00/0000:00:01.2/0000:02:00.0",
        "unique_key"        => "c3qJ.g1yJ3amPfwB",
        "vendor"            => "Realtek Semiconductor Co., Ltd.",
        "vendor_id"         => 69868
      },
      {
        "bus"               => "PCI",
        "bus_hwcfg"         => "pci",
        "bus_id"            => 4,
        "class_id"          => 2,
        "device"            => "RTL8821CE 802.11ac PCIe Wireless Network Adapter",
        "device_id"         => 116769,
        "modalias"          => "pci:v000010ECd0000C821sv00001A3Bsd00003041bc02sc80i00",
        "model"             => "Realtek RTL8821CE 802.11ac PCIe Wireless Network Adapter",
        "old_unique_key"    => "aher.1HJgn3FRa50",
        "parent_unique_key" => "yk9C.CB0G3oMQsS4",
        "resource"          =>
                               { "io"  =>
                                          [{ "active" => false, "length" => 256, "mode" => "rw",
                                                             "start" => 53248 }],
                                 "irq" =>
                                          [{ "count" => 0, "enabled" => true, "irq" => 255 }],
                                 "mem" =>
                                          [{ "active" => false, "length" => 65536,
                                                             "start" => 4150263808 }] },
        "sub_class_id"      => 128,
        "sub_device_id"     => 77889,
        "sub_vendor"        => "AzureWave",
        "sub_vendor_id"     => 72251,
        "sysfs_bus_id"      => "0000:04:00.0",
        "sysfs_id"          => "/devices/pci0000:00/0000:00:01.7/0000:04:00.0",
        "unique_key"        => "YmUS.1HJgn3FRa50",
        "vendor"            => "Realtek Semiconductor Co., Ltd.",
        "vendor_id"         => 69868
      },
      {
        "bus"               => "USB",
        "bus_hwcfg"         => "usb",
        "class_id"          => 2,
        "dev_name"          => "wlp5s0f4u2",
        "dev_names"         => ["wlp5s0f4u2"],
        "device"            => "RTL8188EUS 802.11n Wireless Network Adapter",
        "device_id"         => 229753,
        "driver"            => "r8188eu",
        "driver_module"     => "r8188eu",
        "drivers"           =>
                               [{ "active" => true, "modprobe" => true,
                                             "modules" => [["r8188eu", ""]] }],
        "hotplug"           => "usb",
        "modalias"          => "usb:v0BDAp8179d0000dc00dsc00dp00icFFiscFFipFFin00",
        "model"             => "Realtek RTL8188EUS 802.11n Wireless Network Adapter",
        "old_unique_key"    => "mEws.W2OkjY9u_45",
        "parent_unique_key" => "uIhY.Md0RKo+2xQF",
        "resource"          =>
                               { "baud"    => [{ "speed"=>480000000 }],
                                 "hwaddr"  => [{ "addr"=>"50:3e:aa:d7:45:9f" }],
                                 "link"    => [{ "state"=>true }],
                                 "phwaddr" => [{ "addr"=>"50:3e:aa:d7:45:9f" }],
                                 "wlan"    =>
                                              [{ "auth_modes"  => [
                                                   "open", "wpa-psk", "wpa-eap"
                                                 ],
                                                 "bitrates"    => [
                                                   "1", "2", "5.5", "11"
                                                 ],
                                                 "channels"    => [
                                                   "1", "2", "3", "4", "5", "6", "7",
                                                   "8", "9", "10", "11", "12", "13"
                                                 ],
                                                 "enc_modes"   => ["TKIP", "CCMP"],
                                                 "frequencies" =>
                                                                  ["2.412",
                                                                   "2.417",
                                                                   "2.422",
                                                                   "2.427",
                                                                   "2.432",
                                                                   "2.437",
                                                                   "2.442",
                                                                   "2.447",
                                                                   "2.452",
                                                                   "2.457",
                                                                   "2.462",
                                                                   "2.467",
                                                                   "2.472"] }] },
        "sub_class_id"      => 130,
        "sysfs_bus_id"      => "3-2:1.0",
        "sysfs_id"          =>
                               "/devices/pci0000:00/0000:00:08.1/0000:05:00.4/usb3/3-2/3-2:1.0",
        "unique_key"        => "mZxt.M1BlfozBLm7",
        "vendor"            => "Realtek Semiconductor Corp.",
        "vendor_id"         => 199642,
        "wlan"              => true
      }
    ]
  }
end
# rubocop:enable Metrics/MethodLength

describe Y2Autoinstallation::Y2ERB do
  describe ".render" do
    it "returns string with rendered template" do
      # mock just for optimization
      allow(Yast::SCR).to receive(:Read).and_return(hardware_mock_data)
      file = Tempfile.new("test")
      path = file.path
      file.write("<test><%= hardware.inspect %></test>")
      file.close
      result = described_class.render(path)
      file.unlink

      expect(result).to match(/<test>{.*}<\/test>/)
    end
  end
end

describe Y2Autoinstallation::Y2ERB::TemplateEnvironment do
  before do
    allow(Yast::SCR).to receive(:Read).and_return(hardware_mock_data)
  end

  describe "#boot_efi?" do
    let(:efi) { true }

    before do
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(efi)
    end

    context "when the system was booted with EFI" do
      it "returns true" do
        expect(subject.boot_efi?).to eq(true)
      end
    end

    context "when the system was not booted with EFI" do
      let(:efi) { false }

      it "returns false" do
        expect(subject.boot_efi?).to eq(false)
      end
    end
  end

  describe "#network_cards" do
    it "returns list of map" do
      expect(subject.network_cards).to be_a(Array)
      expect(subject.network_cards).to be_all(Hash)
    end
  end

  describe "#disks" do
    it "returns list of map" do
      allow(File).to receive(:read).with(/\/sys\/block/).and_return("\n")
      expect(subject.disks).to be_a(Array)
      expect(subject.disks).to be_all(Hash)
    end
  end

  describe "#os_release" do
    it "returns hash" do
      expect(subject.os_release).to be_a(Hash)
    end
  end
end
