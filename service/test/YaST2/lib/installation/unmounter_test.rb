# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../test_helper"
require "installation/unmounter"

describe Installation::Unmounter do
  PROC_MOUNTS_PATH = File.join(FIXTURES_PATH, "yast2", "proc-mounts")
  PREFIX = "/mnt"

  def stored_proc_mounts(scenario)
    File.join(PROC_MOUNTS_PATH, "proc-mounts-#{scenario}-raw.txt")
  end

  def mount(mount_path)
    Installation::Unmounter::Mount.new("/dev/something", mount_path, "FooFS")
  end

  let(:proc_mounts) { nil }

  describe "#new" do
    let(:subject) { described_class.new(PREFIX, proc_mounts) }

    context "empty" do
      it "does not crash and burn" do
        expect(subject.mounts).to eq []
      end
    end

    context "before the installation is executed" do
      let(:proc_mounts) { stored_proc_mounts("inst") }

      it "does not find any relevant mounts" do
        expect(subject.mounts).to eq []
      end
    end

    context "when reading the actual /proc/mounts file" do
      let(:proc_mounts) { "/proc/mounts" }

      it "ignores /proc and /sys" do
        expect(subject.ignored_paths).to include("/proc", "/sys")
        # With checking for /, /proc, /sys, /dev this failed in Jenkins
        # because that environment only seems to have /proc, /sys, /dev/pts, /dev/shm,
        # so this test checks only for the least common denominator between
        # a sane Linux system and that Jenkins environment.
      end

      # Don't check in this context that there is nothing to unmount:
      # The machine that executes the test might actually have something mounted at /mnt.
    end
  end

  describe "#mnt_prefix" do
    it "leaves a normal mount prefix as it is" do
      um = described_class.new("/foo", nil)
      expect(um.mnt_prefix).to eq "/foo"
    end

    it "strips off one trailing slash" do
      um = described_class.new("/foo/", nil)
      expect(um.mnt_prefix).to eq "/foo"
    end

    it "even fixes up insanely broken prefixes" do
      um = described_class.new("/foo///bar///", nil)
      expect(um.mnt_prefix).to eq "/foo/bar"
    end

    it "leaves a root directory prefix as it is" do
      um = described_class.new("/", nil)
      expect(um.mnt_prefix).to eq "/"
    end
  end

  describe "#ignore?" do
    let(:subject) { described_class.new("/mnt", nil) }

    it "does not ignore /mnt" do
      expect(subject.ignore?(mount("/mnt"))).to eq false
    end

    it "does not ignore /mnt/foo" do
      expect(subject.ignore?(mount("/mnt/foo"))).to eq false
    end

    it "ignores /mnt2" do
      expect(subject.ignore?(mount("/mnt2"))).to eq true
    end

    it "ignores /mnt2/foo" do
      expect(subject.ignore?(mount("/mnt2"))).to eq true
    end

    it "ignores an empty path" do
      expect(subject.ignore?(mount(""))).to eq true
    end
  end

  describe "#add_mount and #clear" do
    before(:all) do
      # Start with a completely empty unmounter
      # and keep it alive between the tests of this group
      @unmounter = described_class.new(PREFIX, nil)
    end

    it "starts completely empty" do
      expect(@unmounter.mounts).to eq []
      expect(@unmounter.ignored_mounts).to eq []
      expect(@unmounter.unmount_paths).to eq []
      expect(@unmounter.ignored_paths).to eq []
    end

    it "/ is ignored" do
      @unmounter.add_mount("/dev/sdx1 / ext4 defaults 0 0")
      expect(@unmounter.mounts).to eq []
      expect(@unmounter.unmount_paths).to eq []
      expect(@unmounter.ignored_paths).to eq ["/"]
    end

    it "/home is ignored" do
      @unmounter.add_mount("/dev/sdx2 /home ext4 defaults 0 0")
      expect(@unmounter.mounts).to eq []
      expect(@unmounter.unmount_paths).to eq []
      expect(@unmounter.ignored_paths).to eq ["/", "/home"]
    end

    it "/mnt will be unmounted" do
      @unmounter.add_mount("/dev/sdy1 /mnt ext4 defaults 0 0")
      expect(@unmounter.unmount_paths).to eq ["/mnt"]
      expect(@unmounter.ignored_paths).to eq ["/", "/home"]
    end

    it "/mnt/boot will be unmounted" do
      @unmounter.add_mount("/dev/sdy2 /mnt/boot ext4 defaults 0 0")
      expect(@unmounter.unmount_paths).to eq ["/mnt/boot", "/mnt"]
      expect(@unmounter.ignored_paths).to eq ["/", "/home"]
    end

    it "/mnt/boot/usb will be unmounted" do
      @unmounter.add_mount("/dev/sdy2 /mnt/boot/usb ext4 defaults 0 0")
      expect(@unmounter.unmount_paths).to eq ["/mnt/boot/usb", "/mnt/boot", "/mnt"]
      expect(@unmounter.ignored_paths).to eq ["/", "/home"]
    end

    it "#clear clears everything" do
      @unmounter.clear
      expect(@unmounter.mounts).to eq []
      expect(@unmounter.ignored_mounts).to eq []
      expect(@unmounter.unmount_paths).to eq []
      expect(@unmounter.ignored_paths).to eq []
    end
  end

  describe "common scenarios" do
    let(:subject) { described_class.new(PREFIX, proc_mounts) }

    context "partition-based btrfs with subvolumes, no separate /home" do
      let(:proc_mounts) { stored_proc_mounts("btrfs") } # see fixtures/yast2/proc-mounts/
      let(:expected_result) do
        %w[/mnt/run
           /mnt/sys
           /mnt/proc
           /mnt/dev
           /mnt/var
           /mnt/usr/local
           /mnt/tmp
           /mnt/srv
           /mnt/root
           /mnt/opt
           /mnt/home
           /mnt/boot/grub2/x86_64-efi
           /mnt/boot/grub2/i386-pc
           /mnt/.snapshots
           /mnt]
      end

      it "will unmount /mnt/run, /mnt/sys, /mnt/proc, /mnt/dev, all subvolumes, /mnt" do
        expect(subject.unmount_paths).to eq expected_result
      end
    end

    context "partition-based btrfs with subvolumes and separate xfs /home" do
      let(:proc_mounts) { stored_proc_mounts("btrfs-xfs-home") }
      let(:expected_result) do
        %w[/mnt/run
           /mnt/sys
           /mnt/proc
           /mnt/dev
           /mnt/var
           /mnt/usr/local
           /mnt/tmp
           /mnt/srv
           /mnt/root
           /mnt/opt
           /mnt/home
           /mnt/boot/grub2/x86_64-efi
           /mnt/boot/grub2/i386-pc
           /mnt]
      end

      it "will unmount /mnt/run, /mnt/sys, /mnt/proc, /mnt/dev, all subvolumes, /mnt/home, /mnt" do
        expect(subject.unmount_paths).to eq expected_result
      end
    end

    context "encrypted LVM with btrfs with subvolumes and separate btrfs /home" do
      let(:proc_mounts) { stored_proc_mounts("btrfs-xfs-home") }
      let(:expected_result) do
        %w[/mnt/run
           /mnt/sys
           /mnt/proc
           /mnt/dev
           /mnt/var
           /mnt/usr/local
           /mnt/tmp
           /mnt/srv
           /mnt/root
           /mnt/opt
           /mnt/home
           /mnt/boot/grub2/x86_64-efi
           /mnt/boot/grub2/i386-pc
           /mnt]
      end

      it "will unmount /mnt/run, /mnt/sys, /mnt/proc, /mnt/dev, all subvolumes, /mnt/home, /mnt" do
        expect(subject.unmount_paths).to eq expected_result
      end
    end
  end
end
