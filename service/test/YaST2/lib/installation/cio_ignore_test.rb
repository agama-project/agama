# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require_relative "../../../test_helper"
require "installation/cio_ignore"

Yast.import "Bootloader"

# NOTE: upstream's `Installation::CIOIgnoreProposal` (UI-only proposal client) was
# deliberately not vendored (see service/YaST2/README.md), so the corresponding
# upstream examples for it are dropped here; only `CIOIgnore`/`CIOIgnoreFinish`
# (which were vendored) are ported.
describe Installation::CIOIgnore do
  let(:param) { :missing }
  let(:zvm) { false }
  let(:kvm) { false }
  let(:auto) { false }

  before do
    arch_mock = double("Yast::Arch", s390: false, is_zkvm: kvm, is_zvm: zvm)
    stub_const("Yast::Arch", arch_mock)
    allow(Yast::Bootloader).to receive(:kernel_param).with(:common, "rd.zdev")
    allow(Yast::Bootloader).to receive(:kernel_param).with(:common, "cio_ignore").and_return(param)
    allow(Yast::Mode).to receive(:autoinst).and_return(auto)
  end

  describe "cio_ignore enable/disable" do
    context "in autoinstallation" do
      let(:auto) { true }

      it "takes AutoYaST cio_ignore setting" do
        allow(Yast::AutoinstConfig).to receive(:cio_ignore).and_return(false)
        Installation::CIOIgnore.instance.reset
        expect(Installation::CIOIgnore.instance.cio_enabled).to eq(false)
      end
    end

    context "in other modes" do
      it "takes the default cio_ignore entry" do
        expect(Yast::AutoinstConfig).not_to receive(:cio_ignore)
        Installation::CIOIgnore.instance.reset
        expect(Installation::CIOIgnore.instance.cio_enabled).to eq(true)
      end
    end
  end

  describe "cio_ignore default value" do
    before(:each) do
      Installation::CIOIgnore.instance.reset
    end

    context "when the cio_kernel argument is given" do
      let(:param) { "all,!ipdev,!condev" }

      it "returns true" do
        expect(Installation::CIOIgnore.instance.cio_enabled).to eq(true)
      end
    end

    context "when the cio_kernel argument is not given" do
      context "in zVM" do
        let(:zvm) { true }

        it "returns true" do
          expect(Installation::CIOIgnore.instance.cio_enabled).to eq(false)
        end
      end

      context "in KVM" do
        let(:kvm) { true }

        it "returns true" do
          expect(Installation::CIOIgnore.instance.cio_enabled).to eq(false)
        end
      end

      context "in LPAR and others" do
        it "returns false" do
          expect(Installation::CIOIgnore.instance.cio_enabled).to eq(true)
        end
      end
    end
  end
end

describe Installation::CIOIgnoreFinish do
  subject { Installation::CIOIgnoreFinish.new }

  describe "#run" do
    describe "first paramater \"Info\"" do
      it "returns info entry hash with empty \"when\" key for non s390x architectures" do
        arch_mock = double("Yast::Arch", s390: false)
        stub_const("Yast::Arch", arch_mock)

        result = subject.run("Info")

        expect(result["when"]).to be_empty
      end

      it "returns info entry hash with scenarios in \"when\" key for s390x architectures" do
        arch_mock = double("Yast::Arch", s390: true)
        stub_const("Yast::Arch", arch_mock)

        result = subject.run("Info")

        expect(result["when"]).to_not be_empty
      end
    end

    describe "first parameter \"Write\"" do
      let(:param) { "all,!ipldev,!condev" }

      before(:each) do
        stub_const("Yast::Installation", double(destdir: "/mnt"))
        stub_const("Yast::Bootloader", double)

        allow(Yast::Bootloader).to receive(:Write) { true }
        allow(Yast::Bootloader).to receive(:Read) { true }
        allow(Yast::Bootloader).to receive(:modify_kernel_params) { true }
        allow(Yast::Bootloader).to receive(:kernel_param)
          .with(:common, "cio_ignore").and_return(param)

        allow(Yast::WFM).to receive(:Execute)
          .and_return("exit" => 0, "stdout" => "", "stderr" => "")

        allow(File).to receive(:write)
      end

      describe "Device blacklisting is disabled" do
        it "does nothing" do
          Installation::CIOIgnore.instance.cio_enabled = false

          expect(Yast::WFM).to_not receive(:Execute)
          expect(Yast::Bootloader).to_not receive(:Read)

          subject.run("Write")
        end
      end

      describe "Device blacklisting is enabled" do
        it "calls `cio_ignore --unused --purge`" do
          Installation::CIOIgnore.instance.cio_enabled = true

          expect(Yast::WFM).to receive(:Execute)
            .with(
              Installation::CIOIgnoreFinish::YAST_LOCAL_BASH_PATH,
              "/sbin/cio_ignore --unused --purge"
            )
            .once
            .and_return("exit" => 0, "stdout" => "", "stderr" => "")

          subject.run("Write")
        end

        it "raises RuntimeError if cio_ignore call failed" do
          Installation::CIOIgnore.instance.cio_enabled = true
          stderr = "HORRIBLE ERROR!!!"

          expect(Yast::WFM).to receive(:Execute)
            .with(
              Installation::CIOIgnoreFinish::YAST_LOCAL_BASH_PATH,
              "/sbin/cio_ignore --unused --purge"
            )
            .once
            .and_return("exit" => 1, "stdout" => "", "stderr" => stderr)

          expect { subject.run("Write") }.to raise_error(RuntimeError, /stderr/)
        end

        context "when the cio_ignore kernel argument is already given" do
          it "does not touch the kernel parameters" do
            expect(Yast::Bootloader).to_not receive(:modify_kernel_params)
              .with("cio_ignore" => anything)

            subject.run("Write")
          end
        end

        context "when the cio_ignore kernel argument is not given" do
          let(:param) { :missing }
          let(:cio_k_output) { "all,!0009,!0160,!0800-0802" }

          it "adds the parameter using the 'cio_ignore -k' output to the bootloader" do
            expect(Yast::WFM).to receive(:Execute)
              .with(
                Installation::CIOIgnoreFinish::YAST_LOCAL_BASH_PATH,
                "/sbin/cio_ignore -k"
              )
              .once
              .and_return("exit" => 0, "stdout" => cio_k_output, "stderr" => "")
            expect(Yast::Bootloader).to receive(:modify_kernel_params)
              .with("cio_ignore" => cio_k_output).once
              .and_return(true)

            subject.run("Write")
          end
        end

        it "writes list of active devices to zipl so it is not blocked" do
          test_output = <<~CIO_IGNORE
            Devices that are not ignored:
            =============================
            0.0.0160
            0.0.01c0
            0.0.0700-0.0.0702
            0.0.fc00
          CIO_IGNORE
          expect(Yast::WFM).to receive(:Execute)
            .with(
              Installation::CIOIgnoreFinish::YAST_LOCAL_BASH_PATH,
              "/sbin/cio_ignore -L"
            )
            .once
            .and_return("exit" => 0, "stdout" => test_output, "stderr" => "")

          expect(File).to receive(:write).once do |file, content|
            expect(file).to eq("/mnt/boot/zipl/active_devices.txt")
            expect(content).to match(/0.0.0700-0.0.0702/)
            expect(content).to end_with("\n")
          end

          subject.run("Write")
        end

        it "raises an exception if cio_ignore -L failed" do
          expect(Yast::WFM).to receive(:Execute)
            .with(
              Installation::CIOIgnoreFinish::YAST_LOCAL_BASH_PATH,
              "/sbin/cio_ignore -L"
            )
            .once
            .and_return("exit" => 1, "stdout" => "", "stderr" => "FAIL")

          expect { subject.run("Write") }.to raise_error(RuntimeError, /cio_ignore -L failed/)
        end
      end

      describe "I/O device autoconf is disabled" do
        it "adds kernel parameter rd.zdev=no-auto" do
          Installation::CIOIgnore.instance.autoconf_enabled = false

          expect(Yast::Bootloader).to receive(:modify_kernel_params)
            .with("rd.zdev" => "no-auto").once
            .and_return(true)

          subject.run("Write")
        end
      end

      describe "I/O device autoconf is enabled" do
        it "removes kernel parameter rd.zdev" do
          Installation::CIOIgnore.instance.autoconf_enabled = true

          expect(Yast::Bootloader).to receive(:modify_kernel_params)
            .with("rd.zdev" => :missing).once
            .and_return(true)

          subject.run("Write")
        end
      end
    end

    it "raises RuntimeError if unknown action passed as first parameter" do
      expect { subject.run("non_existing_action") }.to(
        raise_error(RuntimeError)
      )
    end
  end
end
