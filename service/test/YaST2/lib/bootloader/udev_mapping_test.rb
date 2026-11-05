# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/udev_mapping"

describe Bootloader::UdevMapping do
  include_context "yast2-bootloader test setup"

  subject { Bootloader::UdevMapping }
  before do
    # Udev mapping is globally mocked in test_helper, so ensure here we test real method.
    allow(Bootloader::UdevMapping).to receive(:to_kernel_device).and_call_original
    allow(Bootloader::UdevMapping).to receive(:to_mountby_device).and_call_original
  end

  describe ".to_kernel_device" do
    before do
      # Y2Storage will ask libstorage-ng to perform a system lookup if the
      # device cannot be found using the information stored in the devicegraph.
      # Unfortunately, that operation misbehaves when executed in an
      # unprivileged Docker container, so we must mock the call.
      allow(Y2Storage::BlkDevice).to receive(:find_by_any_name).and_return nil
    end

    it "return argument for non-udev non-raid mapped device names" do
      expect(subject.to_kernel_device("/dev/sda")).to eq "/dev/sda"
    end

    it "returns the right device name in a multipath environment" do
      devicegraph_stub("multipath.xml")
      expect(subject.to_kernel_device("/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_001"))
        .to eq "/dev/mapper/0QEMU_QEMU_HARDDISK_001"
    end

    it "return kernel device name for udev mapped name" do
      expect(subject.to_kernel_device("/dev/disk/by-uuid/3de29985-8cc6-4c9d-8562-2ede26b0c5b6"))
        .to eq "/dev/sda3"
    end

    it "raise exception if udev link is not known" do
      expect do
        subject.to_kernel_device("/dev/disk/by-id/non-existing-device")
      end.to raise_error(RuntimeError)
    end
  end

  # NOTE: these tests go a bit further of the scope of unit testing, since they rely on
  # functionality from yast2-storage-ng without mocking it. That's justified because three
  # bugs have been reported about the topic (bsc#1151075, bsc#1166096 and bsc#1167779).
  describe ".to_mountby_device" do
    # This mock is not needed, so let's explicitly remove it for clarity
    let(:mount_by) { nil }

    before do
      devicegraph_stub("trivial.xml")

      # find by name creates always new instance, so to make mocking easier, mock it to
      # return always same instance
      allow(Y2Storage::BlkDevice).to receive(:find_by_name).and_return(device)

      # The preferred device name depends on the default mount_by, and such default value
      # depends on the architecture. Setting the default mount_by here to make the tests
      # architecture independent (bsc#1181175).
      storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::UUID
    end

    let(:device) { find_device("/dev/sda3") }
    let(:storage_conf) { Y2Storage::StorageManager.instance.configuration }

    context "when the device is formatted" do
      before do
        # The libstorage-ng bindings constantly create new instances of the storage objects.
        # To make mocking easier, mock it to return always the same instances
        allow(device).to receive(:filesystem).and_return(device.filesystem)
      end

      context "and mounted (or marked to be mounted)" do
        context "and the udev name is available for the mount_by option in the mount point" do
          it "returns the udev name according to the mount_by option in the mount point" do
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-uuid/#{device.filesystem.uuid}"

            device.filesystem.mount_point.mount_by = Y2Storage::Filesystems::MountByType::LABEL
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-label/#{device.filesystem.label}"
          end
        end

        context "and the udev name is not available for the mount by option in the mount point" do
          before do
            device.filesystem.uuid = ""
          end

          it "returns a reasonable fallback name" do
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-label/#{device.filesystem.label}"

            # Even without label
            device.filesystem.label = ""
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-path/pci-1234:56:78.9-ata-1.0-part3"
          end
        end
      end

      context "but not mounted" do
        before { device.filesystem&.remove_mount_point }

        context "and the udev name is available for the default mount_by" do
          before do
            storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::UUID
          end

          it "returns the preferred udev name for the filesystem" do
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-uuid/#{device.filesystem.uuid}"

            storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::PATH
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-path/pci-1234:56:78.9-ata-1.0-part3"
          end
        end

        context "and there is no udev name available honoring the default mount_by" do
          before do
            storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::ID
          end

          it "returns a reasonable fallback name" do
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-uuid/#{device.filesystem.uuid}"

            # Even without UUID
            device.filesystem.uuid = ""
            expect(subject.to_mountby_device(device.name))
              .to eq "/dev/disk/by-label/DATA"
          end
        end
      end
    end

    context "when the device is not formatted" do
      before { device.remove_descendants }

      context "and the udev name is available for the default mount_by" do
        before do
          storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::PATH
        end

        it "returns the preferred udev name for the block device" do
          expect(subject.to_mountby_device(device.name))
            .to eq "/dev/disk/by-path/pci-1234:56:78.9-ata-1.0-part3"
        end
      end

      context "and there is no udev name available honoring the default mount_by" do
        before do
          storage_conf.default_mount_by = Y2Storage::Filesystems::MountByType::UUID
        end

        it "returns a reasonable fallback name" do
          expect(subject.to_mountby_device(device.name))
            .to eq "/dev/disk/by-path/pci-1234:56:78.9-ata-1.0-part3"
        end
      end
    end

    # Regression test for bsc#1166096
    context "for a regular PReP partition (contains no filesystem and is not mounted)" do
      before do
        # First, disable the general mocking
        allow(Y2Storage::BlkDevice).to receive(:find_by_name).and_call_original

        # Then, just stub the whole devicegraph to reproduce the scenario
        devicegraph_stub("bug_1166096.xml")
      end

      # These mocks are not needed
      let(:device) { nil }
      let(:mount_by) { nil }

      it "returns an udev link if there is any available" do
        expect(subject.to_mountby_device("/dev/vda1"))
          .to eq "/dev/disk/by-path/pci-0000:00:06.0-part1"
      end
    end
  end
end
