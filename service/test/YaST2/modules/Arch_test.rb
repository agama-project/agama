#! /usr/bin/env rspec

require_relative "test_helper"

Yast.import "Arch"

require "yast"

describe Yast::Arch do
  subject { described_class }

  before do
    # need to reset all initialization of the module for individual
    # test cases which mock different hardware
    # otherwise values in Arch.rb remain cached
    module_path = File.expand_path("../src/modules/Arch.rb", __dir__)
    load module_path
  end

  describe ".is_virtual" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".target.string"), "/proc/cpuinfo").and_return(cpuinfo)
    end

    context "when running in a non virtualized environment" do
      let(:cpuinfo) { "processor: 1\nflags: fpu vme de pse tsc msr pae mce\nmodel: 45" }

      it "returns false" do
        expect(Yast::Arch.is_virtual).to eq(false)
      end
    end

    context "when running in a virtualized environment" do
      let(:cpuinfo) { "processor: 1\nflags: fpu vme de hypervisor pse tsc msr pae mce\nmodel: 45" }

      it "returns true" do
        expect(Yast::Arch.is_virtual).to eq(true)
      end
    end
  end

  describe ".is_xen" do
    around do |example|
      change_scr_root(File.join(GENERAL_DATA_PATH, "arch", scenario), &example)
    end

    context "when running in a XEN host" do
      let(:scenario) { "xen_dom0" }

      it "returns true" do
        expect(Yast::Arch.is_xen).to eq(true)
      end
    end

    context "when running in a XEN PV guest" do
      let(:scenario) { "xen_pv_domU" }

      it "returns true" do
        expect(Yast::Arch.is_xen).to eq(true)
      end
    end

    context "when running in a XEN HVM guest" do
      let(:scenario) { "xen_hvm_domU" }

      it "returns true" do
        expect(Yast::Arch.is_xen).to eq(true)
      end
    end

    context "when running in neither a XEN dom0 nor XEN domU" do
      let(:scenario) { "default" }

      it "returns false" do
        expect(Yast::Arch.is_xen).to eq(false)
      end
    end
  end

  describe ".is_xen0" do
    around do |example|
      change_scr_root(File.join(GENERAL_DATA_PATH, "arch", scenario), &example)
    end

    context "when not running in a XEN hypervisor" do
      let(:scenario) { "default" }

      it "returns false" do
        expect(Yast::Arch.is_xen0).to eq(false)
      end
    end

    context "when running in a XEN dom0" do
      let(:scenario) { "xen_dom0" }

      it "returns true" do
        expect(Yast::Arch.is_xen0).to eq(true)
      end
    end

    context "when running in a XEN PV guest" do
      let(:scenario) { "xen_pv_domU" }

      it "returns false" do
        expect(Yast::Arch.is_xen0).to eq(false)
      end
    end

    context "when running in a XEN HVM guest" do
      let(:scenario) { "xen_hvm_domU" }

      it "returns false" do
        expect(Yast::Arch.is_xen0).to eq(false)
      end
    end
  end

  describe ".is_xenU" do
    around do |example|
      change_scr_root(File.join(GENERAL_DATA_PATH, "arch", scenario), &example)
    end

    context "when not running in a XEN hypervisor" do
      let(:scenario) { "default" }

      it "returns false" do
        expect(Yast::Arch.is_xenU).to eq(false)
      end
    end

    context "when running in a XEN host" do
      let(:scenario) { "xen_dom0" }

      it "returns false" do
        expect(Yast::Arch.is_xenU).to eq(false)
      end
    end

    context "when running in a XEN PV guest" do
      let(:scenario) { "xen_pv_domU" }

      it "returns true" do
        expect(Yast::Arch.is_xenU).to eq(true)
      end
    end

    context "when running in a XEN HVM guest" do
      let(:scenario) { "xen_hvm_domU" }

      it "returns true" do
        expect(Yast::Arch.is_xenU).to eq(true)
      end
    end
  end

  describe ".paravirtualized_xen_guest?" do
    around do |example|
      change_scr_root(File.join(GENERAL_DATA_PATH, "arch", scenario), &example)
    end

    context "when not running in a XEN hypervisor" do
      let(:scenario) { "default" }

      it "returns false" do
        expect(Yast::Arch.paravirtualized_xen_guest?).to eq(false)
      end
    end

    context "when running in a XEN host" do
      let(:scenario) { "xen_dom0" }

      it "returns false" do
        expect(Yast::Arch.paravirtualized_xen_guest?).to eq(false)
      end
    end

    context "when running in a XEN PV guest" do
      let(:scenario) { "xen_pv_domU" }

      it "returns true" do
        expect(Yast::Arch.paravirtualized_xen_guest?).to eq(true)
      end
    end

    context "when running in a XEN HVM guest" do
      let(:scenario) { "xen_hvm_domU" }

      it "returns false" do
        expect(Yast::Arch.paravirtualized_xen_guest?).to eq(false)
      end
    end
  end

  describe ".is_zkvm" do
    it "returns true if on s390 and in the zKVM environment" do
      allow(Yast::WFM).to receive(:Execute).and_return 0
      allow(Yast::SCR).to receive(:Read).and_return "s390_64"

      is_zkvm = Yast::Arch.is_zkvm

      expect(is_zkvm).to eq(true)
    end

    it "returns false if on s390 and not in the zKVM environment" do
      allow(Yast::WFM).to receive(:Execute).and_return 1
      allow(Yast::SCR).to receive(:Read).and_return "s390_64"

      is_zkvm = Yast::Arch.is_zkvm

      expect(is_zkvm).to eq(false)
    end

    it "returns false on other architectures" do
      allow(Yast::WFM).to receive(:Execute).and_return 0
      allow(Yast::SCR).to receive(:Read).and_return "x86_64"

      is_zkvm = Yast::Arch.is_zkvm

      expect(is_zkvm).to eq(false)
    end
  end

  describe ".is_zvm" do
    it "returns true if on s390 and in the zVM environment" do
      allow(Yast::WFM).to receive(:Execute).and_return 0
      allow(Yast::SCR).to receive(:Read).and_return "s390_64"

      is_zvm = Yast::Arch.is_zvm

      expect(is_zvm).to eq(true)
    end

    it "returns false if on s390 and not in the zVM environment" do
      allow(Yast::WFM).to receive(:Execute).and_return 1
      allow(Yast::SCR).to receive(:Read).and_return "s390_64"

      is_zvm = Yast::Arch.is_zvm

      expect(is_zvm).to eq(false)
    end

    it "returns false on other architectures" do
      allow(Yast::WFM).to receive(:Execute).and_return 0
      allow(Yast::SCR).to receive(:Read).and_return "x86_64"

      is_zvm = Yast::Arch.is_zvm

      expect(is_zvm).to eq(false)
    end
  end

  describe ".is_wsl" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".target.string"), "/proc/sys/kernel/osrelease")
        .and_return(osrelease)
    end

    context "when it runs on a Microsoft kernel under WSL1" do
      let(:osrelease) { "4.4.0-19041-Microsoft" }

      it "returns true" do
        expect(Yast::Arch.is_wsl).to eq(true)
      end
    end

    context "when it runs on a Microsoft kernel under WSL2" do
      let(:osrelease) { "4.19.104-microsoft-standard" }

      it "returns true" do
        expect(Yast::Arch.is_wsl).to eq(true)
      end
    end

    context "when it does not run on a Microsoft kernel" do
      let(:osrelease) { "5.3.11-default" }

      it "returns false" do
        expect(Yast::Arch.is_wsl).to eq(false)
      end
    end
  end

  describe ".rpm_arch" do
    before do
      allow(subject).to receive(:architecture).and_return(arch)
    end

    context "on 32 bits s390" do
      let(:arch) { "s390_32" }

      it "returns s390" do
        expect(subject.rpm_arch).to eq("s390")
      end
    end

    context "on 64 bits s390" do
      let(:arch) { "s390_64" }

      it "returns s390x" do
        expect(subject.rpm_arch).to eq("s390x")
      end
    end

    context "on ppc64 architectures" do
      let(:arch) { "ppc64" }

      it "returns 'ppc64le'" do
        expect(subject.rpm_arch).to eq("ppc64le")
      end
    end

    context "on others architectures" do
      let(:arch) { "x86_64" }

      it "returns the underlying architecture" do
        expect(subject.rpm_arch).to eq("x86_64")
      end
    end
  end
end
