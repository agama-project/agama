# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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

describe Y2Storage::EncryptionMethod::SecureSwap do
  include_context "yast2-storage-ng test setup"

  let(:secure_key_file) { subject.key_file }

  describe "#available?" do
    before do
      allow(File).to receive(:exist?).with(secure_key_file).and_return(exist_key_file)
    end

    context "when the key file for secure key is found" do
      let(:exist_key_file) { true }

      it "returns true" do
        expect(subject.available?).to eq(true)
      end
    end

    context "when key file for secure key is not found" do
      let(:exist_key_file) { false }

      it "returns false" do
        expect(subject.available?).to eq(false)
      end
    end
  end

  describe "#only_for_swap?" do
    it "returns true" do
      expect(subject.only_for_swap?).to eq(true)
    end
  end

  describe "#used_for?" do
    let(:encryption) do
      instance_double(Y2Storage::Encryption, key_file: key_file, crypt_options: crypt_options)
    end

    let(:key_file) { nil }

    let(:crypt_options) { [] }

    context "when the given encryption does not contain 'swap' option" do
      let(:crypt_options) { ["something", "else"] }

      it "returns false" do
        expect(subject.used_for?(encryption)).to eq(false)
      end
    end

    context "when the given encryption does not use the key file for secure keys" do
      let(:key_file) { "/dev/other" }

      it "returns false" do
        expect(subject.used_for?(encryption)).to eq(false)
      end
    end

    context "when the given encryption contains 'swap' option and uses the proper key file" do
      let(:crypt_options) { ["a", "SWAP"] }

      let(:key_file) { secure_key_file }

      it "returns true" do
        expect(subject.used_for?(encryption)).to eq(true)
      end
    end
  end

  describe "#used_for_crypttab?" do
    let(:entry) do
      instance_double(
        Y2Storage::SimpleEtcCrypttabEntry, password: password, crypt_options: crypt_options
      )
    end

    let(:password) { nil }

    let(:crypt_options) { [] }

    context "when the given crypttab entry does not contain 'swap' option" do
      let(:crypt_options) { ["something", "else"] }

      it "returns false" do
        expect(subject.used_for_crypttab?(entry)).to eq(false)
      end
    end

    context "when the given crypttab entry does not use the key file for secure keys" do
      let(:password) { "/dev/other" }

      it "returns false" do
        expect(subject.used_for_crypttab?(entry)).to eq(false)
      end
    end

    context "when the given crypttab entry contains 'swap' option and uses the proper key file" do
      let(:crypt_options) { ["a", "SWAP"] }

      let(:password) { secure_key_file }

      it "returns true" do
        expect(subject.used_for_crypttab?(entry)).to eq(true)
      end
    end
  end

  describe "#password_required?" do
    it "returns false" do
      expect(subject.password_required?).to eq(false)
    end
  end
end
