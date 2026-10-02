# frozen_string_literal: true

# Vendored from yast2-bootloader's test/sections_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/sections"
require "cfa/memory_file"

describe Bootloader::Sections do
  include_context "yast2-bootloader test setup"

  subject do
    sections = [
      { title: "linux", path: "linux" },
      { title: "windows", path: "alien>windows" }
    ]
    grub_cfg = double("CFA::Grub2::GrubCfg", boot_entries: sections)
    Bootloader::Sections.new(grub_cfg)
  end

  before do
    # do not crash in report that grub2-env is not in test env
    allow(Yast::Report).to receive(:Error)
  end

  describe "#all" do
    it "returns list of all available sections" do
      expect(subject.all).to eq(["linux", "windows"])
    end
  end

  describe "#default" do
    it "gets name of default section stored in grub2" do
      expect(Yast::Execute).to receive(:on_target)
        .with("/usr/bin/grub2-editenv", "list", stdout: :capture)
        .and_return("saved_entry=alien>windows\nbla_bla=no\n")

      expect(subject.default).to eq "windows"
    end

    it "gets first section if nothing stored in grub2" do
      expect(Yast::Execute).to receive(:on_target)
        .with("/usr/bin/grub2-editenv", "list", stdout: :capture)
        .and_return("\n")

      expect(subject.default).to eq "linux"
    end

    it "gets value written by #default=" do
      subject.default = "windows"

      expect(subject.default).to eq "windows"
    end
  end

  describe "#default=" do
    it "sets new value for default" do
      subject.default = "windows"

      expect(subject.default).to eq "windows"
    end

    it "sets default to empty if section do not exists" do
      subject.default = "non-exist"
      expect(subject.default).to eq ""
    end

    it "handles localized grub.cfg" do
      data_path = File.expand_path("data/grub.cfg", __dir__)
      file = CFA::MemoryFile.new(File.read(data_path))
      grub_cfg = CFA::Grub2::GrubCfg.new(file_handler: file)
      grub_cfg.load

      sections = Bootloader::Sections.new(grub_cfg)

      expect do
        sections.default = "openSUSE Tumbleweed, с Linux 4.8.6-2-default"
      end.to_not raise_error
      expect do
        sections.default = "openSUSE Tumbleweed, \u0441 Linux 4.8.6-2-default"
      end.to_not raise_error
      expect do
        sections.default = "openSUSE Tumbleweed, \xD1\x81 Linux 4.8.6-2-default"
      end.to_not raise_error
    end
  end

  describe "#write" do
    it "writes default value" do
      subject.default = "linux"

      expect(Yast::Execute).to receive(:on_target)
        .with("/usr/sbin/grub2-set-default", "linux")

      subject.write
    end

    it "converts default value to its path" do
      subject.default = "windows"

      expect(Yast::Execute).to receive(:on_target)
        .with("/usr/sbin/grub2-set-default", "alien>windows")

      subject.write
    end
  end
end
