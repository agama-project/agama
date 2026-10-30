#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

require "y2storage/clients/inst_prepdisk"

Yast.import "Installation"

describe Y2Storage::Clients::InstPrepdisk do
  include_context "yast2-storage-ng test setup"

  subject(:client) { described_class.new }

  describe "#run" do
    before do
      Y2Storage::StorageManager.create_test_instance
      Y2Storage::StorageManager.instance.probe
      allow(storage_manager).to receive(:commit).and_return committed
      allow(Yast::Installation).to receive(:destdir).and_return "/dest"
      allow(Yast::SCR).to receive(:Execute).and_return(true)
      allow(Yast::Mode).to receive(:update).and_return(mode == :update)
      allow_any_instance_of(Y2Storage::Devicegraph).to receive(:save)
    end

    let(:storage_manager) { Y2Storage::StorageManager.instance }
    let(:committed) { true }

    context "in installation mode" do
      let(:mode) { :installation }

      it "uses the destination directory to mount and prepare the result" do
        expect(storage_manager).to receive(:rootprefix=).with("/dest")
        client.run
      end

      it "commits all libstorage pending changes" do
        expect(storage_manager).to receive(:commit)
        client.run
      end

      it "returns :next if everything goes fine" do
        expect(client.run).to eq :next
      end

      context "if libstorage-ng fails and the user decides to abort" do
        let(:committed) { false }

        it "returns :abort" do
          expect(client.run).to eq :abort
        end
      end
    end

    context "in update mode" do
      let(:mode) { :update }

      it "does not change libstorage root prefix" do
        expect(storage_manager).not_to receive(:rootprefix=)
        client.run
      end

      it "does not commit anything" do
        expect(storage_manager).not_to receive(:commit)
        client.run
      end

      it "returns :auto" do
        expect(client.run).to eq(:auto)
      end
    end
  end

  describe "#efivarvs_support?" do
    it "returns true if efivarfs is in /proc/filesystems" do
      allow(File).to receive(:readlines).and_return(["ext2", "efivarfs"])
      expect(client.send(:efivarfs_support?)).to be true
    end

    it "returns false if efivarfs is not in /proc/filesystems" do
      allow(File).to receive(:readlines).and_return(["ext2", "xfs"])
      expect(client.send(:efivarfs_support?)).to be false
    end

    it "returns false if /proc/filesystems does not exist" do
      allow(File).to receive(:readlines).and_raise Errno::ENOENT
      expect(client.send(:efivarfs_support?)).to be false
    end
  end

  describe "#mount_in_target" do
    before do
      # Make sure the check for the mount point is successful
      allow(Yast::FileUtils).to receive(:Exists).and_return(true)
    end

    it "Does not show a warning dialog if the mount was successful" do
      allow(Yast::SCR).to receive(:Execute).and_return(true)
      expect(Yast::Report).not_to receive(:Warning)
      client.send(:mount_in_target, "/proc", "proc", "")
    end

    it "Shows a warning dialog if the mount failed" do
      allow(Yast::SCR).to receive(:Execute).and_return(false)
      expect(Yast::Report).to receive(:Warning)
      client.send(:mount_in_target, "/proc", "proc", "")
    end
  end
end
