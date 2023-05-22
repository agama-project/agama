# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require_relative "./interfaces/drive_examples"
require_relative "./interfaces/raid_examples"
require_relative "./interfaces/multipath_examples"
require_relative "./interfaces/block_examples"
require_relative "./interfaces/md_examples"
require_relative "./interfaces/partition_table_examples"
require "agama/dbus/storage/device"
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

  subject { described_class.new(device, "/test") }

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

      it "defines the RAID interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.MD")
      end

      it "defines the Block interface" do
        expect(subject).to include_dbus_interface("org.opensuse.Agama.Storage1.Block")
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

  include_examples "PartitionTable interface"
end
