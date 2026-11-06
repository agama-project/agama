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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::EncryptionMethod::TpmFde do
  include_context "yast2-storage-ng test setup"

  describe ".used_for?" do
    let(:encryption) { double(Y2Storage::Encryption, type: type) }

    context "when the encryption type is LUKS1" do
      let(:type) { Y2Storage::EncryptionType::LUKS1 }

      it "returns false" do
        expect(subject.used_for?(encryption)).to eq(false)
      end
    end

    context "when the encryption type is plain" do
      let(:type) { Y2Storage::EncryptionType::PLAIN }

      it "returns false" do
        expect(subject.used_for?(encryption)).to eq(false)
      end
    end

    context "when the encryption type is LUKS2" do
      let(:type) { Y2Storage::EncryptionType::LUKS2 }

      it "returns false" do
        expect(subject.used_for?(encryption)).to eq(false)
      end
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

  describe "#available? and #possible?" do
    before do
      Y2Storage::StorageManager.create_test_instance

      allow(Yast::Execute).to receive(:on_target!).with(/fdectl/, "tpm-present") do
        raise(Cheetah::ExecutionFailed.new("", "", "", "")) unless tpm_present
      end

      allow(Y2Storage::Arch).to receive(:new).and_return(arch)
    end

    let(:arch) { instance_double("Y2Storage::Arch", efiboot?: efi) }

    RSpec.shared_examples "TPM_FDE impossible and not available" do
      it "both #possible? and #available? returns false" do
        expect(subject.available?).to eq false
        expect(subject.possible?).to eq false
      end
    end

    context "if the system boots using EFI" do
      let(:efi) { true }

      context "and there is a working TPM2 chip" do
        let(:tpm_present) { true }

        it "#possible? returns true and #available? returns false" do
          expect(subject.available?).to eq false
          expect(subject.possible?).to eq true
        end
      end

      context "and there is no TPM2 chip" do
        let(:tpm_present) { false }

        include_examples "TPM_FDE impossible and not available"
      end
    end

    context "if the system does not use EFI" do
      let(:efi) { false }

      context "and there is a working TPM2 chip" do
        let(:tpm_present) { true }

        include_examples "TPM_FDE impossible and not available"
      end

      context "and there is no TPM2 chip" do
        let(:tpm_present) { false }

        include_examples "TPM_FDE impossible and not available"
      end
    end
  end
end
