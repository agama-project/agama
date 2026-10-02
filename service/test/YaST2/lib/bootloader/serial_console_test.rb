# frozen_string_literal: true

# Vendored from yast2-bootloader's test/serial_console_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/serial_console"

describe ::Bootloader::SerialConsole do
  include_context "yast2-bootloader test setup"

  describe ".load_from_kernel_args" do
    it "returns nil if no console configuration found" do
      kernel_args = double("KernelArgs", parameter: nil)

      expect(described_class.load_from_kernel_args(kernel_args)).to eq nil
    end

    it "returns nil if console configuration is not for serial one" do
      kernel_args = double("KernelArgs", parameter: "tty1")

      expect(described_class.load_from_kernel_args(kernel_args)).to eq nil
    end

    # covers bug #870514
    it "returns nil if serial console configuration is not the last one" do
      kernel_args = double("KernelArgs", parameter: ["ttyS1", "tty1"])

      expect(described_class.load_from_kernel_args(kernel_args)).to eq nil
    end

    it "loads configuration if found" do
      kernel_args = double("KernelArgs", parameter: "ttyS1,4800n8")
      expected_grub_config = "serial --unit=1 --speed=4800 --parity=no --word=8"

      expect(described_class.load_from_kernel_args(kernel_args).console_args).to(
        eq expected_grub_config
      )

      kernel_args = double("KernelArgs", parameter: "ttyS1,4800e7")
      expected_grub_config = "serial --unit=1 --speed=4800 --parity=even --word=7"

      expect(described_class.load_from_kernel_args(kernel_args).console_args).to(
        eq expected_grub_config
      )

      kernel_args = double("KernelArgs", parameter: "ttyAMA1,4800o8")
      expected_grub_config = "serial --unit=1 --speed=4800 --parity=odd --word=8"

      expect(described_class.load_from_kernel_args(kernel_args).console_args).to(
        eq expected_grub_config
      )
    end

    it "loads also partial configuration using defaults for rest" do
      kernel_args = double("KernelArgs", parameter: "ttyS2")
      expected_grub_config = "serial --unit=2 --speed=9600 --parity=no"

      expect(described_class.load_from_kernel_args(kernel_args).console_args).to(
        eq expected_grub_config
      )
    end
  end

  describe ".load_from_console_args" do
    before do
      Yast.import "Arch"
      allow(Yast::Arch).to receive(:aarch64).and_return(false)
    end

    it "returns nil if configuration is not valid" do
      expect(described_class.load_from_console_args("")).to eq nil
      expect(described_class.load_from_console_args("serial")).to eq nil
    end

    it "loads configuration if found" do
      grub_config = "serial --unit=1 --speed=4800 --parity=no --word=8"

      expect(described_class.load_from_console_args(grub_config).kernel_args).to(
        eq "ttyS1,4800n8"
      )
    end

    it "loads also partial configuration using defaults for rest" do
      grub_config = "serial --unit=2"

      expect(described_class.load_from_console_args(grub_config).kernel_args).to(
        eq "ttyS2,9600n"
      )
    end
  end

  describe "#kernel_args" do
    before do
      Yast.import "Arch"
      allow(Yast::Arch).to receive(:aarch64).and_return(false)
    end

    it "returns kernel argument usable with terminal key" do
      obj = described_class.new(2, 9600)
      expect(obj.kernel_args).to eq "ttyS2,9600n"
    end

    it "uses ttyAMA for aarch64" do
      allow(Yast::Arch).to receive(:aarch64).and_return(true)

      obj = described_class.new(2, 9600)
      expect(obj.kernel_args).to eq "ttyAMA2,9600n"
    end
  end

  describe "#console_args" do
    it "returns serial command usable for grub2" do
      obj = described_class.new(2, 9600, "no", "8")
      expect(obj.console_args).to eq "serial --unit=2 --speed=9600 --parity=no --word=8"
    end

    it "skips word parameter if it is empty" do
      obj = described_class.new(2, 9600, "no", "")
      expect(obj.console_args).to eq "serial --unit=2 --speed=9600 --parity=no"
    end
  end

  describe "#xen_kernel_args" do
    it "returns the hypervisor console for XEN kernels" do
      obj = described_class.new(2, 9600, "no", "8")
      expect(obj.xen_kernel_args).to eq "console=hvc0"
    end
  end

  describe "#xen_hypervisor_args" do
    it "returns the correct console speed parameters" do
      obj = described_class.new(2, 9600, "no", "8")
      expect(obj.xen_hypervisor_args).to eq "console=com1 com1=9600"
    end
  end
end
