# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/bootloader"
require "bootloader/grub2"
require "bootloader/systemdboot"

describe Agama::Storage::Bootloader do
  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:agama_bootloader) { described_class.new(logger) }

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
