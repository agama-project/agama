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
require "agama/dbus/storage/jobs_tree"
require "agama/dbus/storage/dasds_tree"
require "dbus"

describe Agama::DBus::Storage::JobsTree do
  subject { described_class.new(service, logger: logger) }

  let(:service) { instance_double(::DBus::ObjectServer) }
  let(:dasds_root_node) { instance_double(::DBus::Node) }
  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(service).to receive(:get_node)
      .with(Agama::DBus::Storage::DasdsTree::ROOT_PATH, anything).and_return(dasds_root_node)

    allow(dasds_root_node).to receive(:descendant_objects).and_return(dasd_nodes)
  end

  describe "#add_dasds_format" do
    let(:dbus_dasd1) do
      instance_double(Agama::DBus::Storage::Dasd, id: "0.0.001", path: "/path/dasd1")
    end
    let(:dbus_dasd2) do
      instance_double(Agama::DBus::Storage::Dasd, id: "0.0.002", path: "/path/dasd2")
    end
    let(:dasd_nodes) { [dbus_dasd1, dbus_dasd2] }
    let(:dasds_tree) { Agama::DBus::Storage::DasdsTree.new(service, logger: logger) }

    let(:dasd1) { double("Y2S390::Dasd", id: "0.0.001") }
    let(:dasd2) { double("Y2S390::Dasd", id: "0.0.002") }
    let(:initial_status) do
      [
        double("FormatStatus", dasd: dasd1, cylinders: 1000, progress: 0, done?: false),
        double("FormatStatus", dasd: dasd2, cylinders: 2000, progress: 0, done?: false)
      ]
    end

    it "exports a new D-Bus Job object" do
      expect(service).to receive(:export) do |job|
        expect(job.path).to match(/#{described_class::ROOT_PATH}\/[0-9]+/)

        expect(job.summary).to eq(
          { "0.0.001" => [1000, 0, false], "0.0.002" => [2000, 0, false] }
        )
      end

      subject.add_dasds_format(initial_status, dasds_tree)
    end
  end
end
