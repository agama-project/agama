# frozen_string_literal: true

# Vendored from yast2-bootloader's test/grub2base_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/grub2base"

TERMINAL_DEFINITION = [:console, :serial].freeze

describe Bootloader::Grub2Base do
  include_context "yast2-bootloader test setup"

  before do
    allow(Yast::ProductFeatures).to receive(:GetStringFeature)
      .and_return("")
    allow(Yast::Kernel).to receive(:propose_hibernation?).and_return(true)
    allow(Yast::Report).to receive(:Error) # do not fail to show popup
  end

  describe "#read" do
    before do
      allow(::CFA::Grub2::Default).to receive(:new).and_return(double("GrubDefault",
        loaded?: false, load: nil, save: nil))
      allow(::CFA::Grub2::GrubCfg).to receive(:new).and_return(double("GrubCfg", load: nil))
      allow(Bootloader::Sections).to receive(:new).and_return(double("Sections").as_null_object)
    end

    it "reads grub default config" do
      grub_default = double(::CFA::Grub2::Default, loaded?: false)
      allow(::CFA::Grub2::Default).to receive(:new).and_return(grub_default)

      expect(grub_default).to receive(:load)

      subject.read
    end

    it "reads sections from grub.cfg file" do
      grub_cfg = double(::CFA::Grub2::GrubCfg, load: nil)
      allow(::CFA::Grub2::GrubCfg).to receive(:new).and_return(grub_cfg)

      expect(Bootloader::Sections).to receive(:new).with(grub_cfg)

      subject.read
    end

    it "use empty file as default if grub.cfg is missing" do
      grub_cfg = double(::CFA::Grub2::GrubCfg)
      allow(::CFA::Grub2::GrubCfg).to receive(:new).and_return(grub_cfg)
      allow(grub_cfg).to receive(:load).and_raise(Errno::ENOENT)

      expect { subject.read }.to_not raise_error
    end

    it "reads update nvram configuration from sysconfig" do
      mocked_sysconfig = ::Bootloader::Sysconfig.new(update_nvram: true)
      allow(::Bootloader::Sysconfig).to receive(:from_system).and_return(mocked_sysconfig)

      subject.read

      expect(subject.update_nvram).to eq true

      mocked_sysconfig = ::Bootloader::Sysconfig.new(update_nvram: false)
      allow(::Bootloader::Sysconfig).to receive(:from_system).and_return(mocked_sysconfig)

      subject.read

      expect(subject.update_nvram).to eq false
    end

    it "raises BrokenConfiguration if /etc/default/grub missing" do
      default = double
      allow(default).to receive(:load).and_raise(Errno::ENOENT)
      allow(::CFA::Grub2::Default).to receive(:new).and_return(default)

      expect { subject.read }.to raise_error(::Bootloader::BrokenConfiguration)
    end
  end

  describe "write" do
    before do
      allow(::CFA::Grub2::Default).to receive(:new).and_return(double("GrubDefault",
        loaded?: false, load: nil, save: nil))
      allow(::CFA::Grub2::GrubCfg).to receive(:new).and_return(double("GrubCfg", load: nil))
      allow(Bootloader::Sections).to receive(:new).and_return(double("Sections", write: nil))
    end

    it "stores grub default config" do
      grub_default = double(::CFA::Grub2::Default, loaded?: false)
      expect(::CFA::Grub2::Default).to receive(:new).and_return(grub_default)

      expect(grub_default).to receive(:save)
      # cannot be in before section is created in constructor
      subject.define_singleton_method(:name) { "grub2base" }

      subject.write
    end

    it "stores chosen default section" do
      sections = double("Sections")
      expect(Bootloader::Sections).to receive(:new).and_return(sections)
      subject.define_singleton_method(:name) { "grub2base" }

      expect(sections).to receive(:write)

      subject.write
    end

    it "writes password" do
      password = instance_double(Bootloader::GRUB2Pwd)
      expect(Bootloader::GRUB2Pwd).to receive(:new).and_return(password)
      subject.define_singleton_method(:name) { "grub2base" }

      expect(password).to receive(:write)

      subject.write
    end

    it "calls grub2-mkconfig in non-transactional system" do
      expect(Yast::Execute).to receive(:on_target).with(/grub2-mkconfig/, any_args)
      subject.write
      expect(Yast::Execute).to_not receive(:on_target)
      subject.write(etc_only: true)
    end
  end

  describe "#propose" do
    before do
      allow(Yast::BootStorage).to receive(:available_swap_partitions).and_return({})
    end

    describe "os_prober proposal" do
      before do
        allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).and_return(false)
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      context "on s390" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
        end

        it "disable os probing" do
          subject.propose

          expect(subject.grub_default.os_prober.enabled?).to eq false
        end
      end

      context "on Power PC" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("ppc64")
        end

        it "disable os probing" do
          subject.propose

          expect(subject.grub_default.os_prober.enabled?).to eq false
        end
      end

      context "when Product explicitly disable os prober" do
        before do
          allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).and_return(true)
        end

        it "disable os probing" do
          subject.propose

          expect(subject.grub_default.os_prober.enabled?).to eq false
        end
      end

      context "otherwise" do
        it "proposes using os probing" do
          subject.propose

          expect(subject.grub_default.os_prober.enabled?).to eq true
        end
      end
    end

    describe "terminal proposal" do
      context "on s390" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
        end

        context "with TERM=\"linux\"" do
          before do
            allow(ENV).to receive(:fetch).with("TERM", nil).and_return("linux")
          end

          it "proposes to use serial terminal" do
            subject.propose

            expect(subject.grub_default.terminal).to include :serial
          end
        end

        context "on other TERM" do
          before do
            allow(ENV).to receive(:fetch).with("TERM", nil).and_return("xterm")
          end

          it "proposes to use console terminal" do
            subject.propose

            expect(subject.grub_default.terminal).to eq [:console]
          end
        end
      end

      context "on ppc" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("ppc64")
        end

        it "proposes to use console terminal" do
          subject.propose

          expect(subject.grub_default.terminal).to eq [:console]
        end

        it "sets GFXPAYLOAD_LINUX to text" do
          subject.propose

          expect(subject.grub_default.generic_get("GRUB_GFXPAYLOAD_LINUX")).to eq "text"
        end
      end

      context "otherwise" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
        end

        it "proposes gfx terminal" do
          subject.propose

          expect(subject.grub_default.terminal).to eq [:gfxterm]
        end
      end
    end

    it "proposes timeout to product/role default" do
      allow(Yast::ProductFeatures).to receive(:GetIntegerFeature)
        .with("globals", "boot_timeout").and_return(2)
      subject.propose

      expect(subject.grub_default.timeout).to eq "2"
    end

    it "proposes using btrfs snapshots always to true" do
      subject.propose

      expect(subject.grub_default.generic_get("SUSE_BTRFS_SNAPSHOT_BOOTING")).to eq "true"
    end

    describe "kernel parameters proposal" do
      context "on x86_64" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
          # RAM 1024 KiB
          allow(Y2Storage::StorageManager.instance.arch).to receive(:ram_size)
            .and_return(1024 * 1024)
        end

        it "proposes kernel parameters used in installation" do
          kernel_params = "verbose suse=rulezz"
          allow(Yast::Kernel).to receive(:GetCmdLine).and_return(kernel_params)

          subject.propose

          expect(subject.grub_default.kernel_params.serialize).to include(kernel_params)
        end

        it "adds additional kernel parameters for given product" do
          allow(Yast::ProductFeatures).to receive(:GetStringFeature)
            .with("globals", "additional_kernel_parameters")
            .and_return("product_aurora=shot")

          subject.propose

          expect(subject.grub_default.kernel_params.serialize).to include("product_aurora=shot")
        end

        it "adds \"quiet\" argument" do
          subject.propose

          expect(subject.grub_default.kernel_params.serialize).to include("quiet")
        end

        context "when the largest swap is bigger than the RAM size" do
          before do
            allow(Yast::BootStorage).to receive(:available_swap_partitions)
              .and_return(
                "/dev/sda2" => 512,
                "/dev/sdb2" => 2048
              )
          end

          it "adds the largest available swap partition as resume device" do
            subject.propose

            expect(subject.grub_default.kernel_params.serialize).to include("resume=/dev/sdb2")
          end
        end

        context "when the largest swap is equal to the RAM size" do
          before do
            allow(Yast::BootStorage).to receive(:available_swap_partitions)
              .and_return(
                "/dev/sda2" => 512,
                "/dev/sdb2" => 1024
              )
          end

          it "adds the largest available swap partition as resume device" do
            subject.propose

            expect(subject.grub_default.kernel_params.serialize).to include("resume=/dev/sdb2")
          end
        end

        context "when the largest swap is smaller than the RAM size" do
          before do
            allow(Yast::BootStorage).to receive(:available_swap_partitions)
              .and_return(
                "/dev/sda2" => 512,
                "/dev/sdb2" => 512
              )
          end

          it "does not add the resume parameter" do
            subject.propose

            expect(subject.grub_default.kernel_params.serialize).to_not include("resume=")
          end
        end
      end

      context "on s390" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
        end

        context "with TERM=\"linux\"" do
          before do
            allow(ENV).to receive(:fetch).with("TERM", nil).and_return("linux")
          end

          it "proposes to use serial console with \"TERM=linux console=ttyS0 console=ttyS1\"" do
            subject.propose

            expect(subject.grub_default.kernel_params.serialize)
              .to include("TERM=linux console=ttyS0 console=ttyS1")
          end
        end

        context "on other TERM" do
          before do
            allow(ENV).to receive(:fetch).with("TERM", nil).and_return("xterm")
          end

          it "proposes dumb term and sets 8 iuvc terminals" do
            subject.propose

            expect(subject.grub_default.kernel_params.serialize).to include("hvc_iucv=8 TERM=dumb")
          end
        end

        it "adds additional kernel parameters for given product" do
          allow(Yast::ProductFeatures).to receive(:GetStringFeature)
            .with("globals", "additional_kernel_parameters")
            .and_return("product_aurora=shot")

          subject.propose

          expect(subject.grub_default.kernel_params.serialize).to include("product_aurora=shot")
        end
      end

      context "on other architectures" do
        before do
          allow(Yast::Arch).to receive(:architecture).and_return("aarm64")
        end

        it "proposes kernel parameters used in installation" do
          kernel_params = "verbose suse=rulezz"
          allow(Yast::Kernel).to receive(:GetCmdLine).and_return(kernel_params)

          subject.propose

          expect(subject.grub_default.kernel_params.serialize).to include(kernel_params)
        end
      end
    end

    context "xen hypervisor kernel parameters proposal" do
      before do
        allow(Yast::BootArch).to receive(:DefaultKernelParams).and_return(kernel_params)
      end

      context "with a serial console" do
        let(:kernel_params) { "console=ttyS2,4800n8" }

        it "does nothing" do
          subject.propose

          expect(subject.grub_default.xen_hypervisor_params.parameter("vga")).to eq false
        end
      end

      context "without a serial console" do
        let(:kernel_params) { "" }

        before do
          allow(Dir).to receive(:[]).and_return(framebuffer)
        end

        context "when there is no framebuffer" do
          let(:framebuffer) { [] }

          it "does nothing" do
            subject.propose

            expect(subject.grub_default.xen_hypervisor_params.parameter("vga")).to eq false
          end
        end

        context "when there is a framebuffer" do
          let(:framebuffer) { ["/dev/fb0"] }

          it "proposes vga parameter" do
            subject.propose

            expect(subject.grub_default.xen_hypervisor_params.parameter("vga"))
              .to eq "gfx-1024x768x16"
          end
        end
      end
    end

    it "proposes gfx mode to auto" do
      subject.propose

      expect(subject.grub_default.gfxmode).to eq "auto"
    end

    it "proposes to disable recovery boot entry" do
      subject.propose

      expect(subject.grub_default.recovery_entry.enabled?).to eq false
    end

    it "proposes empty distributor entry" do
      subject.propose

      expect(subject.grub_default.distributor).to eq ""
    end

    it "proposes to update nvram" do
      subject.propose

      expect(subject.update_nvram).to eq true
    end

    it "proposes hidden timeout option disabled" do
      subject.propose

      expect(subject.grub_default.hidden_timeout).to eq "0"
    end

    context "with a serial console on the kernel command line on non-s390" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
        kernel_params = "console=ttyS2,4800n8"
        allow(Yast::Kernel).to receive(:GetCmdLine).and_return(kernel_params)
      end

      it "proposes a serial console for grub" do
        subject.propose
        expect(subject.grub_default.serial_console)
          .to eq "serial --unit=2 --speed=4800 --parity=no --word=8"
      end

      it "proposes a serial console for the kernel" do
        subject.propose
        expect(subject.grub_default.kernel_params.serialize).to include "console=ttyS2,4800n8"
      end

      it "proposes a serial console for XEN" do
        subject.propose
        # Notice that this is always com1, even if the host uses ttyS2!
        expect(subject.grub_default.xen_hypervisor_params.serialize).to eq "console=com1 com1=4800"
        expect(subject.grub_default.xen_kernel_params.serialize).to eq "console=hvc0"
      end
    end
  end

  describe "#disable_serial_console" do
    it "cleans serial console configuation" do
      subject.grub_default.serial_console = "test console"

      subject.disable_serial_console

      expect(subject.grub_default.serial_console).to be_empty
    end

    it "removes serial console parameters from kernel command line configuration" do
      subject.grub_default.kernel_params.replace("verbose console=ttyS1,4800n1")

      subject.disable_serial_console

      expect(subject.grub_default.kernel_params.serialize).to eq "verbose"
    end
  end

  describe "#enable_serial_console" do
    before do
      # fix architecture as serial console device is different on different architectures
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
    end

    it "sets serial console configuration according to argument" do
      subject.grub_default.serial_console = ""

      subject.enable_serial_console("serial --unit=1 --speed=4800 --parity=no --word=8")

      expect(subject.grub_default.serial_console)
        .to eq "serial --unit=1 --speed=4800 --parity=no --word=8"
    end

    it "sets serial console parameter to kernel command line configuration according to " \
       "parameter" do
      subject.grub_default.kernel_params.replace("")

      subject.enable_serial_console("serial --unit=1 --speed=4800 --parity=no --word=8")

      expect(subject.grub_default.kernel_params.serialize).to eq "console=ttyS1,4800n8"
    end
  end

  describe "#merge" do
    let(:other) do
      other = Bootloader::Grub2Base.new
      other.define_singleton_method(:name) { "grub2base" }
      other
    end

    before do
      allow(Yast::Execute).to receive(:on_target).and_return("")
      subject.define_singleton_method(:name) { "grub2base" }
    end

    it "for default configuration prefer value from other if defined" do
      subject.grub_default.default = "0"
      other.grub_default.default = "saved"

      subject.grub_default.terminal = [:gfxterm]

      subject.grub_default.os_prober.enable
      other.grub_default.os_prober.disable

      subject.merge(other)

      expect(subject.grub_default.default).to eq "saved"
      expect(subject.grub_default.terminal).to eq [:gfxterm]
      expect(subject.grub_default.os_prober).to be_disabled
    end

    it "for kernel line place subject params and then merged ones and deduplicate" do
      subject.grub_default.kernel_params.replace("nosplash verbose debug=true resume=/dev/sda1")
      other.grub_default.kernel_params.replace("nosplash silent noresume debug=false 3")

      subject.merge(other)

      expect(subject.grub_default.kernel_params.serialize)
        .to eq "verbose debug=true nosplash silent noresume debug=false 3"
    end

    it "use grub2 password configuration specified in merged object" do
      allow(other.password).to receive(:password?).and_return(true)

      subject.merge(other)

      expect(subject.password).to be_password
    end

    it "use terminal configuration specified in the merged object" do
      allow(other.grub_default).to receive(:terminal).and_return(TERMINAL_DEFINITION)

      subject.merge(other)

      expect(subject.grub_default.terminal).to eql TERMINAL_DEFINITION
    end

    it "overwrites default section with merged one if specified" do
      allow(other.sections).to receive(:all).and_return(["Win crap", "openSUSE"])
      allow(subject.sections).to receive(:all).and_return(["Win crap", "openSUSE"])

      other.sections.default = "openSUSE"

      subject.merge(other)

      expect(subject.sections.default).to eq "openSUSE"

      other.sections.default = ""

      subject.merge(other)

      expect(subject.sections.default).to eq "openSUSE"
    end

    it "overwrites pmbr action if merged one define it" do
      subject.pmbr_action = :add
      other.pmbr_action = :nothing

      subject.merge(other)

      expect(subject.pmbr_action).to eq :nothing
    end
  end
end
