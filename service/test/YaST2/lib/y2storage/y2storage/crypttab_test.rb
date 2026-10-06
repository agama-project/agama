#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2019] SUSE LLC
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

require "y2storage/crypttab"

describe Y2Storage::Crypttab do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { described_class.new(path) }

  let(:path) { File.join(DATA_PATH, crypttab_name) }

  let(:crypttab_name) { "crypttab" }

  let(:scenario) { "empty_hard_disk_50GiB" }

  describe "#initialize" do
    let(:crypttab_name) { "crypttab" }

    it "reads and sets the crypptab entries" do
      entries = subject.entries

      expect(entries.size).to eq(3)

      expect(entries).to include(
        an_object_having_attributes(name: "luks1", device: "/dev/sda1", password: "passw1",
          crypt_options: ["option1", "option2=2"]),
        an_object_having_attributes(name: "luks2", device: "/dev/sda2", password: "passw2"),
        an_object_having_attributes(name: "luks3", device: "/dev/sda3", password: "passw3")
      )
    end

    context "when there is some problem reading the entries" do
      let(:crypttab_name) { "not_exist" }

      it "sets an empty list of entries" do
        expect(subject.entries).to be_empty
      end
    end
  end

  describe "#save_encryption_names" do
    before do
      allow(Storage).to receive(:read_simple_etc_crypttab).and_return(storage_entries)
    end

    let(:scenario) { "gpt_encryption" }

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:device) { devicegraph.find_by_name(device_name) }

    let(:crypttab_entries) do
      [
        crypttab_entry("luks1", device_name, "password", [])
      ]
    end

    let(:device_name) { "/dev/sda1" }

    let(:storage_entries) { crypttab_entries.map(&:to_storage_value) }

    shared_examples "swap encryption" do |encryption_method|
      it "encrypts the device with #{encryption_method} method" do
        subject.save_encryption_names(devicegraph)

        expect(device.encryption.method.to_sym).to eq(encryption_method)
      end

      it "uses the crypttab name for the new encryption device" do
        subject.save_encryption_names(devicegraph)

        expect(device.encryption.basename).to eq("luks1")
      end
    end

    shared_examples "swap encryption methods" do
      context "and the crypttab entry matches the random swap encryption method" do
        let(:encryption_method) { Y2Storage::EncryptionMethod.find(:random_swap) }

        before do
          allow(encryption_method).to receive(:available?).and_return(true)
        end

        include_examples "swap encryption", :random_swap
      end

      context "and the crypttab entry matches the protected swap encryption method" do
        let(:encryption_method) { Y2Storage::EncryptionMethod.find(:protected_swap) }

        before do
          allow(encryption_method).to receive(:available?).and_return(true)
        end

        include_examples "swap encryption", :protected_swap
      end

      context "and the crypttab entry matches the secure swap encryption method" do
        let(:encryption_method) { Y2Storage::EncryptionMethod.find(:secure_swap) }

        before do
          allow(encryption_method).to receive(:available?).and_return(true)
        end

        include_examples "swap encryption", :secure_swap
      end
    end

    context "when the device indicated in a crypttab entry is currently encrypted" do
      let(:device_name) { "/dev/sda4" }

      before do
        allow(Y2Storage::EncryptionMethod).to receive(:for_crypttab).and_return(encryption_method)
      end

      context "and the crypttab entry does not match an encryption method for swap" do
        let(:encryption_method) { nil }

        it "saves the crypttab name on the encryption device" do
          encryption_before = device.encryption

          expect(device.encryption.crypttab_name).to be_nil

          subject.save_encryption_names(devicegraph)

          expect(device.encryption.sid).to eq(encryption_before.sid)
          expect(device.encryption.crypttab_name).to eq("luks1")
        end
      end

      context "and the crypttab entry matches a not available encryption type" do
        let(:encryption_method) { Y2Storage::EncryptionMethod.find(:secure_swap) }

        before do
          allow(encryption_method).to receive(:available?).and_return(false)
        end

        it "does not modify the device" do
          expect(device.encryption.method.to_sym).to eq(:luks1)

          subject.save_encryption_names(devicegraph)

          expect(device.encryption.method.to_sym).to eq(:luks1)
        end
      end

      include_examples "swap encryption methods"
    end

    context "when the device indicated in a crypttab entry is not currently encrypted" do
      let(:device_name) { "/dev/sda1" }

      before do
        allow(Y2Storage::EncryptionMethod).to receive(:for_crypttab).and_return(encryption_method)
      end

      context "and the crypttab entry does not match an encryption method for swap" do
        let(:encryption_method) { nil }

        it "does not encrypt the device" do
          expect(device.encrypted?).to eq(false)

          subject.save_encryption_names(devicegraph)

          expect(device.encrypted?).to eq(false)
        end
      end

      context "and the crypttab entry matches a not available encryption type" do
        let(:encryption_method) { Y2Storage::EncryptionMethod.find(:secure_swap) }

        before do
          allow(encryption_method).to receive(:available?).and_return(false)
        end

        it "does not encrypt the device" do
          expect(device.encrypted?).to eq(false)

          subject.save_encryption_names(devicegraph)

          expect(device.encrypted?).to eq(false)
        end
      end

      include_examples "swap encryption methods"
    end

    context "when the device indicated in a crypttab entry is not found" do
      let(:device_name) { "/dev/sdb1" }

      # Mock the system lookup performed as last resort to find a device
      before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

      it "does not fail" do
        expect { subject.save_encryption_names(devicegraph) }.to_not raise_error
      end
    end

    context "when an encrypted device is not indicated in any crypttab entry" do
      let(:device_name) { "/dev/sda4" }

      it "does not modify the crypttab name of that encryption device" do
        device = devicegraph.find_by_name("/dev/sda5")

        subject.save_encryption_names(devicegraph)

        expect(device.encryption.crypttab_name).to be_nil
      end
    end
  end
end
