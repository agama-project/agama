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

require_relative "../../../../test_helper"
require "agama/storage/config_conversions/from_model_conversions/boot"
require "agama/storage/configs/boot"
require "agama/storage/configs/drive"
require "agama/storage/configs/search"

describe Agama::Storage::ConfigConversions::FromModelConversions::Boot do
  subject do
    described_class.new(model_json, targets)
  end

  let(:model_json) do
    {
      configure: configure,
      device:    {
        default: default,
        name:    name
      }
    }
  end

  let(:configure) { false }
  let(:default) { false }
  let(:name) { nil }

  let(:targets) { [] }

  describe "#convert" do
    it "returns a boot config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::Boot)
    end

    context "if boot is not set to be configured" do
      let(:configure) { false }
      let(:default) { true }
      let(:name) { "/dev/vda" }

      it "returns the expected config" do
        config = subject.convert
        expect(config.configure?).to eq(false)
        expect(config.device.default?).to eq(true)
        expect(config.device.device_alias).to be_nil
      end
    end

    context "if boot is set to be configured" do
      let(:configure) { true }

      context "and the boot device is set to default" do
        let(:default) { true }
        let(:name) { "/dev/vda" }

        it "returns the expected config" do
          config = subject.convert
          expect(config.configure?).to eq(true)
          expect(config.device.default?).to eq(true)
          expect(config.device.device_alias).to be_nil
        end
      end

      context "and the boot device is not set to default" do
        let(:default) { false }

        context "and the boot device does not specify 'name'" do
          let(:name) { nil }

          it "returns the expected config" do
            config = subject.convert
            expect(config.configure?).to eq(true)
            expect(config.device.default?).to eq(false)
            expect(config.device.device_alias).to be_nil
          end
        end

        context "and the boot device specifies a 'name'" do
          let(:name) { "/dev/vda" }

          context "and there is a target for the given boot device name" do
            let(:targets) { [drive] }

            let(:drive) do
              Agama::Storage::Configs::Drive.new.tap do |drive|
                drive.search = Agama::Storage::Configs::Search.new.tap do |s|
                  s.condition = Agama::Storage::Configs::SearchConditions::Name.new(name)
                end
              end
            end

            it "sets an alias to the drive config" do
              subject.convert
              expect(drive.alias).to_not be_nil
            end

            it "returns the expected config" do
              config = subject.convert
              expect(config.configure?).to eq(true)
              expect(config.device.default?).to eq(false)
              expect(config.device.device_alias).to eq(drive.alias)
            end
          end

          context "and there is not a target for the given boot device name" do
            let(:drives) { [] }

            it "returns the expected config" do
              config = subject.convert
              expect(config.configure?).to eq(true)
              expect(config.device.default?).to eq(false)
              expect(config.device.device_alias).to be_nil
            end
          end
        end
      end
    end
  end
end
