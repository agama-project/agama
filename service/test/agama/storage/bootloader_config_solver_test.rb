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

require_relative "../../test_helper"

require "agama/storage/bootloader_config_solver"
require "agama/storage/bootloader_config"
require "agama/config"
require "agama/cmdline_args"

describe Agama::Storage::BootloaderConfigSolver do
  subject(:solver) { described_class.new(product_config) }

  let(:product_config) { instance_double(Agama::Config, data: product_data) }
  let(:product_data) { {} }
  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }
  let(:cmdline_args) { instance_double(Agama::CmdlineArgs, data: {}) }

  before do
    allow(Agama::CmdlineArgs).to receive(:read_from_kernel).and_return(cmdline_args)
  end

  describe "#solve" do
    context "when the config already has a type set" do
      before do
        bootloader_config.type = Y2Storage::BootloaderType::SYSTEMD_BOOT
      end

      it "does not modify the type" do
        solver.solve(bootloader_config)
        expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
      end
    end

    context "when the config does not have a type set" do
      context "on a non-EFI system" do
        before do
          allow(Bootloader::Systeminfo).to receive(:efi?).and_return(false)
        end

        it "sets the type to GRUB2" do
          solver.solve(bootloader_config)
          expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
        end
      end

      context "on an EFI system" do
        before do
          allow(Bootloader::Systeminfo).to receive(:efi?).and_return(true)
        end

        context "on a non-BLS architecture" do
          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(false)
            allow(Yast::Arch).to receive(:i386).and_return(false)
            allow(Yast::Arch).to receive(:aarch64).and_return(false)
            allow(Yast::Arch).to receive(:arm).and_return(false)
            allow(Yast::Arch).to receive(:riscv64).and_return(false)
          end

          it "sets the type to GRUB2" do
            solver.solve(bootloader_config)
            expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
          end
        end

        context "on a BLS-supported architecture (x86_64)" do
          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(true)
            allow(Yast::Arch).to receive(:i386).and_return(false)
            allow(Yast::Arch).to receive(:aarch64).and_return(false)
            allow(Yast::Arch).to receive(:arm).and_return(false)
            allow(Yast::Arch).to receive(:riscv64).and_return(false)
          end

          context "when systemd_boot_preview kernel parameter is set" do
            let(:cmdline_args) do
              instance_double(Agama::CmdlineArgs, data: { "systemd_boot_preview" => "1" })
            end

            context "and the product does not specify a default EFI bootloader" do
              let(:product_data) { {} }

              it "sets the type to SYSTEMD_BOOT (from kernel args)" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
              end
            end

            context "and the product specifies a different bootloader" do
              let(:product_data) { { "boot" => { "default_efi_bootloader" => "grub2-bls" } } }

              it "sets the type to SYSTEMD_BOOT (kernel args take priority)" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
              end
            end
          end

          context "when systemd_boot_preview kernel parameter has invalid value" do
            let(:cmdline_args) do
              instance_double(Agama::CmdlineArgs, data: { "systemd_boot_preview" => "yes" })
            end

            it "ignores the parameter and uses product/default bootloader" do
              solver.solve(bootloader_config)
              expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
            end
          end

          context "when systemd_boot_preview kernel parameter is not set" do
            let(:cmdline_args) { instance_double(Agama::CmdlineArgs, data: {}) }

            context "and the product does not specify a default EFI bootloader" do
              let(:product_data) { {} }

              it "sets the type to GRUB2 (default BLS type)" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
              end
            end

            context "and the product specifies a default EFI bootloader" do
              let(:product_data) { { "boot" => { "default_efi_bootloader" => "systemd-boot" } } }

              it "sets the type to the product-specified bootloader" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
              end
            end

            context "and the product specifies grub2-bls as default EFI bootloader" do
              let(:product_data) { { "boot" => { "default_efi_bootloader" => "grub2-bls" } } }

              it "sets the type to GRUB2_BLS" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2_BLS)
              end
            end

            context "and the product specifies an invalid bootloader type" do
              let(:product_data) { { "boot" => { "default_efi_bootloader" => "invalid" } } }

              it "falls back to GRUB2 (default BLS type)" do
                solver.solve(bootloader_config)
                expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
              end
            end
          end
        end

        context "on a BLS-supported architecture (aarch64)" do
          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(false)
            allow(Yast::Arch).to receive(:i386).and_return(false)
            allow(Yast::Arch).to receive(:aarch64).and_return(true)
            allow(Yast::Arch).to receive(:arm).and_return(false)
            allow(Yast::Arch).to receive(:riscv64).and_return(false)
          end

          context "when the product does not specify a default EFI bootloader" do
            let(:product_data) { {} }

            it "sets the type to GRUB2 (default BLS type)" do
              solver.solve(bootloader_config)
              expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
            end
          end

          context "when the product specifies systemd-boot" do
            let(:product_data) { { "boot" => { "default_efi_bootloader" => "systemd-boot" } } }

            it "sets the type to SYSTEMD_BOOT" do
              solver.solve(bootloader_config)
              expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::SYSTEMD_BOOT)
            end
          end
        end

        context "on a BLS-supported architecture (riscv64)" do
          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(false)
            allow(Yast::Arch).to receive(:i386).and_return(false)
            allow(Yast::Arch).to receive(:aarch64).and_return(false)
            allow(Yast::Arch).to receive(:arm).and_return(false)
            allow(Yast::Arch).to receive(:riscv64).and_return(true)
          end

          it "sets the type to GRUB2 when product doesn't specify" do
            solver.solve(bootloader_config)
            expect(bootloader_config.type).to eq(Y2Storage::BootloaderType::GRUB2)
          end
        end
      end
    end
  end
end
