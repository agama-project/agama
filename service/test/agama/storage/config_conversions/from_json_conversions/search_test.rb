# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_conversions/from_json_conversions/search"
require "agama/storage/configs/search"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromJSONConversions::Search do
  subject do
    described_class.new(config_json)
  end

  let(:config_json) do
    {
      condition:  condition,
      max:        max,
      ifNotFound: if_not_found
    }
  end

  let(:condition) { nil }
  let(:max) { nil }
  let(:if_not_found) { nil }

  describe "#convert" do
    it "returns a search config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::Search)
    end

    context "with a device name" do
      let(:config_json) { "/dev/vda1" }

      it "sets #name to the expected value" do
        config = subject.convert
        expect(config.name).to eq("/dev/vda1")
      end

      it "sets #size to the expected value" do
        config = subject.convert
        expect(config.size).to be_nil
      end

      it "sets #partition_number to the expected value" do
        config = subject.convert
        expect(config.partition_number).to be_nil
      end

      it "sets #max to the expected value" do
        config = subject.convert
        expect(config.max).to be_nil
      end

      it "sets #if_not_found to the expected value" do
        config = subject.convert
        expect(config.if_not_found).to eq(:error)
      end
    end

    context "with an asterisk" do
      let(:config_json) { "*" }

      it "sets #name to the expected value" do
        config = subject.convert
        expect(config.name).to be_nil
      end

      it "sets #size to the expected value" do
        config = subject.convert
        expect(config.size).to be_nil
      end

      it "sets #partition_number to the expected value" do
        config = subject.convert
        expect(config.partition_number).to be_nil
      end

      it "sets #max to the expected value" do
        config = subject.convert
        expect(config.max).to be_nil
      end

      it "sets #if_not_found to the expected value" do
        config = subject.convert
        expect(config.if_not_found).to eq(:skip)
      end
    end

    context "with a search section" do
      context "if 'condition' is not specefied" do
        let(:condition) { nil }

        it "sets #name to the expected value" do
          config = subject.convert
          expect(config.name).to be_nil
        end

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size).to be_nil
        end

        it "sets #partition_number to the expected value" do
          config = subject.convert
          expect(config.partition_number).to be_nil
        end
      end

      context "if 'max' is not specified" do
        let(:max) { nil }

        it "sets #max to the expected value" do
          config = subject.convert
          expect(config.max).to be_nil
        end
      end

      context "if 'ifNotFound' is not specified" do
        let(:if_not_found) { nil }

        it "sets #if_not_found to the expected value" do
          config = subject.convert
          expect(config.if_not_found).to eq(:error)
        end
      end

      context "if 'condition' is specefied" do
        context "and 'name' is specified" do
          let(:condition) { { name: "/dev/vda" } }

          it "sets #name to the expected value" do
            config = subject.convert
            expect(config.name).to eq("/dev/vda")
          end
        end

        context "and 'size' is specified" do
          let(:condition) { { size: size } }

          context "without operator" do
            let(:size) { "2 GiB" }

            it "sets #size to the expected value" do
              config = subject.convert
              expect(config.size).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.size.value).to eq(2.GiB)
              expect(config.size.operator).to eq(:equal)
            end
          end

          context "with 'equal' operator" do
            let(:size) { { equal: "2 GiB" } }

            it "sets #size to the expected value" do
              config = subject.convert
              expect(config.size).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.size.value).to eq(2.GiB)
              expect(config.size.operator).to eq(:equal)
            end
          end

          context "with 'greater' operator" do
            let(:size) { { greater: "2 GiB" } }

            it "sets #size to the expected value" do
              config = subject.convert
              expect(config.size).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.size.value).to eq(2.GiB)
              expect(config.size.operator).to eq(:greater)
            end
          end

          context "with 'less' operator" do
            let(:size) { { less: "2 GiB" } }

            it "sets #size to the expected value" do
              config = subject.convert
              expect(config.size).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.size.value).to eq(2.GiB)
              expect(config.size.operator).to eq(:less)
            end
          end
        end

        context "and 'number' is specified" do
          let(:condition) { { number: 2 } }
          it "sets #partition_number to the expected value" do
            config = subject.convert
            expect(config.partition_number).to eq(2)
          end
        end
      end

      context "if 'max' is specified" do
        let(:max) { 3 }

        it "sets #max to the expected value" do
          config = subject.convert
          expect(config.max).to eq(3)
        end
      end

      context "if 'ifNotFound' is specified" do
        let(:if_not_found) { "skip" }

        it "sets #if_not_found to the expected value" do
          config = subject.convert
          expect(config.if_not_found).to eq(:skip)
        end
      end
    end
  end
end
