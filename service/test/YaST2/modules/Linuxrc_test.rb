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

require_relative "../../test_helper"


Yast.import "Linuxrc"

DEFAULT_INSTALL_INF = {
  "Manual"           => "0",
  "Locale"           => "xy_XY",
  "Display"          => "Color",
  "HasPCMCIA"        => "0",
  "NoPCMCIA"         => "0",
  "Sourcemounted"    => "1",
  "SourceType"       => "dir",
  "RepoURL"          => "cd:/?device=disk/by-id/ata-VBOX_CD-ROM_VB2-01700376",
  "InstsysURL"       => "boot/x86_64/root",
  "ZyppRepoURL"      => "cd:/?devices=/dev/disk/by-id/ata-VBOX_CD-ROM_VB2-01700376",
  "InstMode"         => "cd",
  "Device"           => "disk/by-id/ata-VBOX_CD-ROM_VB2-01700376",
  "Cdrom"            => "disk/by-id/ata-VBOX_CD-ROM_VB2-01700376",
  "Partition"        => "disk/by-id/ata-VBOX_CD-ROM_VB2-01700376",
  "Serverdir"        => "/",
  "InitrdModules"    => "ata_piix ata_generic cdrom sr_mod st sg thermal_sys thermal",
  "Options"          => "thermal tzp=50",
  "UpdateDir"        => "/linux/suse/x86_64-13.1",
  "YaST2update"      => "0",
  "Textmode"         => "0",
  "MemFree"          => "989888",
  "VNC"              => "0",
  "UseSSH"           => "0",
  "InitrdID"         => "2013-09-17.8c48b884",
  "WithiSCSI"        => "0",
  "WithFCoE"         => "0",
  "StartShell"       => "0",
  "Y2GDB"            => "0",
  "kexec_reboot"     => "1",
  "UseSax2"          => "0",
  "EFI"              => "0",
  "Ignored_featureS" => "import_ssh_keys,import_users",
  "Cmdline"          => "splash=silent vga=0x314",
  "Keyboard"         => "1",
  "Framebuffer"      => "0x0314",
  "X11i"             => "",
  "XServer"          => "fbdev",
  "XVersion"         => "4",
  "XBusID"           => "0:2:0",
  "XkbRules"         => "xfree86",
  "XkbModel"         => "pc104",
  "umount_result"    => "0"
}.freeze

def load_install_inf(defaults_replacement = {})
  # Default value
  allow(Yast::SCR).to receive(:Read).and_return nil

  allow(Yast::SCR).to receive(:Read)
    .with(path(".target.size"))
    .and_return 1

  # Default value
  allow(Yast::SCR).to receive(:Dir).and_return nil

  install_inf = DEFAULT_INSTALL_INF.merge(defaults_replacement)

  allow(Yast::SCR).to receive(:Dir)
    .with(path(".etc.install_inf"))
    .and_return install_inf.keys

  install_inf.each_key do |key|
    allow(Yast::SCR).to receive(:Read)
      .with(path(".etc.install_inf.#{key}"))
      .and_return install_inf[key]
  end
end

describe Yast::Linuxrc do
  subject { Yast::Linuxrc }

  before(:each) do
    Yast::Linuxrc.ResetInstallInf
  end

  describe "#serial_console" do
    it "returns true if 'Console' is found in install.inf" do
      load_install_inf("Console" => "/dev/console")
      expect(subject.serial_console).to eq(true)
    end

    it "returns false if 'Console' is not found in install.inf" do
      load_install_inf("Console" => nil)
      expect(subject.serial_console).to eq(false)
    end
  end

  describe "#braille" do
    it "returns true if 'Braille' is found in install.inf" do
      load_install_inf("Braille" => "/dev/braille")
      expect(subject.braille).to eq(true)
    end

    it "returns false if 'Braille' is not found in install.inf" do
      load_install_inf("Braille" => nil)
      expect(subject.braille).to eq(false)
    end
  end

  describe "#vnc" do
    it "returns true if 'VNC' is set to '1' in install.inf" do
      load_install_inf("VNC" => "1")
      expect(subject.vnc).to eq(true)
    end

    it "returns false if 'VNC' is not set to '1' in install.inf" do
      load_install_inf("VNC" => "0")
      expect(subject.vnc).to eq(false)
    end
  end

  describe "#display_ip" do
    it "returns true if 'Display_IP' is found in install.inf" do
      load_install_inf("Display_IP" => "1.2.3.4")
      expect(subject.display_ip).to eq(true)
    end

    it "returns false if 'Display_IP' is not found in install.inf" do
      load_install_inf("Display_IP" => nil)
      expect(subject.display_ip).to eq(false)
    end
  end

  describe "#usessh" do
    it "returns true if 'UseSSH' is set to '1' in install.inf" do
      load_install_inf("UseSSH" => "1")
      expect(subject.usessh).to eq(true)
    end

    it "returns false if 'UseSSH' is not set to '1' in install.inf" do
      load_install_inf("UseSSH" => "0")
      expect(subject.usessh).to eq(false)
    end
  end

  describe "#useiscsi" do
    it "returns true if 'WithiSCSI' is set to '1' in install.inf" do
      load_install_inf("WithiSCSI" => "1")
      expect(subject.useiscsi).to eq(true)
    end

    it "returns false if 'WithiSCSI' is not set to '1' in install.inf" do
      load_install_inf("WithiSCSI" => "0")
      expect(subject.useiscsi).to eq(false)
    end
  end

  describe "#text" do
    it "returns true if 'Textmode' is set to '1' in install.inf" do
      load_install_inf("Textmode" => "1")
      expect(subject.text).to eq(true)
    end

    it "returns false if 'Textmode' is not set to '1' in install.inf" do
      load_install_inf("Textmode" => "0")
      expect(subject.text).to eq(false)
    end
  end

  describe "#InstallInf" do
    it "returns locale defined in install.inf" do
      load_install_inf
      expect(subject.InstallInf("Locale")).to be_equal(DEFAULT_INSTALL_INF["Locale"])
    end

    it "returns nil if value for unknown key is requested" do
      load_install_inf
      expect(subject.InstallInf("Unknown Key Requested")).to be_nil
    end

    it "returns nil if value for 'nil' key is requested" do
      load_install_inf
      expect(subject.InstallInf(nil)).to be_nil
    end
  end

  describe "#keys" do
    it "returns all keys defined in install.inf" do
      load_install_inf
      expect(subject.keys.sort).to eq(DEFAULT_INSTALL_INF.keys.sort)
    end
  end

  describe "#value_for" do
    context "when key is defined in install.inf (Linuxrc commandline)" do
      it "returns value for given key" do
        load_install_inf(
          "test_1"    => "123",
          "T-E-S-T-2" => "456",
          "TeSt3"     => "678",
          "Cmdline"   => "test4=890 test5=10,11,12"
        )

        expect(subject.value_for("test_1")).to eq("123")
        expect(subject.value_for("TEsT2")).to eq("456")
        expect(subject.value_for("T_e_St_3")).to eq("678")
        expect(subject.value_for("T.e.s.t-4")).to eq("890")
        expect(subject.value_for("test5")).to eq("10,11,12")
      end

      it "parses commandline with '=' in the value" do
        url = "http://example.com?bar=42"
        load_install_inf(
          "Cmdline"   => "test6=#{url}"
        )

        expect(subject.value_for("test_6")).to eq(url)
      end

      it "returns the last matching value from command line" do
        load_install_inf(
          "Cmdline"   => "test7=foo test.7=bar test__7=baz"
        )

        expect(subject.value_for("test_7")).to eq("baz")
      end
    end

    context "when key is not defined in install.inf (Linuxrc commandline)" do
      it "returns nil" do
        load_install_inf
        expect(subject.value_for("this-key-is-not-defined")).to eq(nil)
      end
    end
  end

  describe "#disable_remote" do
    before(:each) do
      allow(Yast::SCR).to receive(:Write)
        .with(path(".etc.install_inf"), nil)
    end

    context "when vnc should be disabled" do
      it "updates install.inf" do
        # twice, because there are two services, thus two calls to do the same
        expect(Yast::SCR).to receive(:Write)
          .with(path(".etc.install_inf.VNC"), 0).twice
        # twice, because there are two services, thus two calls to do the same
        expect(Yast::SCR).to receive(:Write)
          .with(path(".etc.install_inf.VNCPassword"), "").twice
        subject.disable_remote(["vnc", "VNC"])
      end
    end

    context "when ssh should be disabled" do
      it "updates install.inf" do
        # twice, because there are two services, thus two calls to do the same
        expect(Yast::SCR).to receive(:Write)
          .with(path(".etc.install_inf.UseSSH"), 0).twice
        subject.disable_remote(["sSh", "ssh"])
      end
    end

    context "when braille and dispaly_ip should be disabled" do
      it "updates install.inf" do
        expect(Yast::SCR).to receive(:Write)
          .with(path(".etc.install_inf.Braille"), 0)
        # twice, because there are two services, thus two calls to do the same
        expect(Yast::SCR).to receive(:Write)
          .with(path(".etc.install_inf.DISPLAY_IP"), 0).twice
        subject.disable_remote(["braille", "display-ip", "DiSplaY_IP"])
      end
    end

    context "when trying to disable an unknown service" do
      it "throws an exception" do
        # for other (valid) services
        allow(Yast::SCR).to receive(:Write)

        unknown_service = "uNkNown-ser_vice"
        expect { subject.disable_remote(["SSH", unknown_service]) }.to raise_error(ArgumentError, /Cannot disable #{unknown_service}/)
      end
    end
  end

  describe "#reboot_timeout" do
    it "returns integer value if 'reboot_timeout' is found in install.inf" do
      load_install_inf("reboot_timeout" => "15")
      expect(subject.reboot_timeout).to eq(15)
    end

    it "returns nil if 'reboot_timeout' is not found in install.inf" do
      load_install_inf({})
      expect(subject.reboot_timeout).to eq(nil)
    end
  end
end
