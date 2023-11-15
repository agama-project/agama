# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require_relative "../test_helper"
require "yast"
require "agama/config"
require "agama/product_reader"

Yast.import "Arch"

describe Agama::Config do
  let(:config) { described_class.new("web" => { "ssl" => "SOMETHING" }) }

  describe ".load" do
    before do
      described_class.reset
    end

    it "reads the configuration from different locations" do
      expect_any_instance_of(Agama::ConfigReader).to receive(:config)
      described_class.load
    end

    it "stores the read configuration and set it as the current one" do
      allow_any_instance_of(Agama::ConfigReader).to receive(:config).and_return(config)
      expect { described_class.load }.to change { described_class.base }.from(nil).to(config)
      expect(described_class.base).to_not eql(described_class.current)
      expect(described_class.base.data).to eql(described_class.current.data)
    end
  end

  describe ".from_file" do
    it "builds a new instance from a given file" do
      config = described_class.from_file(
        File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
      )
      expect(config).to be_a(described_class)
    end
  end

  describe ".reset" do
    it "resets base and current configuration" do
      allow_any_instance_of(Agama::ConfigReader).to receive(:config).and_return(config)
      described_class.load
      expect { described_class.reset }.to change { described_class.base }.from(config).to(nil)
        .and change { described_class.current }.to(nil)
    end
  end

  describe "#data" do
    it "returns memoized configuration data" do
      expect(config.data).to eql("web" => { "ssl" => "SOMETHING" })
    end
  end

  describe "#merge" do
    let(:config_to_merge) { described_class.new("web" => { "ssl" => "MERGED" }) }
    it "returns a new Config with the object data merged with the given Config data" do
      merged_config = config.merge(config_to_merge)
      expect(merged_config.object_id).to_not eql(config.object_id)
      expect(merged_config.object_id).to_not eql(config_to_merge.object_id)
      expect(merged_config.data).to eql(config_to_merge.data)
    end
  end

  describe "#copy" do
    it "returns a copy of the object" do
      copy = subject.copy
      expect(copy.object_id).to_not eq(subject.object_id)
      expect(copy.data).to eql(subject.data)
    end
  end

  describe "#products" do
    it "returns products available for current hardware" do
      allow(Agama::ProductReader).to receive(:new).and_return(double(load_products:
        [
          {
            "id"    => "test",
            "archs" => "x86_64"
          },
          {
            "id"    => "test2",
            "archs" => "s390x"
          }
        ]))
      expect(Yast2::ArchFilter).to receive(:from_string).twice.and_return(double(match?: true),
        double(match?: false))
      expect(subject.products.size).to eq 1
    end
  end

  describe "#multi_product?" do
    context "when more than one product is defined" do
      before do
        allow(Agama::ProductReader).to receive(:new).and_call_original
      end

      it "returns true" do
        expect(subject.multi_product?).to eq(true)
      end
    end

    context "when just one product is defined" do
      before do
        allow(Agama::ProductReader).to receive(:new).and_call_original
        products = Agama::ProductReader.new.load_products
        allow(Agama::ProductReader).to receive(:new)
          .and_return(double(load_products: [products.first]))
      end

      it "returns false" do
        expect(subject.multi_product?).to eq(false)
      end
    end
  end

  describe "#arch_elements_from" do
    subject { described_class.new }

    before do
      allow(Agama::ProductReader).to receive(:new).and_return(reader)
    end

    let(:reader) { instance_double(Agama::ProductReader, load_products: products) }

    context "when the given set of keys does not match any data" do
      let(:products) do
        [
          {
            "id"   => "Product1",
            "name" => "Test product 1"
          }
        ]
      end

      it "returns an empty array" do
        expect(subject.arch_elements_from("Product1", "some", "collection")).to be_empty
      end
    end

    context "when the given set of keys does not contain a collection" do
      let(:products) do
        [
          {
            "id"   => "Product1",
            "name" => "Test product 1"
          }
        ]
      end

      it "returns an empty array" do
        expect(subject.arch_elements_from("Product1", "name")).to be_empty
      end
    end

    context "when the given set of keys contains a collection" do
      let(:products) do
        [
          {
            "id"   => "Product1",
            "some" => {
              "collection" => [
                "element1",
                {
                  "element" => "element2"
                },
                {
                  "element" => "element3",
                  "archs"   => "x86_64"
                },
                {
                  "element" => "element4",
                  "archs"   => "x86_64,aarch64"
                },
                {
                  "element" => "element5",
                  "archs"   => "ppc64"
                }
              ]
            }
          }
        ]
      end

      before do
        allow(Yast::Arch).to receive("x86_64").and_return(true)
        allow(Yast::Arch).to receive("aarch64").and_return(false)
        allow(Yast::Arch).to receive("ppc64").and_return(false)
      end

      it "returns all the elements that match the current arch" do
        elements = subject.arch_elements_from("Product1", "some", "collection")

        expect(elements).to contain_exactly(
          "element1",
          { "element" => "element2" },
          { "element" => "element3", "archs" => "x86_64" },
          { "element" => "element4", "archs" => "x86_64,aarch64" }
        )
      end

      context "and there are no elements matching the current arch" do
        let(:products) do
          [
            {
              "id"   => "Product1",
              "some" => {
                "collection" => [
                  {
                    "element" => "element1",
                    "archs"   => "aarch64"
                  },
                  {
                    "element" => "element2",
                    "archs"   => "ppc64"
                  }
                ]
              }
            }
          ]
        end

        it "returns an empty list" do
          elements = subject.arch_elements_from("Product1", "some", "collection")

          expect(elements).to be_empty
        end
      end

      context "and some property is requested" do
        it "returns the property from all elements that match the current arch" do
          elements = subject.arch_elements_from(
            "Product1", "some", "collection", property: :element
          )

          expect(elements).to contain_exactly("element1", "element2", "element3", "element4")
        end
      end

      context "and the requested property does not exit" do
        it "only return elements that are direct values" do
          elements = subject.arch_elements_from("Product1", "some", "collection", property: :foo)

          expect(elements).to contain_exactly("element1")
        end
      end
    end
  end
end
