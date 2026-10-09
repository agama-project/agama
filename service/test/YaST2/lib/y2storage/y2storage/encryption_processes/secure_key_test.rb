#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019-2020] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::EncryptionProcesses::SecureKey do
  include_context "yast2-storage-ng test setup"

  def zkey_output(file)
    File.read(File.join(DATA_PATH, "zkey", "#{file}.txt"))
  end

  before do
    fake_scenario("several-dasds")

    allow(Yast::Execute).to receive(:locally).with(/zkey/, "list", anything).and_return(zkey_list)
  end

  let(:zkey_list) { zkey_output("list-no-dasdc1") }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  describe ".for_device" do
    let(:device) { devicegraph.find_by_name("/dev/dasdb1") }

    it "returns the secure key for the given device" do
      key = described_class.for_device(device)

      expect(key).to be_for_device(device)
      expect(key.sector_size).to eq(4096)
    end
  end

  describe ".new_from_zkey" do
    it "returns a secure key using the values from the string" do
      key = described_class.new_from_zkey(zkey_list)

      expect(key.sector_size).to eq(4096)
    end

    context "when the sector size is not defined" do
      let(:zkey_list) { zkey_output("list-no-sector-size") }

      it "sets the sector size to nil" do
        key = described_class.new_from_zkey(zkey_list)

        expect(key.sector_size).to be_nil
      end
    end
  end

  shared_examples "zkey_generate" do |testing_method, execute_method|
    it "runs zkey to create the LUKS2" do
      expect(Yast::Execute).to receive(execute_method).with(
        "/usr/bin/zkey", "generate", "-V", "--name", "YaST_cr", "--xts", "--keybits", "256",
        "--volume-type", "LUKS2"
      )

      described_class.send(testing_method, "YaST_cr")
    end

    context "when the given secure key name already exists" do
      let(:name) { "YaST_cr_dasdc1" }

      it "ensures uniq name by adding a suffix number" do
        expect(Yast::Execute).to receive(execute_method).with(
          "/usr/bin/zkey", "generate", "-V", "--name", "YaST_cr_dasdc1_1", "--xts", "--keybits", "256",
          "--volume-type", "LUKS2"
        )

        described_class.send(testing_method, name)
      end
    end

    context "when a sector size is given" do
      let(:params) { { sector_size: 2048 } }

      it "runs zkey with the given sector size" do
        expect(Yast::Execute).to receive(execute_method).with(
          "/usr/bin/zkey", "generate", "-V", "--name", "YaST_cr", "--xts", "--keybits", "256",
          "--volume-type", "LUKS2", "--sector-size", "2048"
        )

        described_class.send(testing_method, "YaST_cr", **params)
      end
    end

    context "when volumes are given" do
      let(:params) { { volumes: volumes } }

      before do
        device = devicegraph.find_by_name("/dev/dasdc1")
        device.create_encryption("cr_test")
      end

      let(:encryption) { devicegraph.find_by_name("/dev/mapper/cr_test") }

      let(:volumes) { [encryption] }

      it "runs zkey with the given volumnes" do
        expect(Yast::Execute).to receive(execute_method).with(
          "/usr/bin/zkey", "generate", "-V", "--name", "YaST_cr", "--xts", "--keybits", "256",
          "--volume-type", "LUKS2", "--volumes", "/dev/dasdc1:cr_test"
        )

        described_class.send(testing_method, "YaST_cr", **params)
      end
    end

    context "when APQNs are given" do
      let(:params) { { apqns: [apqn1, apqn2] } }

      let(:apqn1) { instance_double(Y2Storage::EncryptionProcesses::Apqn, name: "01.0001") }
      let(:apqn2) { instance_double(Y2Storage::EncryptionProcesses::Apqn, name: "01.0002") }

      it "runs zkey with the given APQNs" do
        expect(Yast::Execute).to receive(execute_method).with(
          "/usr/bin/zkey", "generate", "-V", "--name", "YaST_cr", "--xts", "--keybits", "256",
          "--volume-type", "LUKS2", "--apqns", "01.0001,01.0002"
        )

        described_class.send(testing_method, "YaST_cr", **params)
      end
    end
  end

  describe ".generate" do
    it "returns a secure key" do
      allow(Yast::Execute).to receive(:locally)

      expect(described_class.generate("YaST_cr")).to be_a(Y2Storage::EncryptionProcesses::SecureKey)
    end

    include_examples "zkey_generate", :generate, :locally
  end

  describe ".generate!" do
    context "when the key can be generated" do
      before do
        allow(Yast::Execute).to receive(:locally!).with(/zkey/, "generate", any_args)
      end

      it "returns a secure key" do
        expect(described_class.generate!("YaST_cr")).to be_a(Y2Storage::EncryptionProcesses::SecureKey)
      end
    end

    context "when the key cannot be generated" do
      before do
        allow(Yast::Execute).to receive(:locally!).with(/zkey/, "generate", any_args).and_raise(an_error)
      end

      let(:an_error) { RuntimeError }

      it "raises an error" do
        expect { described_class.generate!("YaST_cr") }.to raise_error(an_error)
      end
    end

    include_examples "zkey_generate", :generate!, :locally!
  end

  describe "#filename" do
    subject { described_class.new("cr", sector_size: 2048) }

    it "returns the correct filename" do
      expect(subject.filename).to eq("/etc/zkey/repository/cr.skey")
    end
  end

  describe "#secure_key_size" do
    subject { described_class.new("cr", sector_size: 2048) }

    context "if the key file exists" do
      before do
        allow(File).to receive(:size).with("/etc/zkey/repository/cr.skey").and_return 272
      end

      it "returns the size of the key file" do
        expect(subject.secure_key_size).to eq 272
      end
    end

    context "if the key file does not exist" do
      before do
        allow(File).to receive(:size).with("/etc/zkey/repository/cr.skey").and_raise exception
      end

      let(:exception) { Errno::ENOENT.new }

      it "returns zero" do
        expect(subject.secure_key_size).to eq 0
      end
    end
  end

  describe "#add_device_and_write" do
    let(:blk_device) do
      instance_double(Y2Storage::BlkDevice, udev_full_ids: ["/dev/dasdc1"])
    end

    let(:device) do
      instance_double(Y2Storage::Encryption, blk_device: blk_device, dm_table_name: "cr_1")
    end

    subject { described_class.new("cr", sector_size: 2048) }

    it "calls zkey to add the volume" do
      expect(Yast::Execute).to receive(:locally).with(/zkey/, "change", "--name", "cr",
        "--volumes", "+/dev/dasdc1:cr_1", any_args)

      subject.add_device_and_write(device)
    end
  end

  describe "#remove" do
    subject { described_class.new("cr_YaST") }

    it "runs zkey remove" do
      expect(Yast::Execute).to receive(:locally!).with(/zkey/, "remove", "--force", "--name", "cr_YaST")

      subject.remove
    end
  end
end
