# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

describe Y2Storage::EncryptionMethod::SystemdFde do
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

  describe "#available?" do
    before do
      allow(Y2Storage::Arch).to receive(:new).and_return(arch)
    end
    let(:arch) { instance_double("Y2Storage::Arch", efiboot?: efi) }

    context "if the system boots using EFI" do
      let(:efi) { true }

      it "#available? returns true" do
        expect(subject.available?).to eq true
      end
    end

    context "if the system does not use EFI" do
      let(:efi) { false }

      it "#available? returns false" do
        expect(subject.available?).to eq false
      end
    end
  end
end
