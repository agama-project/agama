#!/usr/bin/env rspec
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
require "yast"
require "y2storage/encryption_processes/fde_tools_config"

describe Y2Storage::EncryptionProcesses::FdeToolsConfig do
  include_context "yast2-storage-ng test setup"

  before { Y2Storage::StorageManager.create_test_instance }
  subject { described_class.instance }

  describe "#pbkd_function" do
    before do
      allow(Yast::SCR).to receive(:Read) { |p| expect(p.to_s).to match(/fde-tools.FDE_LUKS_PBKDF/) }
        .and_return(value)
    end

    let(:value) { nil }

    it "returns a PbkdFunction object" do
      expect(subject.pbkd_function).to be_a(Y2Storage::PbkdFunction)
    end

    context "when there is a value for FDE_LUKS_PBKDF at the fde-tools config file" do
      context "and the value corresponds to a known derivation function" do
        let(:value) { "Argon2i" }

        it "returns the corresponding PbkdFunction object" do
          expect(subject.pbkd_function.is?(:argon2i)).to eq(true)
        end
      end

      context "and the value does not correspond to any known derivation function" do
        let(:value) { "foo" }

        it "returns the default pbkdf2 object" do
          expect(subject.pbkd_function.is?(:pbkdf2)).to eq(true)
        end
      end
    end

    context "when there is no value for FDE_LUKS_PBKDF at the fde-tools config file" do
      let(:value) { nil }

      it "returns the default pbkdf2 object" do
        expect(subject.pbkd_function.is?(:pbkdf2)).to eq(true)
      end
    end
  end

  describe "#pbkd_function=" do
    before { allow(Yast::SCR).to receive(:Write) }

    it "stores the corresponding value for FDE_LUKS_PBKDF at the fde-tools config file" do
      expect(Yast::SCR).to receive(:Write) do |path, value|
        expect(path.to_s).to match(/fde-tools.FDE_LUKS_PBKDF/)
        expect(value).to eq("argon2id")
      end

      subject.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
    end
  end

  describe "#devices" do
    before do
      allow(Yast::SCR).to receive(:Read) { |p| expect(p.to_s).to match(/fde-tools.FDE_DEVS/) }
        .and_return(value)
    end

    context "when there is a value for FDE_DEVS at the fde-tools config file" do
      context "and the value is an empty string" do
        let(:value) { "" }

        it "returns an empty array" do
          expect(subject.devices).to eq []
        end
      end

      context "and the value contains just a device name" do
        let(:value) { "/dev/sda" }

        it "returns an array with the device name as only element" do
          expect(subject.devices).to eq ["/dev/sda"]
        end
      end

      context "and the value contains several space-separated device names" do
        let(:value) { "/dev/sda2 /dev/sdb2    /dev/sdc2" }

        it "returns an array with all the device names" do
          expect(subject.devices).to eq ["/dev/sda2", "/dev/sdb2", "/dev/sdc2"]
        end
      end
    end

    context "when there is no value for FDE_DEVS at the fde-tools config file" do
      let(:value) { nil }

      it "returns an empty array" do
        expect(subject.devices).to eq []
      end
    end
  end

  describe "#devices=" do
    before { allow(Yast::SCR).to receive(:Write) }

    it "stores the elements of the given array as space-separated strings at FDE_DEVS" do
      expect(Yast::SCR).to receive(:Write) do |path, value|
        expect(path.to_s).to match(/fde-tools.FDE_DEVS/)
        expect(value).to eq("/dev/one /dev/two")
      end

      subject.devices = ["/dev/one", "/dev/two"]
    end
  end
end
