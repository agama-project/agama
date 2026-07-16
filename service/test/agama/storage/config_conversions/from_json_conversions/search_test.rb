# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/storage/configs/search_conditions"
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

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition)
          .to be_a(Agama::Storage::Configs::SearchConditions::Name)
        expect(config.condition.name).to eq("/dev/vda1")
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

      it "sets #condition to the expected value" do
        config = subject.convert
        expect(config.condition).to be_nil
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

        it "sets #condition to the expected value" do
          config = subject.convert
          expect(config.condition).to be_nil
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

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::Name)
            expect(config.condition.name).to eq("/dev/vda")
          end
        end

        context "and 'size' is specified" do
          let(:condition) { { size: size } }

          context "without operator" do
            let(:size) { "2 GiB" }

            it "sets #condition to the expected value" do
              config = subject.convert
              expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.condition.value).to eq(2.GiB)
              expect(config.condition.operator).to eq(:equal)
            end
          end

          context "with 'equal' operator" do
            let(:size) { { equal: "2 GiB" } }

            it "sets #condition to the expected value" do
              config = subject.convert
              expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.condition.value).to eq(2.GiB)
              expect(config.condition.operator).to eq(:equal)
            end
          end

          context "with 'greater' operator" do
            let(:size) { { greater: "2 GiB" } }

            it "sets #condition to the expected value" do
              config = subject.convert
              expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.condition.value).to eq(2.GiB)
              expect(config.condition.operator).to eq(:greater)
            end
          end

          context "with 'less' operator" do
            let(:size) { { less: "2 GiB" } }

            it "sets #condition to the expected value" do
              config = subject.convert
              expect(config.condition).to be_a(Agama::Storage::Configs::SearchConditions::Size)
              expect(config.condition.value).to eq(2.GiB)
              expect(config.condition.operator).to eq(:less)
            end
          end
        end

        context "and 'number' is specified" do
          let(:condition) { { number: 2 } }

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::PartitionNumber)
            expect(config.condition.number).to eq(2)
          end
        end

        context "and an 'and' operator is specified" do
          let(:condition) do
            { and: [{ name: "/dev/vda" }, { size: { less: "1 TiB" } }] }
          end

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::And)

            conditions = config.condition.conditions
            expect(conditions.size).to eq(2)

            expect(conditions[0])
              .to be_a(Agama::Storage::Configs::SearchConditions::Name)
            expect(conditions[0].name).to eq("/dev/vda")

            expect(conditions[1])
              .to be_a(Agama::Storage::Configs::SearchConditions::Size)
            expect(conditions[1].value).to eq(1.TiB)
            expect(conditions[1].operator).to eq(:less)
          end
        end

        context "and an 'or' operator is specified" do
          let(:condition) do
            { or: [{ number: 1 }, { number: 2 }] }
          end

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::Or)

            conditions = config.condition.conditions
            expect(conditions.size).to eq(2)
            expect(conditions).to all(
              be_a(Agama::Storage::Configs::SearchConditions::PartitionNumber)
            )
            expect(conditions.map(&:number)).to contain_exactly(1, 2)
          end
        end

        context "and a 'not' operator is specified" do
          let(:condition) { { not: { name: "/dev/vda" } } }

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::Not)

            inner = config.condition.condition
            expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Name)
            expect(inner.name).to eq("/dev/vda")
          end
        end

        context "and nested operators are specified" do
          let(:condition) do
            {
              and: [
                { size: { less: "1 TiB" } },
                { not: { name: "/dev/vda" } }
              ]
            }
          end

          it "sets #condition to the expected value" do
            config = subject.convert
            expect(config.condition)
              .to be_a(Agama::Storage::Configs::SearchConditions::And)

            conditions = config.condition.conditions
            expect(conditions.size).to eq(2)

            expect(conditions[0])
              .to be_a(Agama::Storage::Configs::SearchConditions::Size)
            expect(conditions[0].value).to eq(1.TiB)
            expect(conditions[0].operator).to eq(:less)

            expect(conditions[1])
              .to be_a(Agama::Storage::Configs::SearchConditions::Not)
            inner = conditions[1].condition
            expect(inner).to be_a(Agama::Storage::Configs::SearchConditions::Name)
            expect(inner.name).to eq("/dev/vda")
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
