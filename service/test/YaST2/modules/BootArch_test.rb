# frozen_string_literal: true

# Vendored from yast2-bootloader's test/boot_arch_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../test_helper"
require_relative "../lib/bootloader/support/shared_setup"

Yast.import "BootArch"

describe Yast::BootArch do
  subject { Yast::BootArch }

  before do
    allow(Yast::ProductFeatures).to receive(:GetStringFeature)
      .and_return("")
  end

  def stub_arch(arch)
    Yast.import "Arch"

    allow(Yast::Arch).to receive(:architecture).and_return(arch)
  end

  describe ".DefaultKernelParams" do
    context "on x86_64 or i386" do
      before do
        stub_arch("x86_64")
      end

      it "adds parameters from boot command line" do
        allow(Yast::Kernel).to receive(:GetCmdLine).and_return("console=ttyS0")

        expect(subject.DefaultKernelParams("/dev/sda2")).to include("console=ttyS0")
      end

      it "filters out root= parameter from boot command line" do
        allow(Yast::Kernel).to receive(:GetCmdLine)
          .and_return("root=live:http://example.com/agama-installer.x86_64-10.0.0-SLE-Build40.6" \
                      ".iso live.password=nots3cr3t console=ttyS1,115200")

        expect(subject.DefaultKernelParams("/dev/sda2"))
          .to include("live.password=nots3cr3t console=ttyS1,115200")
        expect(subject.DefaultKernelParams("/dev/sda2")).to_not include("root=")
      end

      it "adds additional parameters from Product file" do
        allow(Yast::ProductFeatures).to receive(:GetStringFeature)
          .with("globals", "additional_kernel_parameters").and_return("console=ttyS0")

        expect(subject.DefaultKernelParams("/dev/sda2")).to include("console=ttyS0")
      end

      it "adds passed parameter as resume device" do
        expect(subject.DefaultKernelParams("/dev/sda2")).to include("resume=/dev/sda2")
      end

      it "do not adds resume device if parameter is empty" do
        expect(subject.DefaultKernelParams("")).to_not include("resume")
      end

      it "adds \"quiet\" parameter" do
        expect(subject.DefaultKernelParams("/dev/sda2")).to include(" quiet")
      end
    end

    context "on s390" do
      before do
        stub_arch("s390_64")
      end

      it "adds additional parameters from Product file" do
        allow(Yast::ProductFeatures).to receive(:GetStringFeature)
          .with("globals", "additional_kernel_parameters").and_return("console=ttyS0")

        expect(subject.DefaultKernelParams("/dev/sda2")).to include("console=ttyS0")
      end

      it "adds serial console if ENV{TERM} is linux" do
        ENV["TERM"] = "linux"

        expect(subject.DefaultKernelParams("/dev/sda2"))
          .to include("TERM=linux console=ttyS0 console=ttyS1")
      end

      it "adds TERM=dumb and hvc_iucv=8 for other TERM" do
        ENV["TERM"] = "xterm"

        expect(subject.DefaultKernelParams("/dev/sda2")).to include("hvc_iucv=8 TERM=dumb")
      end

      it "adds passed parameter as resume device" do
        expect(subject.DefaultKernelParams("/dev/dasd2")).to include("resume=/dev/dasd2")
      end

      it "adds net.ifnames if boot command line contains it" do
        allow(Yast::Kernel).to receive(:GetCmdLine)
          .and_return("danger kill=1 murder=allowed net.ifnames=1 anarchy=0")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to include("net.ifnames=1")
      end

      it "adds fips if boot command line contains it" do
        allow(Yast::Kernel).to receive(:GetCmdLine)
          .and_return("danger kill=1 murder=allowed fips=1 anarchy=0")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to include("fips=1")
      end

      it "adds zfcp.allow_lun_scan if boot command line contains it" do
        allow(Yast::Kernel).to receive(:GetCmdLine)
          .and_return("danger zfcp.allow_lun_scan=0 fips=1 anarchy=0")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to include("zfcp.allow_lun_scan=0")
      end

      it "does not add other boot params" do
        allow(Yast::Kernel).to receive(:GetCmdLine)
          .and_return("danger kill=1 murder=allowed anarchy=0")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to_not include("danger")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to_not include("kill=1")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to_not include("murder=allowed")
        expect(subject.DefaultKernelParams("/dev/dasd2")).to_not include("anarchy=0")
      end
    end

    context "on POWER archs" do
      before do
        stub_arch("ppc64")
      end

      it "returns parameters from current command line" do
        allow(Yast::Kernel).to receive(:GetCmdLine).and_return("console=ttyS0")
        # just to test that it do not add product features
        allow(Yast::ProductFeatures).to receive(:GetStringFeature)
          .with("globals", "additional_kernel_parameters").and_return("console=ttyS1")

        expect(subject.DefaultKernelParams("/dev/sda2")).to eq(
          "console=ttyS0 resume=/dev/sda2 console=ttyS1 mitigations=auto quiet"
        )
      end

      it "adds \"quiet\" parameter" do
        expect(subject.DefaultKernelParams("/dev/sda2")).to include(" quiet")
      end
    end
  end
end
