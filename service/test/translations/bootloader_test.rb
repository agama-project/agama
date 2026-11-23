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

# This test documents (and guards) the call paths that make a string marked for translation in the
# vendored yast2-bootloader code (service/YaST2, textdomain "bootloader") reach the output of the
# D-Bus service. See service/translations.md.
#
# There are two outputs:
#
# * The details of the "bootloaderInstallError" question that Agama::Storage::Finisher creates
#   when Bootloader::FinishClient#write fails (the details are the exception message).
# * The message of the exception that escapes from the D-Bus methods which configure the
#   bootloader (Agama::Storage::BootloaderManager#configure). ruby-dbus rescues the exception in
#   DBus::Object#dispatch and sends its message as the D-Bus error message.
#
# Each example runs the real code and checks the (English) text in the output. Additionally, it
# checks (with BootloaderTextdomainProbe) whether `textdomain "bootloader"` was configured on the
# object that called `_()`. If it was not, the string can never be translated.

require_relative "../test_helper"
require_relative "../YaST2/lib/bootloader/support/shared_setup"
require_relative "../agama/storage/storage_helpers"
require_relative "bootloader_helpers"
require "agama/config"
require "agama/answer"
require "agama/http/clients/questions"
require "agama/dbus/storage/manager"
require "agama/storage/finisher"
require "agama/storage/manager"
require "bootloader/bootloader_factory"
require "bootloader/exceptions"
require "bootloader/finish_client"
require "bootloader/grub2"
require "bootloader/grub2bls"
require "bootloader/grub2efi"
require "bootloader/udev_mapping"
require "bootloader/systemdboot"
require "installation/cio_ignore"
require "tmpdir"
require "y2storage"
require "fileutils"

Yast.import "BootStorage"
Yast.import "Installation"
Yast.import "Kernel"
Yast.import "Stage"

# Runs Agama::Storage::Finisher with the bootloader step as the only active one
RSpec.shared_context "bootloader finisher flow" do
  include_context "yast2-bootloader test setup"
  include BootloaderExecuteHelpers

  let(:logger) { Logger.new($stdout, level: :fatal) }
  let(:config) { instance_double(Agama::Config) }
  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }
  let(:questions) { [] }
  let(:destdir) { Dir.mktmpdir("agama-bootloader-test") }
  let(:s390) { false }
  let(:stage_initial) { false }
  let(:current_name) { "grub2" }
  let(:system_bl) { Bootloader::Grub2.new }

  # Texts of the details of the questions created by the finisher
  def details
    questions.map { |q| q.data["details"] }
  end

  def run_finisher
    finisher = Agama::Storage::Finisher.new(logger, config, questions_client: questions_client)
    allow(finisher).to receive(:on_target).and_yield
    finisher.run
  end

  before do
    BootloaderTextdomainProbe.start

    allow(questions_client).to receive(:ask) do |question|
      questions << question
      Agama::Answer.new(:skip)
    end

    klass = Agama::Storage::Finisher
    [klass::CopyFilesStep, klass::StorageStep, klass::IscsiStep, klass::SnapshotsStep].each do |k|
      allow_any_instance_of(k).to receive(:run?).and_return(false)
    end

    allow(Yast::Mode).to receive(:update).and_return(false)
    allow(Yast::Stage).to receive(:initial).and_return(stage_initial)
    allow(Yast::Arch).to receive(:architecture).and_return(s390 ? "s390_64" : "x86_64")
    allow(Yast::Arch).to receive(:s390).and_return(s390)
    allow(Yast::Installation).to receive(:destdir).and_return(destdir)
    # Never touch the real system (e.g. /etc/machine-id)
    allow(Yast::SCR).to receive(:Execute)
    allow_any_instance_of(Installation::CIOIgnoreFinish).to receive(:run)

    Bootloader::BootloaderFactory.current_name = current_name
    allow(Bootloader::BootloaderFactory).to receive(:system).and_return(system_bl)
  end

  after do
    BootloaderTextdomainProbe.stop
    FileUtils.rm_rf(destdir)
    Bootloader::BootloaderFactory.clear_cache
    Bootloader::BootloaderFactory.current = nil
  end
end

describe "Translated bootloader texts in the questions of Agama::Storage::Finisher" do
  include_context "bootloader finisher flow"

  let(:probe) { BootloaderTextdomainProbe }

  # Stubs the writing of the GRUB2 files, so only the commands run by the code are relevant.
  def stub_grub_files
    allow_any_instance_of(CFA::Grub2::Default).to receive(:save)
    allow_any_instance_of(Bootloader::GRUB2Pwd).to receive(:write)
    allow(Bootloader::Pmbr).to receive(:write_efi)
    allow(Bootloader::Pmbr).to receive(:write_none_efi)
  end

  context "when configuring the reboot on s390" do
    let(:s390) { true }

    # finish_client.rb:102 (textdomain at finish_client.rb:27)
    it "returns \"Failed to configure reipl:\"" do
      fake_execute(["chreipl"])
      run_finisher

      expect(details.first).to start_with("Failed to configure reipl:\nCommand `[\"chreipl\"")
      expect(probe.translatable?("Failed to configure reipl:")).to eq(true)
    end
  end

  context "when regenerating the initrd fails" do
    before do
      allow(system_bl).to receive(:read)
      allow(system_bl).to receive(:merge)
      allow(system_bl).to receive(:write)
      fake_execute(["/usr/bin/dracut"])
    end

    # exceptions.rb:50 (called before the textdomain call at exceptions.rb:19)
    it "returns \"Regenerating initrd with dracut failed.\" (never translated)" do
      run_finisher

      expect(details.first).to start_with("Regenerating initrd with dracut failed.\nCommand")
      expect(probe.never_translated?("Regenerating initrd with dracut failed.")).to eq(true)
    end
  end

  context "when generating the GRUB2 configuration fails" do
    let(:system_bl) { Bootloader::Grub2EFI.new }

    before do
      allow(system_bl).to receive(:read)
      allow(system_bl).to receive(:merge)
      stub_grub_files
      fake_execute(["/usr/sbin/grub2-mkconfig"])
    end

    # exceptions.rb:43 (called before the textdomain call at exceptions.rb:19)
    it "returns \"Generating GRUB2 configuration failed.\" (never translated)" do
      run_finisher

      expect(details.first).to start_with(
        "Generating GRUB2 configuration failed.\nCommand `[\"/usr/sbin/grub2-mkconfig\""
      )
      expect(probe.never_translated?("Generating GRUB2 configuration failed.")).to eq(true)
    end
  end

  context "when installing GRUB2 fails" do
    let(:system_bl) { Bootloader::Grub2EFI.new }

    before do
      allow(system_bl).to receive(:read)
      allow(system_bl).to receive(:merge)
      stub_grub_files
      allow(Bootloader::Systeminfo).to receive(:shim_needed?).and_return(false)
      fake_execute(["/usr/sbin/grub2-install"])
    end

    # exceptions.rb:36 (called before the textdomain call at exceptions.rb:19)
    it "returns \"Installing GRUB2 failed.\" (never translated)" do
      run_finisher

      expect(details.first).to start_with(
        "Installing GRUB2 failed.\nCommand `[\"/usr/sbin/grub2-install\""
      )
      expect(probe.never_translated?("Installing GRUB2 failed.")).to eq(true)
    end
  end

  context "when setting the default GRUB2 entry fails" do
    let(:system_bl) { Bootloader::Grub2EFI.new }

    before do
      allow(system_bl).to receive(:read)
      allow(system_bl).to receive(:merge)
      stub_grub_files
      system_bl.sections.default = "openSUSE"
      fake_execute(["/usr/sbin/grub2-set-default"])
    end

    # sections.rb:55 (textdomain at sections.rb:26)
    it "returns \"Failed to set default GRUB2 boot entry:\"" do
      run_finisher

      expect(details.first).to start_with("Failed to set default GRUB2 boot entry:\nCommand")
      expect(probe.translatable?("Failed to set default GRUB2 boot entry:")).to eq(true)
    end
  end
end

describe "Translated bootloader texts in the questions of Agama::Storage::Finisher (reading)" do
  include_context "bootloader finisher flow"

  let(:probe) { BootloaderTextdomainProbe }

  context "when /etc/default/grub is missing in the installed system" do
    let(:system_bl) { Bootloader::Grub2EFI.new }

    before do
      allow_any_instance_of(CFA::Grub2::Default).to receive(:load).and_raise(Errno::ENOENT)
      fake_execute
    end

    # grub2base.rb:95 (textdomain at grub2base.rb:65)
    it "returns \"File /etc/default/grub missing on system\"" do
      run_finisher

      expect(details.first).to include("Details: File /etc/default/grub missing on system")
      expect(probe.translatable?("File /etc/default/grub missing on system")).to eq(true)
    end

    # exceptions.rb:82 (textdomain at exceptions.rb:79)
    it "returns the \"Error reading the bootloader configuration files\" message" do
      run_finisher

      expect(details.first).to eq(
        "Error reading the bootloader configuration files. " \
        "Please use YaST2 bootloader to fix it. " \
        "Details: File /etc/default/grub missing on system"
      )
      expect(probe.translatable?(
        "Error reading the bootloader configuration files. " \
        "Please use YaST2 bootloader to fix it. Details: %s"
      )).to eq(true)
    end
  end

  context "when the devices of the installed GRUB2 use a by-path name" do
    let(:system_bl) { Bootloader::Grub2.new }
    let(:by_path) { "/dev/disk/by-path/pci-0000:00:1f.2-ata-1" }

    before do
      allow(system_bl).to receive(:read)
      allow(system_bl).to receive(:merge)
      allow(system_bl.stage1).to receive(:devices).and_return([by_path])
      allow(system_bl.device_map).to receive(:write)
      allow_any_instance_of(CFA::Grub2::Default).to receive(:save)
      allow_any_instance_of(Bootloader::GRUB2Pwd).to receive(:write)
      fake_execute
    end

    # exceptions.rb:98 (textdomain at exceptions.rb:95)
    it "returns the \"Invalid device name\" message" do
      run_finisher

      expect(details.first).to start_with(
        "Error reading the bootloader configuration files:\n" \
        "Invalid device name #{by_path}\n\n" \
        "This by-path device name may have changed after a reboot\n" \
        "if the hardware or kernel parameters changed.\n\n" \
        "Please use YaST2 bootloader to fix this."
      )
      expect(probe.translatable?(
        "Error reading the bootloader configuration files:\n" \
        "Invalid device name %s\n\n" \
        "This by-path device name may have changed after a reboot\n" \
        "if the hardware or kernel parameters changed.\n\n" \
        "Please use YaST2 bootloader to fix this.\n"
      )).to eq(true)
    end
  end
end

describe "Translated bootloader texts in the questions of Agama::Storage::Finisher (sdbootutil)" do
  include_context "bootloader finisher flow"

  let(:probe) { BootloaderTextdomainProbe }
  let(:sdbootutil) { "/usr/bin/sdbootutil" }
  let(:current_name) { "systemd-boot" }
  let(:system_bl) { Bootloader::SystemdBoot.new }
  let(:stage_initial) { true }
  let(:entries) do
    '[{"type":"type1","title":"openSUSE","id":"opensuse.conf"}]'
  end

  # The texts of the Bootloader::Bls class methods are marked in a class which extends Yast::I18n
  # (bls.rb:16), but "textdomain" is only called for the instances (bls.rb:21). So, they are never
  # translated.
  def expect_never_translated(msgid)
    expect(details.first).to start_with("#{msgid}\nCommand `[")
    expect(probe.never_translated?(msgid)).to eq(true)
  end

  before do
    allow(Yast::BootStorage).to receive(:root_partitions).and_return([double(name: "/dev/sda2")])
    FileUtils.mkdir_p(File.join(destdir, "etc/kernel"))
    allow(system_bl).to receive(:merge)
    allow(Bootloader::Pmbr).to receive(:write_efi)
  end

  context "when reading the system" do
    before do
      allow(Bootloader::Systeminfo).to receive(:secure_boot_active?).and_return(false)
      allow(Bootloader::Systeminfo).to receive(:update_nvram_active?).and_return(false)
    end

    # bls.rb:68
    it "returns \"Cannot read default menu:\"" do
      fake_execute([sdbootutil, "get-default"])
      run_finisher

      expect_never_translated("Cannot read default menu:")
    end

    # bls.rb:51
    it "returns \"Cannot read boot menu timeout:\"" do
      fake_execute([sdbootutil, "get-timeout"])
      run_finisher

      expect_never_translated("Cannot read boot menu timeout:")
    end
  end

  context "when writing the system" do
    before do
      allow(system_bl).to receive(:read)
      fake_execute
    end

    # bls.rb:33
    it "returns \"Cannot install bootloader:\"" do
      fake_execute([sdbootutil, "install"])
      run_finisher

      expect_never_translated("Cannot install bootloader:")
    end

    # bls.rb:27
    it "returns \"Cannot create boot menu entry:\"" do
      fake_execute([sdbootutil, "add-all-kernels"])
      run_finisher

      expect_never_translated("Cannot create boot menu entry:")
    end

    # bls.rb:45
    it "returns \"Cannot write boot menu timeout:\"" do
      fake_execute([sdbootutil, "set-timeout"])
      run_finisher

      expect_never_translated("Cannot write boot menu timeout:")
    end

    # bls.rb:60
    it "returns \"Cannot write default boot menu entry:\"" do
      sections = system_bl.sections
      sections.instance_variable_set(:@data, [{ "title" => "openSUSE", "id" => "opensuse.conf" }])
      sections.default = "openSUSE"
      fake_execute([sdbootutil, "set-default"])
      run_finisher

      expect_never_translated("Cannot write default boot menu entry:")
    end

    # bls.rb:110
    it "returns \"Cannot create machine-id:\"" do
      fake_execute(["/bin/systemd-machine-id-setup"])
      run_finisher

      expect_never_translated("Cannot create machine-id:")
    end

    context "with an encrypted device using systemd-fde" do
      let(:password) { "secret" }
      let(:authentication) { "tpm2" }
      let(:encryption) do
        double(
          "encryption",
          method:         double(id: :systemd_fde),
          authentication: double(value: authentication),
          password:       password,
          blk_device:     double(name: "/dev/sda2")
        )
      end

      before do
        staging = double("staging", encryptions: [encryption])
        allow(Y2Storage::StorageManager.instance).to receive(:staging).and_return(staging)
      end

      # bls.rb:115
      context "and an empty password" do
        let(:password) { "" }

        it "returns \"Cannot pass an empty password via the keyring.\"" do
          fake_execute
          run_finisher

          expect(details.first).to eq("Cannot pass an empty password via the keyring.")
          expect(probe.never_translated?("Cannot pass an empty password via the keyring."))
            .to eq(true)
        end
      end

      # bls.rb:122
      it "returns \"Cannot pass the password via the keyring:\"" do
        fake_execute(["keyctl"])
        run_finisher

        expect_never_translated("Cannot pass the password via the keyring:")
      end

      # bls.rb:99
      it "returns \"Cannot enroll authentication:\"" do
        fake_execute([sdbootutil, "enroll"])
        run_finisher

        expect_never_translated("Cannot enroll authentication:")
      end
    end
  end

  context "when updating GRUB2 with BLS in an already installed system" do
    let(:current_name) { "grub2-bls" }
    let(:system_bl) { Bootloader::Grub2Bls.new }
    let(:stage_initial) { false }

    before do
      allow(system_bl).to receive(:read)
      fake_execute([sdbootutil, "update-all-entries"])
    end

    # bls.rb:39
    it "returns \"Cannot update bootloader:\"" do
      run_finisher

      expect_never_translated("Cannot update bootloader:")
    end
  end
end

describe "Translated bootloader texts in the errors of the D-Bus storage methods" do
  include Agama::RSpec::StorageHelpers

  subject(:dbus_manager) { Agama::DBus::Storage::Manager.new(backend, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :fatal) }
  let(:backend) { Agama::Storage::Manager.new(logger: logger) }
  let(:probe) { BootloaderTextdomainProbe }

  before do
    allow_any_instance_of(DBus::Object).to receive(:emit)
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
    allow(Bootloader::Systeminfo).to receive(:efi?).and_return(false)
    allow(Bootloader::OsProber).to receive(:package_available=)
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
    dbus_manager
    probe.start
  end

  after do
    probe.stop
    Bootloader::BootloaderFactory.clear_cache
    Bootloader::BootloaderFactory.current = nil
  end

  context "when the largest swap device is not known by udev" do
    before do
      allow(Yast::BootStorage).to receive(:encrypted_boot?).and_return(false)
      allow(Yast::BootStorage).to receive(:available_swap_partitions)
        .and_return("/dev/unknown-swap" => 4 * 1024 * 1024 * 1024)
      allow(Yast::BootStorage).to receive(:ram_size).and_return(1024 * 1024 * 1024)
      allow(Yast::Kernel).to receive(:propose_hibernation?).and_return(true)
    end

    # The same exception escapes from Install (lib/agama/dbus/storage/manager.rb:196).
    let(:error) do
      dbus_manager.install
    rescue Bootloader::BrokenConfiguration => e
      e
    end

    # udev_mapping.rb:73 (textdomain at udev_mapping.rb:32)
    it "returns \"Unknown udev device '%s'\"" do
      expect(error).to be_a(Bootloader::BrokenConfiguration)
      expect(error.message).to include("Details: Unknown udev device '/dev/unknown-swap'")
      expect(probe.translatable?("Unknown udev device '%s'")).to eq(true)
    end

    # exceptions.rb:82 (textdomain at exceptions.rb:79)
    it "returns the \"Error reading the bootloader configuration files\" message" do
      expect(error.message).to eq(
        "Error reading the bootloader configuration files. " \
        "Please use YaST2 bootloader to fix it. " \
        "Details: Unknown udev device '/dev/unknown-swap'"
      )
      expect(probe.translatable?(
        "Error reading the bootloader configuration files. " \
        "Please use YaST2 bootloader to fix it. Details: %s"
      )).to eq(true)
    end
  end
end
