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
require "agama/dbus/storage/devices_tree"
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

  let(:service) { instance_double(::DBus::Service) }

  let(:root_path) { "/test/system" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:root_node) { instance_double(::DBus::Node) }

  let(:dbus_objects) { [] }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)

    allow(service).to receive(:get_node).with(root_path, anything).and_return(root_node)
    allow(service).to receive(:export)
    allow(service).to receive(:unexport)

    allow(root_node).to receive(:descendant_objects).and_return(dbus_objects)
  end

  describe "#update" do
    let(:scenario) { "partitioned_md.yml" }

    let(:dbus_objects) do
      [
        instance_double(Agama::DBus::Storage::Device, path: "#{root_path}/1001"),
        instance_double(Agama::DBus::Storage::Device, path: "#{root_path}/1002")
      ]
    end

    it "unexports the current objects" do
      expect(service).to unexport_object("#{root_path}/1001")
      expect(service).to unexport_object("#{root_path}/1002")

      subject.update(devicegraph)
    end

    it "exports an object for each storage device" do
      sda = devicegraph.find_by_name("/dev/sda")
      sdb = devicegraph.find_by_name("/dev/sdb")
      md0 = devicegraph.find_by_name("/dev/md0")

      expect(service).to export_object("#{root_path}/#{sda.sid}")
      expect(service).to export_object("#{root_path}/#{sdb.sid}")
      expect(service).to export_object("#{root_path}/#{md0.sid}")
      expect(service).to_not receive(:export)

      subject.update(devicegraph)
    end
  end
end
