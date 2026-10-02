#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"

describe Y2Storage::FilesystemReader do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)

    allow(Yast::Execute).to receive(:locally!)

    allow(Yast::OSRelease).to receive(:ReleaseName).and_return(release_name)

    allow(File).to receive(:exist?).and_return(true)
    allow(File).to receive(:readlines).and_return([])

    allow(filesystem).to receive(:windows_suitable?).and_return(windows_suitable)
    allow(filesystem).to receive(:detect_content_info).and_return(content_info)
  end

  let(:release_name) { "" }

  let(:content_info) { instance_double(Storage::ContentInfo, windows?: windows_content) }

  let(:windows_content) { false }

  let(:windows_suitable) { false }

  subject { described_class.new(filesystem) }

  let(:filesystem) { device.filesystem }

  let(:device) { fake_devicegraph.find_by_name(device_name) }

  let(:scenario) { "windows-linux-free-pc" }

  let(:device_name) { "/dev/sda3" }

  describe "#windows?" do
    context "when the filesystem is not suitable for Windows" do
      let(:windows_suitable) { false }

      it "returns false" do
        expect(subject.windows?).to eq(false)
      end
    end

    context "when the filesystem is suitable for Windows" do
      let(:windows_suitable) { true }

      context "and the filesystem contains a Windows system" do
        let(:windows_content) { true }

        it "returns true" do
          expect(subject.windows?).to eq(true)
        end
      end

      context "and the filesystem does not contain a Windows system" do
        let(:windows_content) { false }

        it "returns false" do
          expect(subject.windows?).to eq(false)
        end
      end

      context "and the filesystem content cannot be inspected" do
        before do
          allow(filesystem).to receive(:detect_content_info).and_raise(Storage::Exception)
        end

        it "returns false" do
          expect(subject.windows?).to eq(false)
        end
      end
    end
  end

  let(:cheetah_error) { Cheetah::ExecutionFailed.new([], "", nil, nil) }

  let(:mount_cmd) { ["/usr/bin/mount", "-o", "ro", "UUID=#{filesystem.uuid}", "/mnt"] }

  let(:umount_cmd) { ["/usr/bin/umount", "-R", "/mnt"] }

  RSpec.shared_examples "mounting" do |tested_method|
    context "first time that is called" do
      it "mounts the filesystem" do
        expect(Yast::Execute).to receive(:locally!).with(*mount_cmd)

        subject.public_send(tested_method)
      end

      it "umounts the filesystem" do
        expect(Yast::Execute).to receive(:locally!).with(*umount_cmd)

        subject.public_send(tested_method)
      end

      context "when mount fails" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd).and_raise(cheetah_error)
        end

        it "does not raise an error" do
          expect { subject.public_send(tested_method) }.to_not raise_error
        end

        it "does not try to umount the filesystem" do
          expect(Yast::Execute).to_not receive(:locally!).with(*umount_cmd)

          subject.public_send(tested_method)
        end
      end

      context "when umount fails" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*umount_cmd).and_raise(cheetah_error)
        end

        it "does not raise an error" do
          expect { subject.public_send(tested_method) }.to_not raise_error
        end
      end
    end

    context "next time that is called" do
      it "does not mount the filesystem again" do
        expect(Yast::Execute).to receive(:locally!).with(*mount_cmd).once

        subject.public_send(tested_method)
        subject.public_send(tested_method)
      end
    end
  end

  describe "#release_name" do
    context "when the filesystem contains a Windows system" do
      let(:windows_suitable) { true }

      let(:windows_content) { true }

      it "returns nil" do
        expect(subject.release_name).to be_nil
      end
    end

    context "when the filesystem does not contain a Windows system" do
      let(:windows_suitable) { false }

      include_examples "mounting", :release_name

      context "and the filesystem is correctly mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd)

          allow(File).to receive(:exist?).with(/os-release/).and_return(os_release_exist)
        end

        context "and the os-release file exists" do
          let(:os_release_exist) { true }

          let(:release_name) { "Open SUSE" }

          it "returns the release name" do
            expect(subject.release_name).to eq(release_name)
          end
        end

        context "and the os-release file does not exist" do
          let(:os_release_exist) { false }

          it "returns nil" do
            expect(subject.release_name).to be_nil
          end
        end
      end

      context "and the filesystem cannot be mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd).and_raise(cheetah_error)
        end

        it "returns nil" do
          expect(subject.release_name).to be_nil
        end
      end
    end
  end

  describe "#rpi_boot?" do
    context "when the filesystem contains a Windows system" do
      let(:windows_suitable) { true }

      let(:windows_content) { true }

      it "returns false" do
        expect(subject.rpi_boot?).to eq(false)
      end
    end

    context "when the filesystem does not contain a Windows system" do
      let(:windows_suitable) { false }

      include_examples "mounting", :rpi_boot?

      context "and the filesystem is correctly mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd)

          allow(File).to receive(:exist?) do |name|
            existing_files.include?(name)
          end
        end

        context "but there is no file called bootcode.bin or BOOTCODE.bin" do
          let(:existing_files) { ["/mnt/foo", "/mnt/bar"] }

          it "returns false" do
            expect(subject.rpi_boot?).to eq(false)
          end
        end

        context "and there is a file called bootcode.bin" do
          let(:existing_files) { ["/mnt/foo", "/mnt/bar", "/mnt/bootcode.bin"] }

          it "returns true" do
            expect(subject.rpi_boot?).to eq(true)
          end
        end

        context "and there is a file called BOOTCODE.BIN" do
          let(:existing_files) { ["/mnt/BOOTCODE.BIN"] }

          it "returns true" do
            expect(subject.rpi_boot?).to eq(true)
          end
        end
      end

      context "and the filesystem cannot be mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd).and_raise(cheetah_error)
        end

        it "returns false" do
          expect(subject.rpi_boot?).to eq(false)
        end
      end
    end
  end

  describe "#fstab" do
    context "when the filesystem contains a Windows system" do
      let(:windows_suitable) { true }

      let(:windows_content) { true }

      it "returns nil" do
        expect(subject.fstab).to be_nil
      end
    end

    context "when the filesystem does not contain a Windows system" do
      let(:windows_suitable) { false }

      include_examples "mounting", :fstab

      context "and the filesystem is correctly mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd)

          allow(File).to receive(:exist?).with("/mnt/etc/fstab").and_return(exists_fstab)
        end

        context "and the fstab file does not exist" do
          let(:exists_fstab) { false }

          it "returns nil" do
            expect(subject.fstab).to be_nil
          end
        end

        context "and the fstab file exists" do
          let(:exists_fstab) { true }

          before do
            allow(File).to receive(:readlines).with("/mnt/etc/fstab").and_return(["fstab ",
                                                                                  "content"])
          end

          it "returns the fstab content" do
            expect(subject.fstab).to eq("fstab content")
          end
        end
      end
    end
  end

  describe "#crypttab" do
    context "when the filesystem contains a Windows system" do
      let(:windows_suitable) { true }

      let(:windows_content) { true }

      it "returns nil" do
        expect(subject.crypttab).to be_nil
      end
    end

    context "when the filesystem does not contain a Windows system" do
      let(:windows_suitable) { false }

      include_examples "mounting", :crypttab

      context "and the filesystem is correctly mounted" do
        before do
          allow(Yast::Execute).to receive(:locally!).with(*mount_cmd)

          allow(File).to receive(:exist?).with("/mnt/etc/crypttab").and_return(exists_crypttab)
        end

        context "and the crypttab file does not exist" do
          let(:exists_crypttab) { false }

          it "returns nil" do
            expect(subject.crypttab).to be_nil
          end
        end

        context "and the crypttab file exists" do
          let(:exists_crypttab) { true }

          before do
            allow(File)
              .to receive(:readlines).with("/mnt/etc/crypttab").and_return(["crypttab ", "content"])
          end

          it "returns the crypttab content" do
            expect(subject.crypttab).to eq("crypttab content")
          end
        end
      end
    end
  end
end
