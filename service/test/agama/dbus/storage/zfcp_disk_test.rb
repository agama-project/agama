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
require "agama/dbus/storage/zfcp_disk"
require "agama/storage/zfcp/disk"

describe Agama::DBus::Storage::ZFCPDisk do
  subject { described_class.new(sda, path, logger: logger) }

  let(:sda) do
    Agama::Storage::ZFCP::Disk.new(
      "/dev/sda", "0.0.fa00", "0x500507630708d3b3", "0x0013000000000000"
    )
  end

  let(:path) { "/org/opensuse/Agama/Storage1/zfcp_disks/1" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(subject).to receive(:dbus_properties_changed)
  end

  describe "#name" do
    it "returns the zFCP disk name" do
      expect(subject.name).to eq("/dev/sda")
    end
  end

  describe "#channel" do
    it "returns the channel id" do
      expect(subject.channel).to eq("0.0.fa00")
    end
  end

  describe "#wwpn" do
    it "returns the WWPN" do
      expect(subject.wwpn).to eq("0x500507630708d3b3")
    end
  end

  describe "#lun" do
    it "returns the LUN" do
      expect(subject.lun).to eq("0x0013000000000000")
    end
  end

  describe "#disk=" do
    let(:sdb) do
      Agama::Storage::ZFCP::Disk.new(
        "/dev/sdb", "0.0.fa00", "0x500507630703d3b3", "0x0000000000000005"
      )
    end

    it "sets the represented zFCP disk" do
      expect(subject.disk).to_not eq(sdb)

      subject.disk = sdb

      expect(subject.disk).to eq(sdb)
    end

    context "if the given disk is different to the current one" do
      let(:new_disk) do
        Agama::Storage::ZFCP::Disk.new(
          "/dev/sdb", "0.0.fa00", "0x500507630708d3b3", "0x0013000000000000"
        )
      end

      it "emits properties changed signal" do
        expect(subject).to receive(:dbus_properties_changed)

        subject.disk = new_disk
      end
    end

    context "if the given disk is equal to the current one" do
      let(:new_disk) do
        Agama::Storage::ZFCP::Disk.new(
          "/dev/sda", "0.0.fa00", "0x500507630708d3b3", "0x0013000000000000"
        )
      end

      it "does not emit properties changed signal" do
        expect(subject).to_not receive(:dbus_properties_changed)

        subject.disk = new_disk
      end
    end
  end
end
