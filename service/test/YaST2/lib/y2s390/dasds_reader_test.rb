# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2s390/dasds_reader"

describe Y2S390::DasdsReader do
  let(:reader) { described_class.new }
  let(:config_mode) { true }
  let(:execute) { instance_double("Yast::Execute", on_target: true) }

  let(:lsdasd_output) do
    File.read(File.join(FIXTURES_PATH, "yast2", "y2s390", "lsdasd.txt"))
  end

  # Raw `.probe.disk`-shaped data, as it would be reported by hwinfo for the devices listed in
  # lsdasd.txt. Only the fields `device_type_for` actually reads are filled in.
  let(:probe_disk_data) do
    [
      {
        "sysfs_bus_id"  => "0.0.0160",
        "device_id"     => 276_880,
        "sub_device_id" => 275_344,
        "detail"        => { "cu_model" => 233, "dev_model" => 10 }
      }
    ]
  end

  before do
    allow(reader).to receive(:dasd_entries).and_return(lsdasd_output.split("\n"))
    Y2S390::HwinfoReader.instance.reset
    # Stubbed for every example in this file (not just the "normal Mode" one below), since
    # `use_diag?` -> `dasd.sysfs_id` -> `dasd.hwinfo` reaches `Y2S390::HwinfoReader.instance` even
    # while in "config Mode" - without this, those examples would hit the real (unmocked)
    # `Yast::SCR.Read(".probe.disk")`.
    allow(Y2S390::HwinfoReader.instance).to receive(:disks).and_return(probe_disk_data)
  end

  describe "#list" do
    before do
      allow(Yast::Mode).to receive(:config).and_return(config_mode)
    end

    it "reads and parses the DASD devices using lsdasd" do
      allow(Yast::Execute).to receive(:stdout).and_return(execute)
      expect(reader).to receive(:dasd_entries).and_call_original
      expect(execute).to receive(:locally!).with(["/sbin/lsdasd", "-a"]).and_return("")

      reader.list
    end

    it "returns a collection of DASD devices" do
      expect(reader.list).to be_a(Y2S390::DasdsCollection)
    end

    context "when called in 'normal' Mode" do
      let(:config_mode) { false }

      it "it fetchs all the DASD information" do
        devices = reader.list
        dasd = devices.by_id("0.0.0160")
        expect(dasd.type).to eq("ECKD")
        expect(dasd.device_name).to eq("dasda")
        expect(dasd.offline?).to eq(false)
        expect(dasd.device_type).to eq("3990/E9 3390/0A")
      end
    end

    context "when called in 'config' Mode" do
      it "it fetchs only the 'id' and 'diag' information and initializes 'format' as false" do
        expect(reader).to_not receive(:update_additional_info)
        devices = reader.list
        dasd = devices.by_id("0.0.0150")
        expect(dasd.format_wanted).to eq(false)
        expect(dasd.use_diag).to eq(false)
        expect(dasd.diag_wanted).to eq(false)
        expect(dasd.type).to be_nil
        expect(dasd.device_name).to be_nil
      end
    end
  end
end
