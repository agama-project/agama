#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2020] SUSE LLC
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

describe Y2Storage::Filesystems::Base do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "mixed_disks_btrfs" }

  let(:blk_device) { fake_devicegraph.find_by_name("/dev/sda2") }

  subject(:filesystem) { blk_device.blk_filesystem }

  describe "#free_space" do
    context "#detect_space_info succeed" do
      it "return #detect_space_info#free" do
        fake_space = double(free: Y2Storage::DiskSize.MiB(5))
        allow(filesystem).to receive(:detect_space_info).and_return(fake_space)

        expect(filesystem.free_space).to eq Y2Storage::DiskSize.MiB(5)
      end
    end

    context "#detect_space_info failed" do
      before do
        allow(filesystem).to receive(:detect_space_info).and_raise(Storage::Exception, "error")
      end

      context "it is on block devices" do
        context "detect_resize_info succeed" do
          it "returns size minus minimum resize size" do
            size = Y2Storage::DiskSize.MiB(10)
            allow(filesystem).to receive(:detect_resize_info).and_return(double(min_size: size))

            expect(filesystem.free_space).to eq(blk_device.size - size)
          end
        end

        context "detect_resize_info failed" do
          it "returns zero" do
            allow(filesystem).to receive(:detect_resize_info).and_raise(Storage::Exception, "Error")

            expect(filesystem.free_space).to be_zero
          end
        end
      end

      context "it is not on block device" do
        let(:scenario) { "nfs1.xml" }
        subject(:filesystem) { fake_devicegraph.filesystems.find { |f| f.mount_path == "/test1" } }

        it "returns zero" do

          expect(filesystem.free_space).to be_zero
        end
      end
    end
  end

  describe "#root_suitable?" do
    before do
      allow(subject).to receive(:type).and_return(type)
    end

    let(:type) { instance_double(Y2Storage::Filesystems::Type, root_ok?: suitable) }

    context "when the type is suitable for root" do
      let(:suitable) { true }

      it "returns true" do
        expect(subject.root_suitable?).to eq(true)
      end
    end

    context "when the type is not suitable for root" do
      let(:suitable) { false }

      it "returns false" do
        expect(subject.root_suitable?).to eq(false)
      end
    end
  end

  describe "#windows_suitable?" do
    before do
      allow(subject).to receive(:type).and_return(type)
    end

    let(:type) { instance_double(Y2Storage::Filesystems::Type, windows_ok?: type_suitable) }

    context "when the type is not suitable for Windows" do
      let(:type_suitable) { false }

      it "returns false" do
        expect(subject.windows_suitable?).to eq(false)
      end
    end

    context "when the type is suitable for Windows" do
      let(:type_suitable) { true }

      before do
        allow(subject).to receive(:blk_devices).and_return([blk_device])

        allow(blk_device).to receive(:windows_suitable?).and_return(device_suitable)
      end

      context "but its device is not suitable for Windows" do
        let(:device_suitable) { false }

        it "returns false" do
          expect(subject.windows_suitable?).to eq(false)
        end
      end

      context "and its device is suitable for Windows" do
        let(:device_suitable) { true }

        it "returns true" do
          expect(subject.windows_suitable?).to eq(true)
        end
      end
    end
  end

  shared_examples "creating_reader" do |tested_method|
    it "creates a filesystem reader only the first time is called" do
      expect(Y2Storage::FilesystemReader).to receive(:new).once.and_return(reader)

      subject.public_send(tested_method)
      subject.public_send(tested_method)
      subject.public_send(tested_method)
    end
  end

  describe "#windows_system?" do
    before do
      allow(subject).to receive(:windows_suitable?).and_return(suitable)
    end

    context "when the filesystem is not suitable for Windows" do
      let(:suitable) { false }

      it "returns false" do
        expect(subject.windows_system?).to eq(false)
      end
    end

    context "when the filesystem is suitable for Windows" do
      let(:suitable) { true }

      before do
        allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
      end

      let(:reader) { double(Y2Storage::FilesystemReader, windows?: windows).as_null_object }

      context "but it does not contain a Windows" do
        let(:windows) { false }

        include_examples "creating_reader", :windows_system?

        it "returns false" do
          expect(subject.windows_system?).to eq(false)
        end
      end

      context "and it contains a Windows" do
        let(:windows) { true }

        include_examples "creating_reader", :windows_system?

        it "returns true" do
          expect(subject.windows_system?).to eq(true)
        end
      end
    end

    context "when the filesystem is BitLocker" do
      before do
        allow(subject).to receive(:type).and_return(type)
      end

      let(:suitable) { true }
      let(:type) { instance_double(Y2Storage::Filesystems::Type, to_sym: :bitlocker) }

      it "returns true" do
        expect(subject.windows_system?).to eq(true)
      end
    end
  end

  context "#linux_system?" do
    before do
      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) { double(Y2Storage::FilesystemReader, release_name: release_name).as_null_object }

    context "when the filesystem contains a release name" do
      let(:release_name) { "Linux" }

      include_examples "creating_reader", :linux_system?

      it "returns true" do
        expect(subject.linux_system?).to eq(true)
      end
    end

    context "when the filesystem does not contain a release name" do
      let(:release_name) { nil }

      include_examples "creating_reader", :linux_system?

      it "returns false" do
        expect(subject.linux_system?).to eq(false)
      end
    end
  end

  context "#system_name" do
    before do
      allow(subject).to receive(:windows_suitable?).and_return(true)

      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) do
      double(Y2Storage::FilesystemReader,
        windows?:     windows,
        release_name: release_name).as_null_object
    end

    context "when the filesystem contains a Windows" do
      let(:windows) { true }

      let(:release_name) { nil }

      include_examples "creating_reader", :system_name

      it "returns 'Windows'" do
        expect(subject.system_name).to eq("Windows")
      end
    end

    context "when the filesystem contains a Linux" do
      let(:windows) { false }

      let(:release_name) { "Linux" }

      include_examples "creating_reader", :system_name

      it "returns the Linux release name" do
        expect(subject.system_name).to eq("Linux")
      end
    end
  end

  context "#release_name" do
    before do
      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) { double(Y2Storage::FilesystemReader, release_name: release_name).as_null_object }

    context "when the filesystem contains a release name" do
      let(:release_name) { "Linux" }

      include_examples "creating_reader", :release_name

      it "returns the release name" do
        expect(subject.release_name).to eq("Linux")
      end
    end

    context "when the filesystem does not contain a release name" do
      let(:release_name) { nil }

      include_examples "creating_reader", :release_name

      it "returns nil" do
        expect(subject.release_name).to be_nil
      end
    end
  end

  context "#rpi_boot?" do
    before do
      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) { double(Y2Storage::FilesystemReader, rpi_boot?: rpi_boot).as_null_object }

    context "when the filesystem contains files for rpi bootloader" do
      let(:rpi_boot) { true }

      include_examples "creating_reader", :rpi_boot?

      it "returns true" do
        expect(subject.rpi_boot?).to eq(true)
      end
    end

    context "when the filesystem does not contain files for rpi bootloader" do
      let(:rpi_boot) { false }

      include_examples "creating_reader", :rpi_boot?

      it "returns false" do
        expect(subject.rpi_boot?).to eq(false)
      end
    end
  end

  shared_examples "creating_temporary_file" do |tested_method|
    it "creates a temporary files only the first time is called" do
      allow(Tempfile).to receive(:open).with("yast-storage-ng").once.and_yield(file)

      subject.public_send(tested_method)
      subject.public_send(tested_method)
      subject.public_send(tested_method)
    end
  end

  context "#fstab" do
    before do
      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) { double(Y2Storage::FilesystemReader, fstab: fstab_content).as_null_object }

    context "when the filesystem contains a fstab" do
      let(:fstab_content) { "fstab content" }

      before do
        allow(Tempfile).to receive(:open).with("yast-storage-ng").and_yield(file)

        allow(Y2Storage::Fstab).to receive(:new).with(file.path, subject).and_return(fstab)
      end

      let(:file) { double("Tempfile", path: "/tmp/something").as_null_object }

      let(:fstab) { instance_double(Y2Storage::Fstab) }

      include_examples "creating_reader", :fstab

      it "saves the fstab content into a temporary file" do
        expect(file).to receive(:write).with(fstab_content)

        subject.fstab
      end

      include_examples "creating_temporary_file", :fstab

      it "returns a Fstab object created from the temporary file" do
        expect(subject.fstab).to eq(fstab)
      end
    end

    context "when the filesystem does not contain a fstab" do
      let(:fstab_content) { nil }

      include_examples "creating_reader", :fstab

      it "returns nil" do
        expect(subject.fstab).to be_nil
      end
    end
  end

  context "#crypttab" do
    before do
      allow(Y2Storage::FilesystemReader).to receive(:new).with(subject).and_return(reader)
    end

    let(:reader) { double(Y2Storage::FilesystemReader, crypttab: crypttab_content).as_null_object }

    context "when the filesystem contains a crypttab" do
      let(:crypttab_content) { "crypttab content" }

      before do
        allow(Tempfile).to receive(:open).with("yast-storage-ng").and_yield(file)

        allow(Y2Storage::Crypttab).to receive(:new).with(file.path, subject).and_return(crypttab)
      end

      let(:file) { double("Tempfile", path: "/tmp/something").as_null_object }

      let(:crypttab) { instance_double(Y2Storage::Crypttab) }

      include_examples "creating_reader", :crypttab

      it "saves the crypttab content into a temporary file" do
        expect(file).to receive(:write).with(crypttab_content)

        subject.crypttab
      end

      include_examples "creating_temporary_file", :crypttab

      it "returns a Crypttab object created from the temporary file" do
        expect(subject.crypttab).to eq(crypttab)
      end
    end

    context "when the filesystem does not contain a crypttab" do
      let(:crypttab_content) { nil }

      include_examples "creating_reader", :crypttab

      it "returns nil" do
        expect(subject.crypttab).to be_nil
      end
    end
  end
end
