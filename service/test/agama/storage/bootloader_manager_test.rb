# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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
require "agama/storage/bootloader_manager"
require "agama/storage/bootloader_prober"
require "agama/config"
require "bootloader/grub2"
require "bootloader/systemdboot"

describe Agama::Storage::BootloaderManager do
  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:agama_bootloader) { described_class.new(logger) }
  let(:product_config) { instance_double(Agama::Config, data: product_data) }
  let(:product_data) { {} }
  let(:bootloader_obj) { instance_double(::Bootloader::Grub2, name: "grub2", propose: nil) }

  before do
    allow(Yast::BootStorage).to receive(:reset_disks)
    allow(::Bootloader::OsProber).to receive(:package_available=)
    allow(::Bootloader::BootloaderFactory).to receive(:clear_cache)
    allow(::Bootloader::BootloaderFactory).to receive(:current=)
    allow(::Bootloader::BootloaderFactory).to receive(:current).and_return(bootloader_obj)
    allow(bootloader_obj).to receive(:packages).and_return([])
  end

  describe "#probed?" do
    it "returns false initially" do
      expect(agama_bootloader.probed?).to eq(false)
    end

    it "returns true after probe is called" do
      bootloader_prober = instance_double(Agama::Storage::BootloaderProber)
      allow(Agama::Storage::BootloaderProber).to receive(:new).and_return(bootloader_prober)
      allow(bootloader_prober).to receive(:probe).and_return([])

      agama_bootloader.probe
      expect(agama_bootloader.probed?).to eq(true)
    end
  end

  describe "#probe" do
    let(:bootloader_prober) { instance_double(Agama::Storage::BootloaderProber) }
    let(:grub2) { instance_double(Agama::Storage::Bootloader) }
    let(:systemd_boot) { instance_double(Agama::Storage::Bootloader) }
    let(:probed_bootloaders) { [grub2, systemd_boot] }

    before do
      allow(Agama::Storage::BootloaderProber).to receive(:new).and_return(bootloader_prober)
      allow(bootloader_prober).to receive(:probe).and_return(probed_bootloaders)
    end

    it "sets probed flag to true" do
      agama_bootloader.probe
      expect(agama_bootloader.probed?).to eq(true)
    end

    it "stores available bootloaders" do
      agama_bootloader.probe
      expect(agama_bootloader.available_bootloaders).to eq(probed_bootloaders)
    end
  end

  describe "#available_bootloaders" do
    let(:bootloader_prober) { instance_double(Agama::Storage::BootloaderProber) }
    let(:grub2) { instance_double(Agama::Storage::Bootloader) }
    let(:grub2_bls) { instance_double(Agama::Storage::Bootloader) }
    let(:systemd_boot) { instance_double(Agama::Storage::Bootloader) }

    it "returns empty array when probe has not been called" do
      expect(agama_bootloader.available_bootloaders).to eq([])
    end

    it "returns probed bootloaders after probe is called" do
      probed_bootloaders = [grub2, grub2_bls, systemd_boot]
      allow(Agama::Storage::BootloaderProber).to receive(:new).and_return(bootloader_prober)
      allow(bootloader_prober).to receive(:probe).and_return(probed_bootloaders)

      agama_bootloader.probe
      expect(agama_bootloader.available_bootloaders).to eq(probed_bootloaders)
    end
  end

  describe "#configure" do
    context "when bootloader type is not set" do
      context "on an EFI system" do
        before do
          allow(::Bootloader::Systeminfo).to receive(:efi?).and_return(true)
          allow(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .and_return(bootloader_obj)
        end

        context "with x86_64 architecture" do
          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(true)
            allow(Yast::Arch).to receive(:i386).and_return(false)
            allow(Yast::Arch).to receive(:aarch64).and_return(false)
            allow(Yast::Arch).to receive(:arm).and_return(false)
            allow(Yast::Arch).to receive(:riscv64).and_return(false)
          end

          it "calls bootloader_by_name with 'grub2-efi'" do
            expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
              .with("grub2-efi")
              .and_return(bootloader_obj)

            agama_bootloader.configure(product_config)
          end

          context "when product specifies systemd-boot" do
            let(:product_data) { { "boot" => { "default_efi_bootloader" => "systemd-boot" } } }

            it "calls bootloader_by_name with 'systemd-boot'" do
              expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
                .with("systemd-boot")
                .and_return(bootloader_obj)

              agama_bootloader.configure(product_config)
            end
          end

          context "when product specifies grub2-bls" do
            let(:product_data) { { "boot" => { "default_efi_bootloader" => "grub2-bls" } } }

            it "calls bootloader_by_name with 'grub2-bls'" do
              expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
                .with("grub2-bls")
                .and_return(bootloader_obj)

              agama_bootloader.configure(product_config)
            end
          end
        end
      end

      context "on a non-EFI system" do
        before do
          allow(::Bootloader::Systeminfo).to receive(:efi?).and_return(false)
          allow(Yast::Arch).to receive(:x86_64).and_return(true)
          allow(Yast::Arch).to receive(:i386).and_return(false)
          allow(Yast::Arch).to receive(:aarch64).and_return(false)
          allow(Yast::Arch).to receive(:arm).and_return(false)
          allow(Yast::Arch).to receive(:riscv64).and_return(false)
          allow(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .and_return(bootloader_obj)
        end

        it "calls bootloader_by_name with 'grub2'" do
          expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .with("grub2")
            .and_return(bootloader_obj)

          agama_bootloader.configure(product_config)
        end
      end
    end

    context "when bootloader type is explicitly set" do
      before do
        allow(::Bootloader::Systeminfo).to receive(:efi?).and_return(true)
        allow(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
          .and_return(bootloader_obj)
      end

      context "to systemd-boot" do
        before do
          agama_bootloader.config.type = Y2Storage::BootloaderType::SYSTEMD_BOOT
        end

        it "calls bootloader_by_name with 'systemd-boot'" do
          expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .with("systemd-boot")
            .and_return(bootloader_obj)

          agama_bootloader.configure(product_config)
        end
      end

      context "to grub2 on EFI" do
        before do
          agama_bootloader.config.type = Y2Storage::BootloaderType::GRUB2
        end

        it "calls bootloader_by_name with 'grub2-efi'" do
          expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .with("grub2-efi")
            .and_return(bootloader_obj)

          agama_bootloader.configure(product_config)
        end
      end

      context "to grub2 on non-EFI" do
        before do
          allow(::Bootloader::Systeminfo).to receive(:efi?).and_return(false)
          agama_bootloader.config.type = Y2Storage::BootloaderType::GRUB2
        end

        it "calls bootloader_by_name with 'grub2'" do
          expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .with("grub2")
            .and_return(bootloader_obj)

          agama_bootloader.configure(product_config)
        end
      end

      context "to none" do
        before do
          agama_bootloader.config.type = Y2Storage::BootloaderType::NONE
        end

        it "calls bootloader_by_name with 'none'" do
          expect(::Bootloader::BootloaderFactory).to receive(:bootloader_by_name)
            .with("none")
            .and_return(bootloader_obj)

          agama_bootloader.configure(product_config)
        end
      end
    end
  end

  describe "#packages" do
    let(:bootloader_packages) { ["grub2", "grub2-x86_64-efi"] }

    before do
      allow(bootloader_obj).to receive(:packages).and_return(bootloader_packages)
    end

    it "returns packages required by the current bootloader" do
      expect(agama_bootloader.packages).to eq(bootloader_packages)
    end
  end

  describe "#write_extra_kernel_params" do
    let(:extra_params) { "splash=silent quiet" }

    context "when bootloader is GRUB-based" do
      let(:bootloader) { ::Bootloader::Grub2.new }

      it "appends extra kernel parameters" do
        bootloader.grub_default.kernel_params.replace("proposed=1")
        agama_bootloader.send(:write_extra_kernel_params, bootloader, extra_params)
        expect(bootloader.grub_default.kernel_params.serialize).to(
          eq("proposed=1 splash=silent quiet")
        )
      end
    end

    context "when bootloader is systemd-boot" do
      let(:bootloader) { ::Bootloader::SystemdBoot.new }

      it "appends extra kernel parameters" do
        bootloader.kernel_params.replace("proposed=1")
        agama_bootloader.send(:write_extra_kernel_params, bootloader, extra_params)
        expect(bootloader.kernel_params.serialize).to eq("proposed=1 splash=silent quiet")
      end
    end
  end

  describe "#write_timeout" do
    before do
      agama_bootloader.config.timeout = 5
    end

    context "when bootloader is GRUB-based" do
      let(:bootloader) { ::Bootloader::Grub2.new }

      it "sets timeout" do
        agama_bootloader.send(:write_timeout, bootloader)
        expect(bootloader.grub_default.timeout).to eq("5")
      end
    end

    context "when bootloader is systemd-boot" do
      let(:bootloader) { ::Bootloader::SystemdBoot.new }

      it "sets menu_timeout" do
        agama_bootloader.send(:write_timeout, bootloader)
        expect(bootloader.menu_timeout).to eq(5)
      end
    end
  end

  describe "#write_stop_on_boot" do
    before do
      agama_bootloader.config.stop_on_boot_menu = true
    end

    context "when bootloader is GRUB-based" do
      let(:bootloader) { ::Bootloader::Grub2.new }

      it "sets timeout to -1" do
        agama_bootloader.send(:write_stop_on_boot, bootloader)
        expect(bootloader.grub_default.timeout).to eq("-1")
      end
    end

    context "when bootloader is systemd-boot" do
      let(:bootloader) { ::Bootloader::SystemdBoot.new }

      it "sets menu_timeout to -1" do
        agama_bootloader.send(:write_stop_on_boot, bootloader)
        expect(bootloader.menu_timeout).to eq(-1)
      end
    end
  end
end
