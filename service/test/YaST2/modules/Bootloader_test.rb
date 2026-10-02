# frozen_string_literal: true

# Vendored from yast2-bootloader's test/bootloader_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.
#
# NOTE: upstream's ".Import" describe block is dropped here (it only tested
# Yast::Bootloader.Import, which this vendored copy does not implement - see the DEVIATION
# FROM UPSTREAM note in service/YaST2/modules/Bootloader.rb and service/YaST2/README.md).

require_relative "../../test_helper"
require_relative "../lib/bootloader/support/shared_setup"

describe Yast::Bootloader do
  include_context "yast2-bootloader test setup"

  # Helper method to grab the kernel line for a given target.
  #
  # @param  [Symbol] target Name of the kernel (:common, :xen_host, etc.)
  # @return [String] Name of the kernel line to modify (:append, :xen_host_append, etc.)
  def kernel_line(target)
    Yast::BootloaderClass::FLAVOR_KERNEL_LINE_MAP[target]
  end

  subject { Yast::Bootloader }

  let(:bootloader) { ::Bootloader::BootloaderFactory.current }

  before do
    # clean cache
    ::Bootloader::BootloaderFactory.instance_variable_set(:@cached_bootloaders, {})
    ::Bootloader::BootloaderFactory.current_name = "grub2"
    allow(::Bootloader::BootloaderFactory.current).to receive(:read)
  end

  describe ".Write" do
    context "when user cancels the installation of required packages" do
      before do
        allow(Yast::Package).to receive(:InstallAll).and_return(false)
        allow(Yast2::Popup).to receive(:show)
        allow(Yast::Package).to receive(:Available).and_return(true)
      end

      it "shows an information message" do
        expect(Yast2::Popup).to receive(:show)

        subject.Write
      end

      it "returns false" do
        expect(subject.Write).to eq(false)
      end

      it "logs an error" do
        expect(subject.log).to receive(:error).with(/could not be prepared/)

        subject.Write
      end
    end
  end

  describe ".ReadOrProposeIfNeeded" do
    before do
      allow(Yast::Stage).to receive(:initial).and_return(false)
      allow(Yast::Mode).to receive(:update).and_return(false)
      allow(Yast::Mode).to receive(:config).and_return(false)

    end

    it "does nothing if already read" do
      bootloader.instance_variable_set(:@read, true)
      expect(subject).to_not receive(:Read)
      expect(subject).to_not receive(:Propose)

      subject.ReadOrProposeIfNeeded
    end

    it "does nothing if already proposed" do
      bootloader.instance_variable_set(:@proposed, true)
      expect(subject).to_not receive(:Read)
      expect(subject).to_not receive(:Propose)

      subject.ReadOrProposeIfNeeded
    end

    it "propose in config mode" do
      expect(subject).to receive(:Propose)
      expect(subject).to_not receive(:Read)
      allow(Yast::Mode).to receive(:config).and_return(true)

      subject.ReadOrProposeIfNeeded
    end

    it "propose configuration in initial stage except update mode" do
      expect(subject).to receive(:Propose)
      expect(subject).to_not receive(:Read)
      allow(Yast::Mode).to receive(:config).and_return(false)
      allow(Yast::Mode).to receive(:update).and_return(false)
      allow(Yast::Stage).to receive(:initial).and_return(true)

      subject.ReadOrProposeIfNeeded
    end

    it "reads configuration in normal stage" do
      expect(subject).to_not receive(:Propose)
      expect(subject).to receive(:Read)

      subject.ReadOrProposeIfNeeded
    end

    it "reads configuration in update mode" do
      expect(subject).to_not receive(:Propose)
      # switching SCR to Yast::Installation.destdir
      expect(Yast::WFM).to receive(:SCROpen).with("chroot=#{Yast::Installation.destdir}:scr",
        false)
      expect(subject).to receive(:Read)
      allow(Yast::Mode).to receive(:update).and_return(true)
      allow(Yast::Stage).to receive(:initial).and_return(true)

      subject.ReadOrProposeIfNeeded
    end
  end

  describe ".modify_kernel_params" do
    let(:initial_lines) { {} }
    let(:params) { { "crashkernel" => "256M" } }
    let(:append) { "crashkernel=256M" }

    context "when no parameters are passed" do
      it "raises an ArgumentError exception" do
        expect { subject.modify_kernel_params(:common) }.to raise_error(ArgumentError)
      end
    end

    context "when target does not exist" do
      it "raises an ArgumentError exception" do
        expect { subject.modify_kernel_params(:unknown, params) }.to raise_error(ArgumentError)
      end
    end

    context "when no target is specified" do
      it "uses :common by default" do
        subject.modify_kernel_params(params)

        expect(bootloader.grub_default.kernel_params.serialize).to eq append
      end
    end

    context "when a target is specified" do
      it "adds parameter for that target" do
        subject.modify_kernel_params(:xen_guest, params)

        expect(bootloader.grub_default.xen_kernel_params.serialize).to eq append
      end
    end

    context "when multiple targets are specified" do
      it "adds parameters to each target" do
        subject.modify_kernel_params(:xen_host, :xen_guest, params)

        expect(bootloader.grub_default.xen_kernel_params.serialize).to eq append
        expect(bootloader.grub_default.xen_hypervisor_params.serialize).to eq append
      end
    end

    context "when targets are specified as an array" do
      it "adds parameters to each target" do
        subject.modify_kernel_params([:xen_host, :xen_guest], params)

        expect(bootloader.grub_default.xen_kernel_params.serialize).to eq append
        expect(bootloader.grub_default.xen_hypervisor_params.serialize).to eq append
      end
    end

    context "when a parameter is set to be removed" do
      before do
        bootloader.grub_default.kernel_params.add_parameter("quiet", true)
        bootloader.grub_default.kernel_params.add_parameter("silent", true)
      end
      let(:params) { { "quiet" => :missing } }

      it "removes parameter from the given target" do
        subject.modify_kernel_params(:common, params)

        expect(bootloader.grub_default.kernel_params.serialize).to eq "silent"
      end
    end

    context "when a parameter is set to be just present" do
      let(:params) { { "quiet" => :present } }

      it "adds the parameter to the given target without any value" do
        subject.modify_kernel_params(:common, params)

        expect(bootloader.grub_default.kernel_params.serialize).to eq "quiet"
      end
    end

    context "when multiple values are specified for a parameter" do
      let(:params) { { "crashkernel" => ["256M,low", "1024M,high"] } }

      it "adds the parameter multiple times" do
        subject.modify_kernel_params(:common, params)

        expect(bootloader.grub_default.kernel_params.serialize)
          .to eq "crashkernel=256M,low crashkernel=1024M,high"
      end
    end
  end

  describe ".kernel_param" do
    before do
      bootloader.grub_default.kernel_params.replace(
        "quiet verbose=1 crashkernel=256M,low crashkernel=1024M,high"
      )
    end

    context "when parameter does not exist" do
      it "returns 'false'" do
        expect(subject.kernel_param(:common, "nothing")).to eq(:missing)
      end
    end

    context "when parameter exists but has no value" do
      it "returns 'true'" do
        expect(subject.kernel_param(:common, "quiet")).to eq(:present)
      end
    end

    context "when parameter exists and has one value" do
      it "returns the value" do
        expect(subject.kernel_param(:common, "verbose")).to eq("1")
      end
    end

    context "when parameter exists but has multiple values" do
      it "returns all the values" do
        expect(subject.kernel_param(:common, "crashkernel"))
          .to eq(["256M,low", "1024M,high"])
      end
    end
  end
end
