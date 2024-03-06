# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require_relative "../../storage/storage_helpers"
require_relative "./interfaces/device/block_examples"
require_relative "./interfaces/device/component_examples"
require_relative "./interfaces/device/drive_examples"
require_relative "./interfaces/device/filesystem_examples"
require_relative "./interfaces/device/lvm_vg_examples"
require_relative "./interfaces/device/md_examples"
require_relative "./interfaces/device/multipath_examples"
require_relative "./interfaces/device/partition_table_examples"
require_relative "./interfaces/device/raid_examples"
require "agama/dbus/storage/device"
require "agama/dbus/storage/devices_tree"
require "dbus"

describe Agama::DBus::Storage::Device do
  include Agama::RSpec::StorageHelpers

  RSpec::Matchers.define(:include_dbus_interface) do |interface|
    match do |dbus_object|
      !dbus_object.interfaces_and_properties[interface].nil?
    end

    failure_message do |dbus_object|
      "D-Bus interface #{interface} is not included.\n" \
        "Interfaces: #{dbus_object.interfaces_and_properties.keys.join(", ")}"
    end
  end

  subject { described_class.new(device, "/test", tree) }

  let(:tree) { Agama::DBus::Storage::DevicesTree.new(service, "/agama/devices") }

  let(:service) { instance_double(::DBus::ObjectServer) }

  before do
    mock_storage(devicegraph: scenario)
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe ".new" do
    context "when the given device is a disk" do
      let(:scenario) { "partitioned_md.yml" }

      let(:device) { devicegraph.find_by_name("/dev/sda") }

      it "defines the Drive interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Drive")
      end

      it "defines the Block interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Block")
      end
    end

    context "when the device is a DM RAID" do
      let(:scenario) { "empty-dm_raids.xml" }

      let(:device) { devicegraph.dm_raids.first }

      it "defines the Drive interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Drive")
      end

      it "defines the RAID interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.RAID")
      end

      it "defines the Block interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Block")
      end
    end

    context "when the device is a MD RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:device) { devicegraph.md_raids.first }

      it "does not define the Drive interface" do
        expect(subject).to_not include_dbus_interface("org.opensuse.Agama.Storage1.Drive")
      end

      it "defines the MD interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.MD")
      end

      it "defines the Block interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Block")
      end
    end

    context "when the given device is a LVM volume group" do
      let(:scenario) { "trivial_lvm.yml" }

      let(:device) { devicegraph.find_by_name("/dev/vg0") }

      it "defines the LVM.VolumeGroup interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.LVM.VolumeGroup")
      end
    end

    context "when the given device has a partition table" do
      let(:scenario) { "partitioned_md.yml" }

      let(:device) { devicegraph.find_by_name("/dev/sda") }

      it "defines the PartitionTable interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.PartitionTable")
      end
    end

    context "when the given device has no partition table" do
      let(:scenario) { "partitioned_md.yml" }

      let(:device) { devicegraph.find_by_name("/dev/sdb") }

      it "does not define the PartitionTable interface" do
        expect(subject)
          .to_not include_dbus_interface("org.opensuse.Agama.Storage1.PartitionTable")
      end
    end
  end

  include_examples "Drive interface"

  include_examples "RAID interface"

  include_examples "Multipath interface"

  include_examples "MD interface"

  include_examples "Block interface"

  include_examples "LVM.VolumeGroup interface"

  include_examples "PartitionTable interface"

  include_examples "Filesystem interface"

  include_examples "Component interface"

  describe "#storage_device=" do
    before do
      allow(subject).to receive(:dbus_properties_changed)
    end

    let(:scenario) { "partitioned_md.yml" }
    let(:device) { devicegraph.find_by_name("/dev/sda") }

    context "if the given device has a different sid" do
      let(:new_device) { devicegraph.find_by_name("/dev/sdb") }

      it "raises an error" do
        expect { subject.storage_device = new_device }
          .to raise_error(RuntimeError, /Cannot update the D-Bus object/)
      end
    end

    context "if the given device has the same sid" do
      let(:new_device) { devicegraph.find_by_name("/dev/sda") }

      it "emits a properties changed signal for each interface" do
        subject.interfaces_and_properties.each_key do |interface|
          expect(subject).to receive(:dbus_properties_changed).with(interface, anything, anything)
        end

        subject.storage_device = new_device
      end
    end
  end
end
