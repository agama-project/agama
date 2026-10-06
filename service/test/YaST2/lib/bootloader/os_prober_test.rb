# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

describe Bootloader::OsProber do
  include_context "yast2-bootloader test setup"

  subject = described_class

  describe "#package_name" do
    it "Returns the correct package name" do
      expect(subject.package_name).to eq "os-prober"
    end
  end

  describe "#arch_supported?" do
    context "on non-s390 architectures" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(false)
      end

      it "os-prober is supported" do
        expect(subject.arch_supported?).to eq true
      end
    end

    context "on the s390 architecture" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(true)
      end

      it "os-prober is not supported" do
        expect(subject.arch_supported?).to eq false
      end
    end
  end

  describe "#available?" do
    context "on non-s390 architectures" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(false)
      end

      context "if the os-prober package is available" do
        before do
          allow(Yast::Package).to receive(:Available).and_return(true)
        end

        it "os-prober is available" do
          expect(subject.available?("grub2")).to eq true
        end
      end

      context "if the os-prober package is not available" do
        before do
          allow(Yast::Package).to receive(:Available).and_return(false)
        end

        it "os-prober is not available" do
          expect(subject.available?("grub2")).to eq false
        end
      end

      context "if grub2-bls bootloader" do
        before do
          allow(Yast::Package).to receive(:Available).and_return(true)
        end

        it "os-prober is not available for that bootloader" do
          expect(subject.available?("grub2-bls")).to eq false
        end
      end

      context "when package availability is explicitly set" do
        after do
          subject.package_available = nil
        end

        it "uses the set value" do
          subject.package_available = true
          expect(Yast::Package).to_not receive(:Available)
          expect(subject.available?("grub2")).to eq true

          subject.package_available = false
          expect(Yast::Package).to_not receive(:Available)
          expect(subject.available?("grub2")).to eq false
        end
      end
    end
  end

  describe "#package_available=" do
    after do
      subject.package_available = nil
    end

    it "sets the package availability" do
      subject.package_available = true
      expect(subject.package_available?).to eq true
    end
  end
end
