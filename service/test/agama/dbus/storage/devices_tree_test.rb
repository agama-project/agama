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
require "agama/dbus/storage/devices_tree"
require "y2storage"
require "dbus"

describe Agama::DBus::Storage::DevicesTree do
  include Agama::RSpec::StorageHelpers

  RSpec::Matchers.define(:export_object) do |object_path|
    match do |service|
      expect(service).to receive(:export) do |dbus_object|
        expect(dbus_object.path).to eq(object_path)
      end
    end

    failure_message do |_|
      "The object #{object_path} is not exported."
    end

    match_when_negated do |service|
      expect(service).to receive(:export) do |dbus_object|
        expect(dbus_object.path).to_not eq(object_path)
      end
    end

    failure_message_when_negated do |_|
      "The object #{object_path} is exported."
    end
  end

  RSpec::Matchers.define(:unexport_object) do |object_path|
    match do |service|
      expect(service).to receive(:unexport) do |dbus_object|
        expect(dbus_object.path).to eq(object_path)
      end
    end

    failure_message do |_|
      "The object #{object_path} is not unexported."
    end
  end

  subject { described_class.new(service, root_path, logger: logger) }

  let(:service) { instance_double(::DBus::ObjectServer) }

  let(:root_path) { "/test/system" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#path_for" do
    let(:device) { instance_double(Y2Storage::Device, sid: 50) }

    it "returns a D-Bus object path" do
      expect(subject.path_for(device)).to be_a(::DBus::ObjectPath)
    end

    it "uses the device sid as basename" do
      expect(subject.path_for(device)).to eq("#{root_path}/50")
    end
  end

  describe "#update" do
    before do
      mock_storage(devicegraph: scenario)

      allow(service).to receive(:get_node).with(root_path, anything).and_return(root_node)
      allow(root_node).to receive(:descendant_objects).and_return(dbus_objects)

      allow(service).to receive(:export)
      allow(service).to receive(:unexport)

      allow_any_instance_of(::DBus::Object).to receive(:interfaces_and_properties).and_return({})
      allow_any_instance_of(::DBus::Object).to receive(:dbus_properties_changed)
    end

    let(:scenario) { "partitioned_md.yml" }

    let(:root_node) { instance_double(::DBus::Node) }

    let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

    context "if a device is not exported yet" do
      let(:dbus_objects) { [] }

      it "exports a D-Bus object" do
        sda = devicegraph.find_by_name("/dev/sda")
        sdb = devicegraph.find_by_name("/dev/sdb")
        md0 = devicegraph.find_by_name("/dev/md0")
        sda1 = devicegraph.find_by_name("/dev/sda1")
        sda2 = devicegraph.find_by_name("/dev/sda2")
        md0p1 = devicegraph.find_by_name("/dev/md0p1")

        expect(service).to export_object("#{root_path}/#{sda.sid}")
        expect(service).to export_object("#{root_path}/#{sdb.sid}")
        expect(service).to export_object("#{root_path}/#{md0.sid}")
        expect(service).to export_object("#{root_path}/#{sda1.sid}")
        expect(service).to export_object("#{root_path}/#{sda2.sid}")
        expect(service).to export_object("#{root_path}/#{md0p1.sid}")
        expect(service).to_not receive(:export)

        subject.update(devicegraph)
      end
    end

    context "if a device is already exported" do
      let(:dbus_objects) { [dbus_object1] }
      let(:dbus_object1) { Agama::DBus::Storage::Device.new(sda, subject.path_for(sda), subject) }
      let(:sda) { devicegraph.find_by_name("/dev/sda") }

      it "does not export a D-Bus object" do
        expect(service).to_not export_object("#{root_path}/#{sda.sid}")

        subject.update(devicegraph)
      end

      it "updates the D-Bus object" do
        expect(dbus_object1.storage_device).to equal(sda)

        subject.update(devicegraph)

        expect(dbus_object1.storage_device).to_not equal(sda)
        expect(dbus_object1.storage_device.sid).to equal(sda.sid)
      end
    end

    context "if an exported D-Bus object does not represent any of the current devices" do
      let(:dbus_objects) { [dbus_object1] }
      let(:dbus_object1) { Agama::DBus::Storage::Device.new(sdd, subject.path_for(sdd), subject) }
      let(:sdd) { instance_double(Y2Storage::Disk, sid: 1, is?: false) }

      it "unexports the D-Bus object" do
        expect(service).to unexport_object("#{root_path}/1")

        subject.update(devicegraph)
      end
    end
  end
end
