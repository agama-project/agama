# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

describe Y2Storage::EncryptionMethod::TpmBls do
  include_context "yast2-storage-ng test setup"

  describe "#initialize" do
    it "sets the correct encryption method id" do
      expect(subject.id).to eq(:tpm_bls)
    end

    it "sets a descriptive name" do
      expect(subject.to_human_string).to match(/BLS.*TPM/i)
    end
  end

  describe ".used_for?" do
    let(:encryption) { instance_double(Y2Storage::Encryption) }

    it "returns false" do
      expect(subject.used_for?(encryption)).to eq(false)
    end
  end

  describe ".only_for_swap?" do
    it "returns false" do
      expect(subject.only_for_swap?).to eq(false)
    end
  end

  describe "#password_required?" do
    it "returns true" do
      expect(subject.password_required?).to eq(true)
    end
  end

  describe "#possible?" do
    subject { described_class.new }

    before do
      Y2Storage::StorageManager.create_test_instance

      allow(Y2Storage::Tpm).to receive(:instance).and_return(tpm)
      allow(Y2Storage::Arch).to receive(:new).and_return(arch)
    end

    let(:tpm) { instance_double(Y2Storage::Tpm, policy_authorize_nv?: policy_authorize_nv) }
    let(:arch) { instance_double(Y2Storage::Arch, efiboot?: efi) }

    context "when the system boots using EFI and has usable TPM2" do
      let(:efi) { true }
      let(:policy_authorize_nv) { true }

      it "returns true" do
        expect(subject.possible?).to eq(true)
      end
    end

    context "when the system boots using EFI but TPM does not support PolicyAuthorizeNV" do
      let(:efi) { true }
      let(:policy_authorize_nv) { false }

      it "returns false" do
        expect(subject.possible?).to eq(false)
      end
    end

    context "when the system has usable TPM2 but does not use EFI" do
      let(:efi) { false }
      let(:policy_authorize_nv) { true }

      it "returns false" do
        expect(subject.possible?).to eq(false)
      end
    end

    context "when the system does not use EFI and has no usable TPM2" do
      let(:efi) { false }
      let(:policy_authorize_nv) { false }

      it "returns false" do
        expect(subject.possible?).to eq(false)
      end
    end
  end

  describe "#available?" do
    it "returns false" do
      expect(subject.available?).to eq(false)
    end
  end

  describe "#create_device" do
    before do
      Y2Storage::StorageManager.create_test_instance

      allow(Y2Storage::EncryptionProcesses::Sdboot).to receive(:new)
        .with(subject)
        .and_return(encryption_process)
    end

    let(:blk_device) { instance_double(Y2Storage::BlkDevice) }
    let(:dm_name) { "cr_test" }
    let(:encryption_process) { instance_double(Y2Storage::EncryptionProcesses::Sdboot) }
    let(:encrypted_device) { instance_double(Y2Storage::Encryption) }

    it "delegates to the encryption process" do
      expect(encryption_process).to receive(:create_device)
        .with(blk_device, dm_name, hash_including(pbkdf: nil, label: ""))
        .and_return(encrypted_device)

      result = subject.create_device(blk_device, dm_name)
      expect(result).to eq(encrypted_device)
    end

    it "passes pbkdf parameter to the encryption process" do
      pbkdf = instance_double(Y2Storage::PbkdFunction)

      expect(encryption_process).to receive(:create_device)
        .with(blk_device, dm_name, hash_including(pbkdf: pbkdf, label: ""))
        .and_return(encrypted_device)

      subject.create_device(blk_device, dm_name, pbkdf: pbkdf)
    end

    it "passes label parameter to the encryption process" do
      label = "test_label"

      expect(encryption_process).to receive(:create_device)
        .with(blk_device, dm_name, hash_including(pbkdf: nil, label: label))
        .and_return(encrypted_device)

      subject.create_device(blk_device, dm_name, label: label)
    end
  end
end
