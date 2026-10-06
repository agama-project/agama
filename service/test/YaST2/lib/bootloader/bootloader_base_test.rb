# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/bootloader_base"

describe Bootloader::BootloaderBase do
  include_context "yast2-bootloader test setup"

  describe "#prepare" do
    let(:initial_sysconfig) { double(Bootloader::Sysconfig, write: nil) }
    let(:new_sysconfig) { double(Bootloader::Sysconfig, write: nil) }
    let(:bootloader) { "funny_bootloader" }
    let(:normal_mode) { false }

    before do
      allow(Yast::Mode).to receive(:normal).and_return(normal_mode)

      allow(Bootloader::Sysconfig).to receive(:new).and_return(new_sysconfig)
      allow(Bootloader::Sysconfig).to receive(:from_system).and_return(initial_sysconfig)

      allow(Yast::Package).to receive(:InstallAll)

      allow(Yast2::Popup).to receive(:show).and_return(true)

      subject.define_singleton_method(:name) { "funny_bootloader" }
    end

    it "writes to sysconfig name of its child" do
      expect(Bootloader::Sysconfig).to receive(:new)
        .with(bootloader: "funny_bootloader")
        .and_return(new_sysconfig)

      subject.prepare
    end

    context "when is not Mode.normal" do
      it "returns true" do
        expect(subject.prepare).to eq(true)
      end
    end

    context "when is Mode.normal" do
      let(:normal_mode) { true }

      it "tries to install required packages" do
        expect(Yast::Package).to receive(:InstallAll).with(["dracut", "kexec-tools"])

        subject.prepare
      end

      context "and the user accepts the installation" do
        before do
          allow(Yast::Package).to receive(:InstallAll).with(["dracut", "kexec-tools"])
            .and_return(true)
        end

        it "returns true" do
          expect(subject.prepare).to eq(true)
        end

        it "does not rollback the sysconfig" do
          expect(initial_sysconfig).to_not receive(:write)
        end
      end

      context "and the user does not accept the installation" do
        before do
          allow(Yast::Package).to receive(:InstallAll).with(["kexec-tools"]).and_return(false)
        end

        it "restores the initial sysconfig" do
          expect(initial_sysconfig).to receive(:write)

          subject.prepare
        end

        it "returns false" do
          expect(subject.prepare).to eq(false)
        end
      end
    end
  end

  describe "#read" do
    it "sets read flag" do
      expect(subject.read?).to eq false

      subject.read

      expect(subject.read?).to eq true
    end
  end

  describe "#propose" do
    it "sets proposed flag" do
      expect(subject.proposed?).to eq false

      subject.propose

      expect(subject.proposed?).to eq true
    end
  end

  describe "#summary" do
    it "returns empty string" do
      expect(subject.summary).to eq([])
    end
  end

  describe "#packages" do
    context "live-installation" do
      before do
        allow(Yast::Mode).to receive(:live_installation).and_return(true)
      end

      it "returns package list with dracut" do
        expect(subject.packages).to eq(["dracut"])
      end
    end

    context "kexec_reboot flag is not set" do
      before do
        allow(Yast::Linuxrc).to receive(:InstallInf)
          .with("kexec_reboot")
          .and_return("0")
      end

      it "returns list with dracut" do
        expect(subject.packages).to eq(["dracut"])
      end
    end

    context "kexec_reboot flag is set" do
      before do
        allow(Yast::Linuxrc).to receive(:InstallInf)
          .with("kexec_reboot")
          .and_return("1")
      end

      it "returns list containing kexec-tools package" do
        expect(subject.packages).to include("kexec-tools")
      end
    end
  end

  describe "#merge" do
    it "raises exception if different bootloader type passed" do
      subject.define_singleton_method(:name) { "funny_bootloader" }
      other = described_class.new
      other.define_singleton_method(:name) { "more_funny_bootloader" }

      expect { subject.merge(other) }.to raise_error(RuntimeError)
    end

    it "sets read flag if subject or passed one have it" do
      subject.define_singleton_method(:name) { "funny_bootloader" }
      other = described_class.new
      other.define_singleton_method(:name) { "funny_bootloader" }

      other.read

      subject.merge(other)
      expect(subject.read?).to eq true
    end

    it "sets propose flag if subject or passed one have it" do
      subject.define_singleton_method(:name) { "funny_bootloader" }
      other = described_class.new
      other.define_singleton_method(:name) { "funny_bootloader" }

      other.propose

      subject.merge(other)
      expect(subject.proposed?).to eq true
    end
  end
end
