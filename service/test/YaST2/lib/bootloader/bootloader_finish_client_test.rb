# frozen_string_literal: true

# Vendored from yast2-bootloader's test/bootloader_finish_client_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/finish_client"
require "bootloader/bootloader_factory"
require "yast2/execute"

describe Bootloader::FinishClient do
  include_context "yast2-bootloader test setup"

  describe "#write" do
    before do
      Yast.import "Arch"

      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")

      Bootloader::BootloaderFactory.current_name = "grub2"
      @current_bl = Bootloader::BootloaderFactory.current
      allow(@current_bl).to receive(:read?).and_return(true)

      @system_bl = Bootloader::Grub2.new
      allow(Bootloader::BootloaderFactory).to receive(:system).and_return(@system_bl)
      allow(@system_bl).to receive(:merge)
      allow(@system_bl).to receive(:read)
      allow(@system_bl).to receive(:write)

      allow(Yast::Execute).to receive(:on_target)
    end

    it "sets on non-s390 systems reboot message" do
      Yast.import "Misc"

      subject.write

      expect(Yast::Misc.boot_msg).to match(/will reboot/)
    end

    # NOTE: upstream's two tests here (reipl return "not different" / "different") exercised the
    # dynamic Yast::WFM.call("reipl_bootloader_finish") dispatch and the message customization
    # that depended on its result. That dispatch has been replaced with a direct inlined
    # `chreipl` call (see the DEVIATION FROM UPSTREAM note in lib/bootloader/finish_client.rb and
    # service/YaST2/README.md) - the real client always returned "different" => false anyway, so
    # the message was always "will reboot now" in practice; this test reflects that.
    it "calls chreipl on s390 systems and sets the reboot message" do
      allow(Yast::Arch).to receive(:architecture).and_return("s390_64")

      expect(Yast::Execute).to receive(:on_target).with("chreipl", "node", "/boot/zipl")

      Yast.import "Misc"

      subject.write

      expect(Yast::Misc.boot_msg).to match(/will reboot/)
    end

    it "does not call chreipl on non-s390 systems" do
      expect(Yast::Execute).to_not receive(:on_target).with("chreipl", anything, anything)

      subject.write
    end

    it "runs dracut" do
      expect(Yast::Execute).to receive(:on_target).with("/usr/bin/dracut", "--force",
        "--regenerate-all")

      subject.write
    end

    it "merges system configuration with selected one in installation and set it as current" do
      expect(@system_bl).to receive(:merge).with(@current_bl)
      expect(::Bootloader::BootloaderFactory).to receive(:current=).with(@system_bl)

      subject.write
    end

    it "writes system configuration" do
      expect(@system_bl).to receive(:write)

      subject.write
    end

    it "returns true if everything goes as expect" do
      expect(subject.write).to eq true
    end

    context "in Mode update" do
      before do
        Yast.import "Mode"

        allow(Yast::Mode).to receive(:update).and_return(true)
      end

      it "does nothing if bootloader config is not read or proposed, so no changes done" do
        allow(@current_bl).to receive(:read?).and_return(false)
        allow(@current_bl).to receive(:proposed?).and_return(false)

        expect(@system_bl).to_not receive(:write)

        subject.write
      end
    end

    context "when kexec is requested" do
      before do
        allow(Yast::Linuxrc).to receive(:InstallInf).with("kexec_reboot")
          .and_return("1")
      end

      it "prepares kexec environment" do
        kexec = double
        expect(kexec).to receive(:prepare_environment)
        allow(::Bootloader::Kexec).to receive(:new).and_return(kexec)

        subject.write
      end
    end

    context "when merging the configuration fails with an exception" do
      before do
        allow(@system_bl).to receive(:merge)
          .and_raise(Bootloader::BrokenConfiguration, "Broken message")

        allow(Yast::Report).to receive(:LongMessage)
      end

      it "does not raise an exception" do
        expect { subject.write }.to_not raise_error
      end

      it "displays the error to the user" do
        expect(Yast::Report).to receive(:LongMessage)
          .with(/Please use YaST2 bootloader to fix it.*Broken message/)
        subject.write
      end
    end
  end
end
