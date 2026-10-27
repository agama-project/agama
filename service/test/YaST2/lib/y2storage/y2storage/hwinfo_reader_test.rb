#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage/hwinfo_reader"

describe Y2Storage::HWInfoReader do
  include_context "yast2-storage-ng test setup"

  let(:reader) { described_class.instance }
  let(:hwinfo_output) { File.read(File.join(DATA_PATH, hwinfo_file)) }
  let(:hwinfo_file) { "hwinfo.txt" }

  before do
    # Disable the global mock that normally prevents calls to hwinfo
    allow(reader).to receive(:for_device).and_call_original

    allow(Yast::Execute).to receive(:on_target!)
      .with(/hwinfo/, anything, anything, anything).and_return(hwinfo_output)
    reader.reset
  end

  describe "#for_device" do
    it "returns hardware information for the given device" do
      data = reader.for_device("/dev/sda")
      expect(data).to be_a(Y2Storage::HWInfoDisk)
      expect(data.to_h)
        .to include(bus:              "IDE",
          unique_id:        "3OOL.7kkY9irDFZ4",
          driver_modules:   ["ahci"],
          driver:           ["ahci", "sd"],
          io_ports:         "0xe000-0xefff rw",
          geometry_logical: "CHS 121601/255/63")
    end

    it "supports alternative devices names" do
      data = reader.for_device("/dev/sg1")
      expect(data.device_file).to eq(["/dev/sdb", "/dev/sg1"])
    end

    it "retrieves hardware information from hwinfo" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/sbin/hwinfo", "--disk", "--listmd", stdout: :capture)
        .and_return(hwinfo_output)
      reader.for_device("/dev/sda")
    end

    it "caches hardware information" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/sbin/hwinfo", "--disk", "--listmd", stdout: :capture)
        .and_return(hwinfo_output)
        .once
      reader.for_device("/dev/sda")
      reader.for_device("/dev/sda")
    end

    it "returns an empty object for non-existing device names" do
      data = reader.for_device("/dev/nothing")
      expect(data).to be_a(Y2Storage::HWInfoDisk)
      expect(data).to be_empty
    end

    context "when the system contains some zFCP multipath device" do
      let(:hwinfo_file) { "hwinfo_bug1982536.txt" }

      # Regression test for bug#1982536
      it "does not raise any exception" do
        expect { reader.for_device("/dev/sda") }.to_not raise_error
      end

      it "returns hardware information for the given device" do
        data = reader.for_device("/dev/sda")
        expect(data).to be_a(Y2Storage::HWInfoDisk)
        expect(data.to_h)
          .to include(bus:              "SCSI",
            driver_modules:   ["zfcp", "sd_mod"],
            driver:           ["zfcp", "sd"],
            geometry_logical: "CHS 20480/64/32")
      end
    end
  end

  describe "#reset" do
    context "when information is cached" do
      before do
        reader.for_device("/dev/sda")
      end

      it "resets information" do
        reader.reset
        expect(Yast::Execute).to receive(:on_target!)
          .with("/usr/sbin/hwinfo", "--disk", "--listmd", stdout: :capture)
        reader.for_device("/dev/sda")
      end
    end
  end
end
