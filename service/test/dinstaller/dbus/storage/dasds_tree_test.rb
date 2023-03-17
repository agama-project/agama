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
require "dinstaller/dbus/storage/dasds_tree"
require "dinstaller/dbus/storage/dasd"
require "dbus"

describe DInstaller::DBus::Storage::DasdsTree do
  subject { described_class.new(service, logger: logger) }

  let(:service) { instance_double(::DBus::Service) }
  let(:root_node) { instance_double(::DBus::Node) }
  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(service).to receive(:get_node).with(described_class::ROOT_PATH, anything)
      .and_return(root_node)

    allow(root_node).to receive(:descendant_objects).and_return(dbus_nodes)
  end

  describe "#find_paths" do
    let(:dbus_nodes) { [dbus_dasd1, dbus_dasd2] }

    let(:dbus_dasd1) do
      instance_double(::DBus::Object, path: "/org/opensuse/DInstaller/Storage1/dasds/1")
    end

    let(:dbus_dasd2) do
      instance_double(::DBus::Object, path: "/org/opensuse/DInstaller/Storage1/dasds/2")
    end

    context "when all the given paths are already exported on D-Bus" do
      let(:paths) do
        ["/org/opensuse/DInstaller/Storage1/dasds/1"]
      end

      it "returns the corresponding D-BUS DASDs" do
        expect(subject.find_paths(paths)).to eq [dbus_dasd1]
      end
    end

    context "when some of the given paths are already exported on D-Bus" do
      let(:paths) do
        ["/org/opensuse/DInstaller/Storage1/dasds/1", "/org/opensuse/DInstaller/Storage1/dasds/3"]
      end

      it "returns the subset of D-BUS DASDs that are exported" do
        expect(subject.find_paths(paths)).to eq [dbus_dasd1]
      end
    end

    context "when none of the given paths are already exported on D-Bus" do
      let(:paths) do
        ["/org/opensuse/DInstaller/Storage1/dasds/3"]
      end

      it "returns an empty array" do
        expect(subject.find_paths(paths)).to eq []
      end
    end
  end

  describe "#find" do
    let(:dbus_nodes) { [dbus_dasd1, dbus_dasd2, dbus_dasd3] }

    let(:dbus_dasd1) do
      instance_double(DInstaller::DBus::Storage::Dasd, id: "0.0.001", formatted: false)
    end

    let(:dbus_dasd2) do
      instance_double(DInstaller::DBus::Storage::Dasd, id: "0.0.002", formatted: true)
    end

    let(:dbus_dasd3) do
      instance_double(DInstaller::DBus::Storage::Dasd, id: "0.0.003", formatted: true)
    end

    it "returns the first DASD that matches the criteria" do
      expect(subject.find(&:formatted)).to eq dbus_dasd2
    end
  end

  describe "#populate" do
    let(:dbus_nodes) { [dbus_dasd1, dbus_dasd2] }

    let(:dbus_dasd1) do
      instance_double(DInstaller::DBus::Storage::Dasd, dasd: dasd1, id: dasd1.id)
    end

    let(:dbus_dasd2) do
      instance_double(DInstaller::DBus::Storage::Dasd, dasd: dasd2, id: dasd2.id)
    end

    let(:dasd1) do
      instance_double(
        "Y2S390::Dasd", id: "0.0.001", offline?: false, device_name: "/dev/dasda", type: "ECKD",
        formatted?: false, use_diag: false, access_type: "rw", partition_info: "/dev/dasda1"
      )
    end

    let(:dasd2) do
      instance_double(
        "Y2S390::Dasd", id: "0.0.002", offline?: true, device_name: nil, type: nil,
        formatted?: false, use_diag: false, access_type: nil, partition_info: ""
      )
    end

    before do
      allow(service).to receive(:export)
      allow(service).to receive(:unexport)
    end

    context "if a given DASD is not exported yet" do
      let(:dasds) { [dasd3] }

      let(:dasd3) do
        instance_double(
          "Y2S390::Dasd", id: "0.0.003", offline?: true, device_name: nil, type: nil,
          formatted?: false, use_diag: false, access_type: nil, partition_info: ""
        )
      end

      it "exports a new D-Bus DASD object" do
        expect(service).to receive(:export) do |dbus_dasd|
          expect(dbus_dasd.path).to match(/#{described_class::ROOT_PATH}\/[0-9]+/)
        end

        subject.populate(dasds)
      end
    end

    context "if a given DASD is already exported" do
      # This DASD has the same id than dasd1, so it represents the same device
      let(:dasds) { [dasd3] }

      let(:dasd3) do
        instance_double(
          "Y2S390::Dasd", id: "0.0.001", offline?: true, device_name: nil, type: nil,
          formatted?: false, use_diag: false, access_type: nil, partition_info: ""
        )
      end

      it "updates the D-Bus node" do
        expect(dbus_dasd1).to receive(:dasd=).with(dasd3)

        subject.populate(dasds)
      end
    end

    context "if an exported D-Bus DASD is not included in the given list of devices" do
      # dasd2 is part of the tree, but is not included in the list below
      let(:dasds) { [dasd1] }

      before do
        allow(dbus_dasd1).to receive(:dasd=)
      end

      it "unexports the D-Bus DASD object" do
        expect(service).to receive(:unexport).with(dbus_dasd2)

        subject.populate(dasds)
      end
    end
  end

  describe "#update" do
    let(:dbus_nodes) { [dbus_dasd1, dbus_dasd2] }

    let(:dbus_dasd1) do
      instance_double(DInstaller::DBus::Storage::Dasd, dasd: dasd1, id: dasd1.id)
    end

    let(:dbus_dasd2) do
      instance_double(DInstaller::DBus::Storage::Dasd, dasd: dasd2, id: dasd2.id)
    end

    let(:dasd1) do
      instance_double(
        "Y2S390::Dasd", id: "0.0.001", offline?: false, device_name: "/dev/dasda", type: "ECKD",
        formatted?: false, use_diag: false, access_type: "rw", partition_info: "/dev/dasda1"
      )
    end

    let(:dasd2) do
      instance_double(
        "Y2S390::Dasd", id: "0.0.002", offline?: true, device_name: nil, type: nil,
        formatted?: false, use_diag: false, access_type: nil, partition_info: ""
      )
    end

    context "if a given DASD is already exported" do
      # This DASD has the same id than dasd1, so it represents the same device
      let(:dasds) { [dasd3] }

      let(:dasd3) do
        instance_double(
          "Y2S390::Dasd", id: "0.0.001", offline?: true, device_name: nil, type: nil,
          formatted?: false, use_diag: false, access_type: nil, partition_info: ""
        )
      end

      it "updates the D-Bus node" do
        expect(dbus_dasd1).to receive(:dasd=).with(dasd3)

        subject.update(dasds)
      end
    end

    context "if an exported D-Bus DASD is not included in the given list of devices" do
      # dasd2 is part of the tree, but is not included in the list below
      let(:dasds) { [dasd1] }
      before { allow(dbus_dasd1).to receive(:dasd=) }

      it "does not unexport the ommitted DASDs" do
        expect(service).to_not receive(:unexport)
        subject.update(dasds)
      end

      it "does not update the ommitted DASDs" do
        expect(dbus_dasd2).to_not receive(:dasd=)
        subject.update(dasds)
      end
    end
  end
end
