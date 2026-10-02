# frozen_string_literal: true

# Vendored from yast2-bootloader's test/bls_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

describe Bootloader::Bls do
  include_context "yast2-bootloader test setup"

  subject = described_class

  describe "#create_menu_entries" do
    it "calls sdbootutil add-all-kernels" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "add-all-kernels")
      subject.create_menu_entries
    end
  end

  describe "#install_bootloader" do
    it "calls sdbootutil install" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "install")
      subject.install_bootloader
    end
  end

  describe "#update_bootloader" do
    it "calls sdbootutil install" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "update-all-entries")
      subject.update_bootloader
    end
  end

  describe "#write_menu_timeout" do
    it "calls sdbootutil set-timeout" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "set-timeout", "--",
          10)
      subject.write_menu_timeout(10)
    end
  end

  describe "#menu_timeout" do
    it "calls sdbootutil get-timeout" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "get-timeout", stdout: :capture)
        .and_return(10)
      expect(subject.menu_timeout).to eq 10
    end
  end

  describe "#write_default_menu" do
    it "calls sdbootutil set-default" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "set-default", "openSUSE")
      subject.write_default_menu("openSUSE")
    end
  end

  describe "#default_menu" do
    it "calls sdbootutil get-default" do
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "get-default", stdout: :capture)
        .and_return("openSUSE")
      expect(subject.default_menu).to eq "openSUSE"
    end
  end

  describe "#set_authentication" do
    it "enrolls the Fido2/TPM2" do
      devicegraph_stub("fido2-encryption.yaml")

      expect(Yast::Execute).to receive(:on_target!)
        .with("keyctl", "padd", "user", "cryptenroll", "@u",
          anything).twice
      expect(Yast::Execute).to_not receive(:on_target!)
        .with("keyctl", "padd", "user", "sdbootutil", "@u",
          anything)
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "enroll", "--method=fido2", "--devices=/dev/vda2")
      expect(Yast::Execute).to receive(:on_target!)
        .with("/usr/bin/sdbootutil", "enroll", "--method=fido2", "--devices=/dev/vda3")
      expect(Yast::Execute).to receive(:on_target!)
        .with("/bin/systemd-machine-id-setup")

      subject.set_authentication
    end
  end
end
