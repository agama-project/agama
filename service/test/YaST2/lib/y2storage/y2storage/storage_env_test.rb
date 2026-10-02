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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"
require "y2storage/storage_env"

describe Y2Storage::StorageEnv do
  include_context "yast2-storage-ng test setup"

  before do
    mock_env(env_vars)
  end

  describe "#activate_luks?" do
    context "YAST_ACTIVATE_LUKS is not set" do
      let(:env_vars) do
        {}
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.activate_luks?).to be true
      end
    end

    context "YAST_ACTIVATE_LUKS is empty" do
      let(:env_vars) do
        { "YAST_ACTIVATE_LUKS" => "" }
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.activate_luks?).to be true
      end
    end

    context "YAST_ACTIVATE_LUKS is set to '1'" do
      let(:env_vars) do
        { "YAST_ACTIVATE_LUKS" => "1" }
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.activate_luks?).to be true
      end
    end

    context "YAST_ACTIVATE_LUKS is set to '0'" do
      let(:env_vars) do
        { "YAST_ACTIVATE_LUKS" => "0" }
      end

      it "returns false" do
        expect(Y2Storage::StorageEnv.instance.activate_luks?).to be false
      end
    end
  end

  describe "#requested_lvm_reuse" do
    context "YAST_REUSE_LVM is set to '1'" do
      let(:env_vars) do
        { "YAST_REUSE_LVM" => "1" }
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.requested_lvm_reuse).to be true
      end
    end

    context "YAST_REUSE_LVM is set to '0'" do
      let(:env_vars) do
        { "YAST_REUSE_LVM" => "0" }
      end

      it "returns false" do
        expect(Y2Storage::StorageEnv.instance.requested_lvm_reuse).to be false
      end
    end

    context "YAST_REUSE_LVM not set" do
      let(:env_vars) do
        {}
      end

      it "returns nil" do
        expect(Y2Storage::StorageEnv.instance.requested_lvm_reuse).to be nil
      end
    end
  end

  describe "#test_mode?" do
    context "YAST_STORAGE_TEST_MODE is not set" do
      let(:env_vars) do
        {}
      end

      it "returns false" do
        expect(Y2Storage::StorageEnv.instance.test_mode?).to be false
      end
    end

    context "YAST_STORAGE_TEST_MODE is empty" do
      let(:env_vars) do
        { "YAST_STORAGE_TEST_MODE" => "" }
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.test_mode?).to be true
      end
    end

    context "YAST_STORAGE_TEST_MODE is set to '1'" do
      let(:env_vars) do
        { "YAST_STORAGE_TEST_MODE" => "1" }
      end

      it "returns true" do
        expect(Y2Storage::StorageEnv.instance.test_mode?).to be true
      end
    end

    context "YAST_STORAGE_TEST_MODE is set to '0'" do
      let(:env_vars) do
        { "YAST_STORAGE_TEST_MODE" => "0" }
      end

      it "returns false" do
        expect(Y2Storage::StorageEnv.instance.test_mode?).to be false
      end
    end
  end

  describe "#devicegraph_file" do
    context "YAST_DEVICEGRAPH_FILE is not set" do
      let(:env_vars) do
        {}
      end

      it "returns nil" do
        expect(Y2Storage::StorageEnv.instance.devicegraph_file).to be_nil
      end
    end

    context "YAST_DEVICEGRAPH_FILE is empty" do
      let(:env_vars) do
        { "YAST_DEVICEGRAPH_FILE" => "" }
      end

      it "returns nil" do
        expect(Y2Storage::StorageEnv.instance.devicegraph_file).to be_nil
      end
    end

    context "YAST_DEVICEGRAPH_FILE contains a file path" do
      let(:env_vars) do
        { "YAST_DEVICEGRAPH_FILE" => "/tmp/mock.xml" }
      end

      it "returns the path" do
        expect(Y2Storage::StorageEnv.instance.devicegraph_file).to eq "/tmp/mock.xml"
      end
    end
  end
end
