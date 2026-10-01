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
require "transfer/file_from_url"
require "fileutils"
require "tmpdir"

describe Yast::Transfer::FileFromUrl do
  Yast.import "Installation"

  before do
    stub_const("Yast::FTP", double(fake_method: nil))
    stub_const("Yast::HTTP", double(Get: nil))
    stub_const("Yast::TFTP", double(Get: nil))
  end

  class FileFromUrlTest
    include Yast::I18n
    include Yast::Transfer::FileFromUrl

    # adaptor for existing tests
    # rubocop:disable Naming/MethodName
    def Get(scheme, host, urlpath, localfile, destdir: "/destdir")
      get_file_from_url(scheme: scheme, host: host, urlpath: urlpath,
        localfile: localfile,
        urltok: {}, destdir: destdir)
    end
    # rubocop:enable Naming/MethodName
  end

  let(:destdir) { "/destdir" }

  # avoid BuildRequiring a package that we stub entirely anyway
  before do
    allow(Yast).to receive(:import).and_call_original
  end

  subject { FileFromUrlTest.new }

  describe "#Get" do
    before do
      expect(Yast::WFM).to receive(:Read).with(path(".local.tmpdir"), [])
        .and_return(tmpdir)
      expect(Yast::WFM).to receive(:SCRGetDefault)
        .and_return(333)
      expect(Yast::WFM).to receive(:SCRGetName).with(333)
        .and_return("chroot=/mnt:scr")
      allow(Yast::WFM).to receive(:Execute)
        .with(path(".local.mkdir"), "#{destdir}/tmp_dir/tmp_mount")
      # the local/target mess was last modified in
      # https://github.com/yast/yast-autoinstallation/commit/69f1966dd1456301a69102c6d3bacfe7c9f9dc49
      # for https://bugzilla.suse.com/show_bug.cgi?id=829265

      allow(Yast::Execute).to receive(:new).and_return(execute_object)
    end

    let(:tmpdir) { "/tmp_dir" }
    let(:execute_object) { Yast::Execute.new }

    it "returns false for unknown scheme" do
      expect(subject.Get("money_transfer_protocol",
        "bank", "account", "pocket")).to eq(false)
    end

    context "when scheme is 'device'" do
      let(:scheme) { "device" }

      it "returns false for an empty path" do
        expect(subject.Get(scheme, "sda", "", "/localfile")).to eq(false)
      end

      context "when host is empty" do
        let(:host) { "" }

        it "probes disks" do
          probed_disks = [
            {},
            { "dev_name" => "/dev/sda" },
            { "dev_name" => "/dev/sdb" }
          ]

          expect(Yast::SCR).to receive(:Read)
            .with(path(".probe.disk"))
            .and_return(probed_disks)

          lstat_mocks = {
            "/dev/sda1" => true,
            "/dev/sda2" => false,
            "/dev/sda3" => false,
            "/dev/sda4" => true,
            "/dev/sda5" => true,
            "/dev/sda6" => false,

            "/dev/sdb1" => true,
            "/dev/sdb2" => false,
            "/dev/sdb3" => false,
            "/dev/sdb4" => false,
            "/dev/sdb5" => false
          }

          lstat_mocks.each do |device, exists|
            expect(Yast::SCR).to receive(:Read)
              .with(path(".target.lstat"), device).twice
              .and_return(exists ? { "size" => 1 } : {})
          end

          allow(Yast::SCR).to receive(:Dir)
            .with(path(".product.features.section")).and_return([])

          # only up to sda5 because that is when we find the file
          mount_points = {
            # device    => [prior mount point, temporary mount point]
            "/dev/sda"  => ["",          "/tmp_dir/tmp_mount"],
            "/dev/sda1" => ["/mnt_sda1", nil],
            "/dev/sda4" => ["",          "/mnt_sda1"],
            "/dev/sda5" => ["",          "/mnt_sda1"]
          }

          mount_points.each do |device, mp|
            expect(execute_object).to receive(:stdout)
              .with("/usr/bin/findmnt", "--first-only", "--noheadings", "--output=target", device)
              .and_return(mp.first)
          end

          # only up to sda5 because that is when we find the file
          mount_succeeded = {
            "/dev/sda"  => false,
            "/dev/sda4" => true,
            "/dev/sda5" => true
          }

          mount_succeeded.each do |device, result|
            expect(Yast::SCR).to receive(:Execute)
              .with(path(".target.mount"),
                [device, mount_points[device].last],
                "-o noatime")
              .and_return(result)
          end

          expect(Yast::WFM).to receive(:Execute)
            .with(path(".local.bash"),
              "/bin/cp /mnt_sda1/mypath /localfile")
            .exactly(3).times
            .and_return(1, 1, 0) # sda1 fails, sda4 fails, sda5 succeeds

          expect(Yast::WFM).to receive(:Execute)
            .with(path(".local.bash"),
              #                  "/bin/cp /destdir/tmp_dir/tmp_mount/mypath /localfile")
              # Bug: it is wrong if destdir is used
              "/bin/cp /tmp_dir/tmp_mount/mypath /localfile")
            .exactly(0).times
          #            .and_return(1, 0)   # sda4 fails, sda5 succeeds

          # Bug: local is wrong. nfs and cifs correctly use .target.umount
          expect(Yast::WFM).to receive(:Execute)
            .with(path(".local.umount"), "/mnt_sda1")
            .exactly(2).times

          # DO IT, this is the call that needs all the above mocking
          expect(subject.Get(scheme, host, "mypath", "/localfile"))
            .to eq(true)
        end

      end

      context "when host specifies a device"

      context "when host+path specify a device"
    end

    context "when scheme is 'usb'" do
      let(:scheme) { "usb" }

      it "returns false for an empty path" do
        expect(subject.Get(scheme, "sda", "", "/localfile")).to eq(false)
      end
    end

    # not yet covered
    context "when scheme is 'http' or 'https'"
    context "when scheme is 'ftp'"
    context "when scheme is 'file'" do
      let(:scheme) { "file" }
      let(:cd_device) { "/dev/sr0" }
      let(:tmp_mount) { File.join(tmpdir, "tmp_mount") }
      let(:destination) { File.join(dir, "dest") }
      let(:source) { File.join(dir, "source") }
      let(:dir) { Dir.mktmpdir }

      before do
        allow(Yast::Installation).to receive(:sourcedir).and_return(File.join(dir, "mnt"))
        allow(Yast::Installation).to receive(:boot).and_return("cd")
        allow(Yast::InstURL).to receive("installInf2Url").and_return("cd:/?devices=#{cd_device}")
        allow(Yast::Builtins).to receive(:sleep).with(3000)

        allow(Yast::SCR).to receive(:Execute)
          .with(path(".target.bash"), /bin\/cp/) do |*args|
          cmd = args.last
          _, from, to = cmd.split
          begin
            FileUtils.cp(from, to)
          rescue Errno::ENOENT
            nil
          end
        end

        allow(Yast::WFM).to receive(:Execute)
          .with(path(".local.mount"), anything).and_return(false)
      end

      after do
        FileUtils.remove_entry(dir)
      end

      context "when the source file exists in the installation sourcedir" do
        before do
          inst_source = File.join(Yast::Installation.sourcedir, source)
          FileUtils.mkdir_p(File.dirname(inst_source))
          File.write(inst_source, "sourcedir")
        end

        it "tries to copy the file from the installation sourcedir" do
          expect(subject.Get(scheme, "", source, destination)).to eq(true)
          expect(File.read(destination)).to eq("sourcedir")
        end
      end

      context "when the source file exists" do
        before { File.write(source, "testing") }

        it "copies the file to the given destination and returns true" do
          expect(subject.Get(scheme, "", source, destination)).to eq(true)
          expect(File.read(destination)).to eq("testing")
        end
      end

      context "when the source file does not exist" do
        it "returns false" do
          expect(subject.Get(scheme, "", source, destination)).to eq(false)
        end
      end

      context "when the destination directory does not exist" do
        let(:destination) { File.join(dir, "not", "a", "directory") }

        before { File.write(source, "testing") }

        it "returns false" do
          expect(subject.Get(scheme, "", source, destination)).to eq(false)
        end
      end

      context "when the file cannot be copied and the installation medium is a CD/DVD" do
        let(:mounts) { "" }
        let(:tmpdir) { File.join(dir, "tmp") }
        let(:source_on_dvd) { File.join(tmp_mount, source) }

        before do
          allow(Yast::WFM).to receive(:Execute).with(path(".local.mkdir"), anything)
          allow(Yast::WFM).to receive(:Execute)
            .with(path(".local.mount"), anything).and_return(true)
          allow(File).to receive(:read).and_call_original
          allow(File).to receive(:read).with("/proc/mounts").and_return(mounts)

          FileUtils.mkdir_p(File.dirname(source_on_dvd))
          File.write(source_on_dvd, "testing")
        end

        it "tries to copy the file from the CD/DVD" do
          expect(Yast::WFM).to receive(:Execute)
            .with(Yast::Path.new(".local.mount"), [cd_device, tmp_mount,
                                                   Yast::Installation.mountlog])
            .and_return(true)
          expect(Yast::WFM).to receive(:Execute).with(path(".local.umount"), anything)

          expect(subject.Get(scheme, "", source, destination))
          expect(File.read(destination)).to eq("testing")
        end

        context "and the CD/DVD is already mounted" do
          let(:mounts) do
            "#{cd_device} /mounts/mp_0005 iso9660 ro,relatime 0 0\n" \
              "#{cd_device} /mounts/mp_0006 iso9660 ro,relatime 0 0"
          end

          it "bind mounts the CD/DVD and tries to copy the file from it" do
            expect(Yast::SCR).to receive(:Execute)
              .with(path(".target.bash_output"),
                "/bin/mount -v --bind /mounts/mp_0005 #{tmp_mount}")
              .and_return("exit" => 0, "stdout" => "ok")
            expect(Yast::WFM).to receive(:Execute).with(path(".local.umount"), anything)

            expect(subject.Get(scheme, "", source, destination)).to eq(true)
            expect(File.read(destination)).to eq("testing")
          end
        end
      end
    end

    context "when scheme is 'nfs'" do
      let(:scheme) { "nfs" }
      let(:host) { "myhost" }
      let(:tmp_mount) { File.join(tmpdir, "tmp_mount") }
      let(:localfile) { File.join(dir, "dest") }
      let(:source) { File.join(dir, "source") }
      let(:dir) { Dir.mktmpdir }
      let(:destdir) { Dir.mktmpdir("chroot") }

      before do
        FileUtils.mkdir_p(File.join(destdir, tmp_mount))
        FileUtils.touch(File.join(destdir, tmp_mount, "source"))

        allow(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.mount"), any_args
        ).and_return(true)

        allow(Yast::WFM).to receive(:Execute).with(
          Yast::Path.new(".local.bash"),
          "/bin/cp #{destdir}#{tmp_mount}/source #{localfile}"
        ).and_call_original

        allow(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.umount"), tmp_mount
        ).and_return(true)
      end

      it "mounts the file system and copies the file" do
        expect(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.mount"),
          ["#{host}:#{dir}/", tmp_mount], "-o noatime,nolock"
        ).and_return(true)

        expect(Yast::WFM).to receive(:Execute).with(
          Yast::Path.new(".local.bash"),
          "/bin/cp #{destdir}#{tmp_mount}/source #{localfile}"
        ).and_call_original

        expect(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.umount"), tmp_mount
        ).and_return(true)

        expect(subject.Get(scheme, host, source, localfile, destdir: destdir)).to eq(true)
        expect(File).to exist(localfile)
      end

      context "when an IPv4 address is given" do
        let(:host) { "192.168.1.1" }

        it "passes the address to the mount command" do
          expect(Yast::SCR).to receive(:Execute).with(
            Yast::Path.new(".target.mount"),
            ["#{host}:#{dir}/", tmp_mount], "-o noatime,nolock"
          ).and_return(true)

          expect(subject.Get(scheme, host, source, localfile, destdir: destdir)).to eq(true)
        end
      end

      context "when an IPv6 address is given" do
        let(:host) { "fd12:3456:789a:1::1" }

        it "passes the address between square brackets" do
          expect(Yast::SCR).to receive(:Execute).with(
            Yast::Path.new(".target.mount"),
            ["[#{host}]:#{dir}/", tmp_mount], "-o noatime,nolock"
          ).and_return(true)

          expect(subject.Get(scheme, host, source, localfile, destdir: destdir)).to eq(true)
        end
      end
    end

    context "when scheme is cifs" do
      let(:scheme) { "cifs" }
      let(:host) { "myhost" }
      let(:tmp_mount) { File.join(tmpdir, "tmp_mount") }
      let(:localfile) { File.join(dir, "dest") }
      let(:source) { File.join(dir, "source") }
      let(:dir) { Dir.mktmpdir }
      let(:destdir) { Dir.mktmpdir("chroot") }

      before do
        FileUtils.mkdir_p(File.join(destdir, tmp_mount))
        FileUtils.touch(File.join(destdir, tmp_mount, "source"))

        allow(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.mount"), any_args
        ).and_return(true)

        allow(Yast::WFM).to receive(:Execute).with(
          Yast::Path.new(".local.bash"),
          "/bin/cp #{destdir}#{tmp_mount}/source #{localfile}"
        ).and_call_original

        allow(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.umount"), tmp_mount
        ).and_return(true)
      end

      it "mounts the file system and copies the file" do
        expect(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.mount"),
          ["//#{host}#{dir}/", tmp_mount], "-t cifs -o guest,ro,noatime"
        ).and_return(true)

        expect(Yast::WFM).to receive(:Execute).with(
          Yast::Path.new(".local.bash"),
          "/bin/cp #{destdir}#{tmp_mount}/source #{localfile}"
        ).and_call_original

        expect(Yast::SCR).to receive(:Execute).with(
          Yast::Path.new(".target.umount"), tmp_mount
        ).and_return(true)

        expect(subject.Get(scheme, host, source, localfile, destdir: destdir)).to eq(true)
        expect(File).to exist(localfile)
      end
    end
    context "when scheme is 'floppy'"
    context "when scheme is 'tftp'"
  end
end
