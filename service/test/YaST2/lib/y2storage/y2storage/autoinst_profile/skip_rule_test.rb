#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::AutoinstProfile::SkipRule do
  include_context "yast2-storage-ng test setup"

  subject(:rule) { described_class.new(key, predicate, reference) }

  let(:key) { "size_k" }
  let(:reference) { "1024" }
  let(:predicate) { :less_than }
  let(:disk) { instance_double("Y2Storage::Disk") }
  let(:size_k) { 1024 }
  let(:value) do
    double(
      "Y2Storage::AutoinstProfile::SkipListValue",
      size_k: size_k,
      device: "/dev/sda",
      driver: ["ahci", "sd"]
    )
  end

  before do
    allow(Y2Storage::AutoinstProfile::SkipListValue).to receive(:new).and_return(value)
  end

  describe ".from_profile_rule" do
    let(:hash) do
      { "skip_key" => "size_k", predicate => true, "skip_value" => "1024" }
    end

    let(:predicate) { "skip_if_less_than" }

    it "returns a rule for the given value, predicate and reference" do
      rule = described_class.from_profile_rule(hash)
      expect(rule.predicate).to eq(:less_than)
      expect(rule.raw_reference).to eq("1024")
      expect(rule.key).to eq("size_k")
    end

    context "when predicate is 'skip_if_more_than'" do
      let(:predicate) { "skip_if_more_than" }

      it "sets predicate to :more_than" do
        rule = described_class.from_profile_rule(hash)
        expect(rule.predicate).to eq(:more_than)
      end
    end

    context "when predicate is 'skip_if_less_than'" do
      let(:predicate) { "skip_if_less_than" }

      it "sets predicate to :less_than" do
        rule = described_class.from_profile_rule(hash)
        expect(rule.predicate).to eq(:less_than)
      end
    end

    context "when predicate is missing" do
      let(:hash) do
        { "skip_key" => "size_k", "skip_value" => "1024" }
      end

      it "sets predicate to :equal_to" do
        rule = described_class.from_profile_rule(hash)
        expect(rule.predicate).to eq(:equal_to)
      end
    end
  end

  describe "#matches?" do
    context "when predicate is less_than" do
      let(:predicate) { :less_than }

      context "when current value is greater than the reference one" do
        let(:size_k) { 2048 }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "when current value is equal to the reference one" do
        let(:size_k) { 1024 }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "when current value is less than the reference one" do
        let(:size_k) { 512 }

        it "returns true" do
          expect(rule.matches?(disk)).to be(true)
        end
      end

      context "and the value is a symbol" do
        let(:key) { "device" }
        let(:device) { :sda }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and value is a string" do
        let(:key) { "device" }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and value is nil" do
        let(:size_k) { nil }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and rule is not valid" do
        let(:key) { nil }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end
    end

    context "when predicate is greater_than" do
      let(:predicate) { :more_than }

      context "when current value is greater than the reference one" do
        let(:size_k) { 2048 }

        it "returns true" do
          expect(rule.matches?(disk)).to be(true)
        end
      end

      context "when current value is equal to the reference one" do
        let(:size_k) { 1024 }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "when current value is less than the reference one" do
        let(:size_k) { 512 }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and the value is a symbol" do
        let(:key) { "device" }
        let(:device) { :sda }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and value is a string" do
        let(:key) { "device" }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and value is nil" do
        let(:size_k) { nil }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end
    end

    context "when predicate is equal_than" do
      let(:predicate) { :equal_to }

      context "and current value is equal to the reference one" do
        let(:size_k) { 1024 }

        it "returns true" do
          expect(rule.matches?(disk)).to be(true)
        end
      end

      context "and current value is different to the reference one" do
        let(:size_k) { 1025 }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "and the value is a symbol" do
        let(:size_k) { :some_value }

        context "and the value matches" do
          let(:reference) { "some_value" }

          it "returns true" do
            expect(rule.matches?(disk)).to be(true)
          end
        end

        context "and the value does not match" do
          let(:reference) { "not_matching_value" }

          it "returns false" do
            expect(rule.matches?(disk)).to be(false)
          end
        end
      end

      context "and value is a string" do
        context "and the value matches" do
          let(:size_k) { "1024" }

          it "returns true" do
            expect(rule.matches?(disk)).to be(true)
          end
        end

        context "and the value does not match" do
          let(:size_k) { "1025" }

          it "returns false" do
            expect(rule.matches?(disk)).to be(false)
          end
        end
      end

      context "and value is nil" do
        let(:size_k) { nil }

        it "returns false" do
          expect(rule.matches?(disk)).to be(false)
        end
      end

      context "when current value is an array" do
        let(:key) { "driver" }

        context "and some value matches" do
          let(:reference) { "ahci" }

          it "returns true" do
            expect(rule.matches?(disk)).to be(true)
          end
        end

        context "no value matches" do
          let(:reference) { "some_driver" }

          it "returns false" do
            expect(rule.matches?(disk)).to be(false)
          end
        end
      end
    end

    context "when key is not supported" do
      before do
        allow(value).to receive(key).and_raise(NoMethodError)
      end

      it "returns false" do
        expect(rule.matches?(disk)).to eq(false)
      end

      it "logs a warning" do
        expect(rule.log).to receive(:warn).with("Unknown skip list key: size_k")
        rule.matches?(disk)
      end
    end
  end

  describe "#valid?" do
    subject(:rule) { described_class.new(key, predicate, reference) }
    let(:key) { "size_k" }
    let(:value) { 0 }
    let(:predicate) { :equal_to }

    it "returns true" do
      expect(rule).to be_valid
    end

    context "when skip key is missing" do
      let(:key) { nil }

      it "returns false" do
        expect(rule).to_not be_valid
      end
    end

    context "when skip reference value is missing" do
      let(:reference) { nil }

      it "returns false" do
        expect(rule).to_not be_valid
      end
    end

    context "when predicate is missing" do
      let(:predicate) { nil }

      it "returns false" do
        expect(rule).to_not be_valid
      end
    end
  end

  describe "#to_profile_rule" do
    it "returns a hash with key, value and predicate" do
      expect(rule.to_profile_rule).to eq(
        "skip_if_less_than" => true,
        "skip_key"          => "size_k",
        "skip_value"        => "1024"
      )
    end

    context "when predicate is :less_than" do
      let(:predicate) { :less_than }

      it "includes a 'skip_if_less_than' element" do
        expect(rule.to_profile_rule).to include("skip_if_less_than" => true)
      end
    end

    context "when predicate is :more_than" do
      let(:predicate) { :more_than }

      it "includes a 'skip_if_more_than' element" do
        expect(rule.to_profile_rule).to include("skip_if_more_than" => true)
      end
    end

    context "otherwise" do
      let(:predicate) { :equal_to }

      it "does not include a predicate at all" do
        expect(rule.to_profile_rule).to eq(
          "skip_key"   => "size_k",
          "skip_value" => "1024"
        )
      end
    end
  end

  describe "#inspect" do
    it "returns an string in order to inspect the object" do
      expect(rule.inspect).to eq("<SkipRule key='size_k' predicate='less_than' reference='1024'>")
    end
  end
end
