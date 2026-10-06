# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/bls_sections"
require "bootloader/bls"
require "cfa/memory_file"

describe Bootloader::BlsSections do
  include_context "yast2-bootloader test setup"

  before do
    allow(Yast::Misc).to receive(:CustomSysconfigRead)
      .with("ID_LIKE", "openSUSE", "/etc/os-release")
      .and_return("openSUSE")
    allow(Yast::Execute).to receive(:on_target!)
      .with("/usr/bin/bootctl", "--json=short", "list", stdout: :capture)
      .and_return("[{\"title\" : \"openSUSE Tumbleweed\", \"isDefault\" : true," \
                  " \"type\" : \"type1\", \"id\" : \"file1.conf\" }," \
                  "{\"title\" : \"Snapper: 20241107\", \"isDefault\" : false,"\
                  " \"type\" : \"type1\", \"id\" : \"file2.conf\"}]")
    allow(Bootloader::Bls).to receive(:default_menu)
      .and_return("openSUSE.conf")

    subject.read
  end

  describe "#read" do
    it "returns list of all available sections" do
      expect(subject.all).to eq(["openSUSE Tumbleweed", "Snapper: 20241107"])
    end

    it "reads default menu entry" do
      expect(subject.default).to eq("openSUSE Tumbleweed")
    end
  end

  describe "#default=" do
    it "sets new value for default" do
      subject.default = "Snapper: 20241107"
      expect(subject.default).to eq "Snapper: 20241107"
    end

    it "sets default to empty if section do not exists" do
      subject.default = "non-exist"
      expect(subject.default).to eq ""
    end
  end

  describe "#write" do
    it "writes default value if set" do
      subject.default = "Snapper: 20241107"
      expect(Bootloader::Bls).to receive(:write_default_menu)
        .with("file2.conf")

      subject.write
    end

    it "does not write default value if not set" do
      subject.default = ""
      expect(Bootloader::Bls).to_not receive(:write_default_menu)

      subject.write
    end

  end
end
