#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019-2026] SUSE LLC
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

require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Y2Storage::EncryptionMethod do
  include_context "yast2-storage-ng test setup"

  describe ".all" do
    it "contains a method for Luks1" do
      expect(described_class.all.map(&:to_sym)).to include(:luks1)
    end

    it "contains a method for regular Luks2" do
      expect(described_class.all.map(&:to_sym)).to include(:luks2)
    end

    it "contains a method for pervasive Luks2" do
      expect(described_class.all.map(&:to_sym)).to include(:pervasive_luks2)
    end

    it "contains a method for random swap" do
      expect(described_class.all.map(&:to_sym)).to include(:random_swap)
    end

    it "contains a method for protected swap" do
      expect(described_class.all.map(&:to_sym)).to include(:protected_swap)
    end

    it "contains a method for secure swap" do
      expect(described_class.all.map(&:to_sym)).to include(:secure_swap)
    end

    it "contains a method for TPM full-disk encryption" do
      expect(described_class.all.map(&:to_sym)).to include(:tpm_fde)
    end

    it "contains a BLS-compliant method with TPM unlocking" do
      expect(described_class.all.map(&:to_sym)).to include(:tpm_bls)
    end
  end

  describe ".available" do
    def lszcrypt_output(file)
      File.read(File.join(DATA_PATH, "lszcrypt", "#{file}.txt"))
    end

    before do
      allow(Y2Storage::Arch).to receive(:new).and_return(arch)
      allow(Yast::Execute).to receive(:locally!).with(/lszcrypt/, anything).and_return(lszcrypt)
      allow(File).to receive(:read).and_call_original
      allow(File).to receive(:read).with(/^\/sys\/bus\/ap\/devices\/card/).and_return mkvps_content
      mock_env(env_vars)
    end

    let(:arch) { instance_double("Y2Storage::Arch", efiboot?: true) }
    let(:lszcrypt) { "" }
    let(:env_vars) { {} }
    let(:mkvps_content) { "" }

    context "if there are online Crypto Express CCA coprocessors" do
      let(:lszcrypt) { lszcrypt_output("ok") }

      context "but none of them have a valid master key" do
        it "returns methods for LUKS1, LUKS2, systemd_fde and random swap" do
          expect(described_class.available.map(&:to_sym))
            .to contain_exactly(:luks1, :luks2, :random_swap, :systemd_fde)
        end
      end

      context "and any of them has a valid master key" do
        def mkvps(file)
          File.read(File.join(DATA_PATH, "mkvps", "#{file}.txt"))
        end

        let(:mkvps_content) { mkvps("cca-valid1") }

        it "returns methods for LUKS1, LUKS2, pervasive LUKS2 and random swap" do
          expect(described_class.available.map(&:to_sym))
            .to contain_exactly(:luks1, :luks2, :pervasive_luks2, :random_swap, :systemd_fde)
        end
      end
    end

    context "if no Crypto Express CCA coprocessor is available (online)" do
      let(:lszcrypt) { lszcrypt_output("no_devs") }

      it "returns methods for LUKS1, LUKS2 and random swap" do
        expect(described_class.available.map(&:to_sym))
          .to contain_exactly(:luks1, :luks2, :random_swap, :systemd_fde)
      end
    end

    context "if secure AES keys are not supported" do
      let(:lszcrypt) { "" }

      it "returns methods for LUKS1, LUKS2 and random swap" do
        expect(described_class.available.map(&:to_sym))
          .to contain_exactly(:luks1, :luks2, :random_swap, :systemd_fde)
      end
    end

    context "if the lszcrypt tool is not available" do
      before do
        allow(Yast::Execute).to receive(:locally!).with(/lszcrypt/, anything)
          .and_raise Cheetah::ExecutionFailed.new("", "", "", "")
      end

      it "returns methods for LUKS1, LUKS2 and random swap" do
        expect(described_class.available.map(&:to_sym))
          .to contain_exactly(:luks1, :luks2, :random_swap, :systemd_fde)
      end
    end

    context "if protected swap is available" do
      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::ProtectedSwap).to receive(:available?)
          .and_return(true)
      end

      it "includes protected swap method" do
        expect(described_class.available.map(&:to_sym)).to include(:protected_swap)
      end
    end

    context "if protected swap is not available" do
      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::ProtectedSwap).to receive(:available?)
          .and_return(false)
      end

      it "does not include protected swap method" do
        expect(described_class.available.map(&:to_sym)).to_not include(:protected_swap)
      end
    end

    context "if secure swap is available" do
      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::SecureSwap).to receive(:available?)
          .and_return(true)
      end

      it "includes secure swap method" do
        expect(described_class.available.map(&:to_sym)).to include(:secure_swap)
      end
    end

    context "if secure swap is not available" do
      before do
        allow_any_instance_of(Y2Storage::EncryptionMethod::SecureSwap).to receive(:available?)
          .and_return(false)
      end

      it "does not include secure swap method" do
        expect(described_class.available.map(&:to_sym)).to_not include(:secure_swap)
      end
    end

    context "if TPM full-disk encryption is available" do
      before do
        allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:available?).and_return(true)
      end

      it "includes the corresponding method" do
        expect(described_class.available.map(&:to_sym)).to include(:tpm_fde)
      end
    end

    context "if TPM full-disk encryption is not available" do
      before do
        allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:available?).and_return(false)
      end

      it "does not include the TPM FDE method" do
        expect(described_class.available.map(&:to_sym)).to_not include(:tpm_fde)
      end
    end
  end

  describe ".find" do
    context "when looking for a known method" do
      it "returns the encryption method" do
        luks1 = described_class.find(:luks1)
        random_swap = described_class.find(:random_swap)
        pervasive_luks2 = described_class.find(:pervasive_luks2)

        expect(luks1).to be_a Y2Storage::EncryptionMethod::Base
        expect(luks1.id).to eq(:luks1)

        expect(random_swap).to be_a Y2Storage::EncryptionMethod::Base
        expect(random_swap.id).to eq(:random_swap)

        expect(pervasive_luks2).to be_a Y2Storage::EncryptionMethod::Base
        expect(pervasive_luks2.id).to eq(:pervasive_luks2)
      end
    end

    context "when looking for an unknown method" do
      it "returns nil" do
        expect(described_class.find("unknown value")).to be_nil
      end
    end
  end

  describe "#create_device" do
    before do
      devicegraph_stub(scenario)
    end

    let(:scenario) { "mixed_disks.yml" }

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:device_name) { "/dev/sda1" }

    let(:device) { devicegraph.find_by_name(device_name) }

    subject { described_class.find(method) }

    context "when using :luks1 method" do
      let(:method) { :luks1 }

      it "returns an encryption device" do
        result = subject.create_device(device, "cr_dev")

        expect(result.is?(:encryption)).to eq(true)
      end

      it "encrypts the given device with LUKS1 encryption" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(device, "cr_dev")

        expect(device.encrypted?).to eq(true)
        expect(device.encryption.type.is?(:luks1)).to eq(true)
      end
    end

    context "when using :luks2 method" do
      let(:method) { :luks2 }

      it "returns an encryption device" do
        result = subject.create_device(device, "cr_dev")

        expect(result.is?(:encryption)).to eq(true)
      end

      it "encrypts the given device with LUKS2 encryption" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(device, "cr_dev")

        expect(device.encrypted?).to eq(true)
        expect(device.encryption.type.is?(:luks2)).to eq(true)
      end

      it "sets the given label and PBKDF for the LUKS2 device" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(
          device, "cr_dev", label: "cool_luks", pbkdf: Y2Storage::PbkdFunction::ARGON2I
        )

        expect(device.encryption.label).to eq "cool_luks"
        expect(device.encryption.pbkdf.value).to eq "argon2i"
      end
    end

    context "when using :tpm_fde method" do
      let(:method) { :tpm_fde }

      it "returns an encryption device" do
        result = subject.create_device(device, "cr_dev")

        expect(result.is?(:encryption)).to eq(true)
      end

      it "encrypts the given device with LUKS2 encryption" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(device, "cr_dev")

        expect(device.encrypted?).to eq(true)
        expect(device.encryption.type.is?(:luks2)).to eq(true)
      end

      it "sets the given label for the LUKS2 device" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(device, "cr_dev", label: "fde_label")

        expect(device.encryption.label).to eq "fde_label"
      end
    end

    shared_examples "swap methods" do
      it "returns an encryption device" do
        result = subject.create_device(device, "cr_dev")

        expect(result.is?(:encryption)).to eq(true)
      end

      it "encrypts the given device with plain encryption" do
        expect(device.encrypted?).to eq(false)

        subject.create_device(device, "cr_dev")

        expect(device.encrypted?).to eq(true)
        expect(device.encryption.type.is?(:plain)).to eq(true)
      end
    end

    context "when using :random_swap method" do
      let(:method) { :random_swap }

      include_examples "swap methods"
    end

    context "when using :protected_swap method" do
      let(:method) { :protected_swap }

      include_examples "swap methods"
    end

    context "when using :secure_swap method" do
      let(:method) { :secure_swap }

      include_examples "swap methods"
    end
  end

  describe "#to_sym" do
    let(:id) { :luks1 }
    let(:encryption_method) { described_class.find(id) }

    it "returns a symbol" do
      expect(encryption_method.to_sym).to be_a Symbol
    end

    it "matches with the encryption method id" do
      expect(encryption_method.to_sym).to eq(id)
    end
  end

  describe "#to_human_string" do
    let(:encryption_method) { described_class.find(:luks1) }

    it "returns the method label" do
      expect(encryption_method.to_human_string).to match(/luks1/i)
    end
  end

  describe "#eql?" do
    let(:luks1_method) { described_class.find(:luks1) }
    let(:random_swap_method) { described_class.find(:random_passwrod) }

    context "when comparing equal methods" do
      let(:luks1_method) { described_class.find(:luks1) }
      let(:another_luks1_method) { described_class.find(:luks1) }

      it "returns true" do
        expect(luks1_method.eql?(another_luks1_method)).to eq(true)
      end
    end

    context "when comparing different methods" do
      let(:luks1_method) { described_class.find(:luks1) }
      let(:random_swap_method) { described_class.find(:random_passwrod) }

      it "returns false" do
        expect(luks1_method.eql?(random_swap_method)).to eq(false)
      end
    end
  end

  describe ".for_device" do
    before do
      devicegraph_stub(scenario)
    end

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
    let(:device) { devicegraph.find_by_name(device_name) }

    context "when the given encryption device is a LUKS1" do
      let(:scenario) { "encrypted_partition.xml" }
      let(:device_name) { "/dev/mapper/cr_sda1" }

      it "returns :luks1 encryption method" do
        encryption_method = described_class.for_device(device)

        expect(encryption_method).to be_a Y2Storage::EncryptionMethod::Base
        expect(encryption_method.to_sym).to eq(:luks1)
      end
    end

    context "when the given encryption device is a plain encrypted swap with random key" do
      let(:scenario) { "encrypted_random_swap.xml" }

      let(:device_name) { "/dev/mapper/cr_vda3" }

      it "returns :random_swap encryption method" do
        encryption_method = described_class.for_device(device)

        expect(encryption_method).to be_a Y2Storage::EncryptionMethod::Base
        expect(encryption_method.to_sym).to eq(:random_swap)
      end
    end

    context "when the given encryption device is a plain encrypted swap with protected key" do
      let(:scenario) { "encrypted_random_swap.xml" }

      let(:device_name) { "/dev/mapper/cr_vda3" }

      before do
        device.key_file = "/sys/devices/virtual/misc/pkey/protkey/protkey_aes_256_xts"
      end

      it "returns :protected_swap encryption method" do
        encryption_method = described_class.for_device(device)

        expect(encryption_method).to be_a Y2Storage::EncryptionMethod::Base
        expect(encryption_method.to_sym).to eq(:protected_swap)
      end
    end

    context "when the given encryption device is a plain encrypted swap with secure key" do
      let(:scenario) { "encrypted_random_swap.xml" }

      let(:device_name) { "/dev/mapper/cr_vda3" }

      before do
        device.key_file = "/sys/devices/virtual/misc/pkey/ccadata/ccadata_aes_256_xts"
      end

      it "returns :secure_swap encryption method" do
        encryption_method = described_class.for_device(device)

        expect(encryption_method).to be_a Y2Storage::EncryptionMethod::Base
        expect(encryption_method.to_sym).to eq(:secure_swap)
      end
    end

    context "when the given encryption device is using pervasive LUKS2 encryption" do
      let(:scenario) { "encrypted_pervasive_luks2.xml" }

      let(:device_name) { "/dev/mapper/cr_ccw-0X0150-part1" }

      it "returns :pervasive_luks2 encryption method" do
        encryption_method = described_class.for_device(device)

        expect(encryption_method).to be_a Y2Storage::EncryptionMethod::Base
        expect(encryption_method.to_sym).to eq(:pervasive_luks2)
      end
    end

    context "when the encryption method cannot be identified" do
      let(:scenario) { "encrypted_random_swap.xml" }

      let(:device_name) { "/dev/mapper/cr_vda3" }

      before do
        device.key_file = "unknown/key/file"
      end

      it "returns nil" do
        expect(described_class.for_device(device)).to be_nil
      end
    end
  end

  describe ".for_crypttab" do
    let(:entry) do
      instance_double(
        Y2Storage::SimpleEtcCrypttabEntry, password: password, crypt_options: crypt_options
      )
    end

    let(:password) { "" }

    let(:crypt_options) { [] }

    context "when the given crypttab entry does not contain 'swap' option" do
      let(:crypt_options) { ["other", "options"] }

      it "returns nil" do
        expect(described_class.for_crypttab(entry)).to be_nil
      end
    end

    context "when the given crypttab entry contains 'swap' option" do
      let(:crypt_options) { ["with", "SWAP"] }

      context "and it indicates the proper key file for random keys" do
        let(:password) { "/dev/urandom" }

        it "returns :random_swap encryption method" do
          encryption_method = described_class.for_crypttab(entry)

          expect(encryption_method).to be_a(Y2Storage::EncryptionMethod::Base)
          expect(encryption_method.to_sym).to eq(:random_swap)
        end
      end

      context "and it indicates the proper key file for protected keys" do
        let(:password) { "/sys/devices/virtual/misc/pkey/protkey/protkey_aes_256_xts" }

        it "returns :protected_swap encryption method" do
          encryption_method = described_class.for_crypttab(entry)

          expect(encryption_method).to be_a(Y2Storage::EncryptionMethod::Base)
          expect(encryption_method.to_sym).to eq(:protected_swap)
        end
      end

      context "and it indicates the proper key file for secure keys" do
        let(:password) { "/sys/devices/virtual/misc/pkey/ccadata/ccadata_aes_256_xts" }

        it "returns :secure_swap encryption method" do
          encryption_method = described_class.for_crypttab(entry)

          expect(encryption_method).to be_a(Y2Storage::EncryptionMethod::Base)
          expect(encryption_method.to_sym).to eq(:secure_swap)
        end
      end

      context "and it indicates another key file" do
        let(:password) { "/other/key_file" }

        it "returns nil" do
          expect(described_class.for_crypttab(entry)).to be_nil
        end
      end
    end
  end

  describe "#ensure_suitable_mount_by" do
    before do
      devicegraph_stub(scenario)

      # Ensure a fixed default
      conf = Y2Storage::StorageManager.instance.configuration
      conf.default_mount_by = Y2Storage::Filesystems::MountByType::UUID
    end

    let(:blk_device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, dev_name) }
    subject(:encryption) { blk_device.encryption }

    context "for a LUKS2 encryption" do
      let(:scenario) { "encrypted_pervasive_luks2.xml" }
      let(:dev_name) { "/dev/dasdc1" }

      it "sets #mount_by to the default UUID if it was previously set to PATH" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::PATH
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:uuid))
      end

      it "leaves #mount_by untouched if it was previously set to UUID" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::UUID
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:uuid))
      end

      context "without a label" do
        it "sets #mount_by to the default UUID if it was previously set to LABEL" do
          encryption.mount_by = Y2Storage::Filesystems::MountByType::LABEL
          encryption.ensure_suitable_mount_by
          expect(encryption.mount_by.is?(:uuid))
        end
      end

      context "with a label" do
        before { expect(encryption).to receive(:label).and_return "something" }

        it "leaves #mount_by untouched if it was previously set to LABEL" do
          encryption.mount_by = Y2Storage::Filesystems::MountByType::LABEL
          encryption.ensure_suitable_mount_by
          expect(encryption.mount_by.is?(:label))
        end
      end
    end

    context "for a random encryption" do
      let(:scenario) { "encrypted_random_swap.xml" }
      let(:dev_name) { "/dev/vda3" }

      it "sets #mount_by to DEVICE if it was previously set to PATH" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::PATH
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:device))
      end

      it "sets #mount_by to DEVICE if it was previously set to UUID" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::UUID
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:device))
      end

      it "sets #mount_by to DEVICE if it was previously set to LABEL" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::LABEL
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:device))
      end

      it "leaves #mount_by untouched if it was previously set to DEVICE" do
        encryption.mount_by = Y2Storage::Filesystems::MountByType::DEVICE
        encryption.ensure_suitable_mount_by
        expect(encryption.mount_by.is?(:device))
      end
    end
  end
end
