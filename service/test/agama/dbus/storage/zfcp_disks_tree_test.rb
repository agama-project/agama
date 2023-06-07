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
require "agama/dbus/storage/zfcp_disks_tree"
require "agama/storage/zfcp/disk"
require "dbus"

describe Agama::DBus::Storage::ZFCPDisksTree do
  subject { described_class.new(service, logger: logger) }

  let(:service) { instance_double(::DBus::Service) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(service).to receive(:get_node).with(described_class::ROOT_PATH, anything)
      .and_return(root_node)

    allow(root_node).to receive(:descendant_objects).and_return(dbus_objects)
  end

  let(:root_node) { instance_double(::DBus::Node) }

  let(:dbus_objects) { [] }

  describe "#objects=" do
    let(:dbus_objects) { [dbus_object1, dbus_object2] }

    let(:dbus_object1) do
      Agama::DBus::Storage::ZFCPDisk.new(sda, "", logger: logger)
    end

    let(:dbus_object2) do
      Agama::DBus::Storage::ZFCPDisk.new(sdb, "", logger: logger)
    end

    let(:sda) do
      Agama::Storage::ZFCP::Disk.new(
        "/dev/sda", "0.0.fa00", "0x500507630708d3b3", "0x0013000000000000"
      )
    end

    let(:sdb) do
      Agama::Storage::ZFCP::Disk.new(
        "/dev/sdb", "0.0.fa00", "0x500507630703d3b3", "0x0000000000000005"
      )
    end

    before do
      allow(service).to receive(:export)
      allow(service).to receive(:unexport)

      allow_any_instance_of(::DBus::Object).to receive(:interfaces_and_properties).and_return({})
      allow_any_instance_of(::DBus::Object).to receive(:dbus_properties_changed)
    end

    context "if a given zFCP disk is not exported yet" do
      let(:disks) { [sdc] }

      let(:sdc) do
        Agama::Storage::ZFCP::Disk.new(
          "/dev/sdc", "0.0.fa00", "0x500507630703d3b3", "0x0000000000000006"
        )
      end

      it "exports a new LUN D-Bus object" do
        expect(service).to receive(:export) do |dbus_object|
          expect(dbus_object.path).to match(/#{described_class::ROOT_PATH}\/[0-9]+/)
        end

        subject.objects = disks
      end
    end

    context "if a given zFCP disk is already exported" do
      # sdd is equal to sdb (same channel, WWPN and LUN)
      let(:disks) { [sdd] }

      let(:sdd) do
        Agama::Storage::ZFCP::Disk.new(
          "/dev/sdd", "0.0.fa00", "0x500507630703d3b3", "0x0000000000000005"
        )
      end

      it "updates the D-Bus object" do
        expect(dbus_object2.disk).to_not eq(sdd)

        subject.objects = disks

        expect(dbus_object2.disk).to eq(sdd)
      end
    end

    context "if an exported D-Bus object does not represent any of the given zFCP disks" do
      # There is a D-Bus object for sdb but sdb is missing in the list of given disks
      let(:disks) { [sda] }

      it "unexports the D-Bus object" do
        expect(service).to receive(:unexport).with(dbus_object2)

        subject.objects = disks
      end
    end
  end
end
