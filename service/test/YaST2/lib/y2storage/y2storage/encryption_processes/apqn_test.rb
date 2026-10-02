#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2020] SUSE LLC
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

describe Y2Storage::EncryptionProcesses::Apqn do
  include_context "yast2-storage-ng test setup"

  def lszcrypt(file)
    File.read(File.join(DATA_PATH, "lszcrypt", "#{file}.txt"))
  end

  before do
    Y2Storage::StorageManager.create_test_instance

    allow(Yast::Execute).to receive(:locally!).with(/lszcrypt/,
      anything).and_return(lszcrypt_output)
    allow(File).to receive(:read).and_call_original
    allow(File).to receive(:read).with(/^\/sys\/bus\/ap\/devices\/card/).and_return ""
  end

  let(:lszcrypt_output) { lszcrypt("cca-and-ep11") }

  describe ".all" do
    it "returns a list of Apqn objets" do
      expect(described_class.all).to all(be_a(Y2Storage::EncryptionProcesses::Apqn))
    end

    it "returns all available APQNs" do
      expect(described_class.all.map(&:name)).to contain_exactly("01.0001", "01.0002", "02.0001")
    end

    context "when the command to find APQNs fails" do
      before do
        allow(Yast::Execute).to receive(:locally!).with(/lszcrypt/, anything)
          .and_raise(Cheetah::ExecutionFailed.new("", "", "", ""))
      end

      it "returns an empty list" do
        expect(described_class.all).to be_empty
      end
    end
  end

  describe ".online" do
    it "returns all online APQNs" do
      expect(described_class.online.map(&:name)).to contain_exactly("01.0001", "02.0001")
    end
  end

  subject { described_class.new(name, "type", mode, status) }

  let(:name) { "01.0001" }
  let(:status) { "online" }
  let(:mode) { "CCA-Coproc" }

  describe "#name" do
    it "returns the APQN name" do
      expect(subject.name).to eq("01.0001")
    end
  end

  describe "online?" do
    context "when the APQN is online" do
      let(:status) { "online" }

      it "returns true" do
        expect(subject.online?).to eq(true)
      end
    end

    context "when the APQN is offline" do
      let(:status) { "offline" }

      it "returns false" do
        expect(subject.online?).to eq(false)
      end
    end
  end

  describe "ep11?" do
    context "when the APQN mode is CCA-Coproc" do
      let(:mode) { "CCA-Coproc" }

      it "returns false" do
        expect(subject.ep11?).to eq false
      end
    end

    context "when the APQN is EP11-Coproc" do
      let(:mode) { "EP11-Coproc" }

      it "returns true" do
        expect(subject.ep11?).to eq(true)
      end
    end
  end

  describe "#read_master_keys" do
    def mkvps(file)
      File.read(File.join(DATA_PATH, "mkvps", "#{file}.txt"))
    end

    before do
      allow(File).to receive(:read).with(/^\/sys\/bus\/ap\/devices\/card/).and_return mkvps_content
    end

    context "for a CCA APQN with a valid key" do
      let(:mkvps_content) { mkvps("cca-valid1") }

      it "sets the verification pattern to the right value" do
        subject.read_master_keys
        expect(subject.master_key_pattern).to eq "0xd2344556789008"
      end
    end

    context "for a CCA APQN with no valid key" do
      let(:mkvps_content) { mkvps("cca-invalid") }

      it "sets the verification pattern to nil" do
        subject.read_master_keys
        expect(subject.master_key_pattern).to be_nil
      end
    end

    context "for a EP11 APQN with a valid key" do
      let(:mkvps_content) { mkvps("ep11-valid1") }
      let(:mode) { "EP11-Coproc" }

      it "sets the verification pattern to the right value" do
        subject.read_master_keys
        expect(subject.master_key_pattern).to start_with "0xbcd32323232325"
      end
    end

    context "for a EP11 APQN with no valid key" do
      let(:mkvps_content) { mkvps("ep11-invalid") }
      let(:mode) { "EP11-Coproc" }

      it "sets the verification pattern to nil" do
        subject.read_master_keys
        expect(subject.master_key_pattern).to be_nil
      end
    end

    context "when failing to read the master key" do
      let(:mkvps_content) { "" }
      before do
        allow(File).to receive(:read).with(/^\/sys\/bus\/ap\/devices\/card/).and_raise(an_error)
      end
      let(:an_error) { SystemCallError.new("") }

      it "sets the verification pattern to nil" do
        subject.read_master_keys
        expect(subject.master_key_pattern).to be_nil
      end
    end
  end
end
