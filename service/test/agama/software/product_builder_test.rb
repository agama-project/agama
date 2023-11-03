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

require_relative "../../test_helper"
require "yast"
require "agama/config"
require "agama/product_reader"
require "agama/software/product"
require "agama/software/product_builder"

Yast.import "Arch"

describe Agama::Software::ProductBuilder do
  before do
    allow(Agama::ProductReader).to receive(:new).and_return(reader)
  end

  let(:reader) { instance_double(Agama::ProductReader, load_products: products) }

  let(:products) do
    [
      {
        "id"          => "Test1",
        "name"        => "Product Test 1",
        "description" => "This is a test product named Test 1",
        "software"    => {
          "installation_repositories" => [
            {
              "url"   => "https://repos/test1/x86_64/product/",
              "archs" => "x86_64"
            },
            {
              "url"   => "https://repos/test1/aarch64/product/",
              "archs" => "aarch64"
            }
          ],
          "mandatory_packages"        => [
            {
              "package" => "package1-1"
            },
            "package1-2",
            {
              "package" => "package1-3",
              "archs"   => "aarch64,x86_64"
            },
            {
              "package" => "package1-4",
              "archs"   => "ppc64"
            }
          ],
          "optional_packages"         => ["package1-5"],
          "mandatory_patterns"        => ["pattern1-1", "pattern1-2"],
          "optional_patterns"         => [
            {
              "pattern" => "pattern1-3",
              "archs"   => "x86_64"
            },
            {
              "pattern" => "pattern1-4",
              "archs"   => "aarch64"
            }
          ],
          "base_product"              => "Test1",
          "version"                   => "1.0"
        }
      },
      {
        "id"          => "Test2",
        "name"        => "Product Test 2",
        "description" => "This is a test product named Test 2",
        "archs"       => "x86_64,aarch64",
        "software"    => {
          "mandatory_patterns" => ["pattern2-1"],
          "base_product"       => "Test2",
          "version"            => "2.0"
        }
      },
      {
        "id"          => "Test3",
        "name"        => "Product Test 3",
        "description" => "This is a test product named Test 3",
        "archs"       => "ppc64,aarch64",
        "software"    => {
          "installation_repositories" => ["https://repos/test3/product/"],
          "optional_patterns"         => [
            {
              "pattern" => "pattern3-1",
              "archs"   => "aarch64"
            }
          ],
          "base_product"              => "Test3"
        }
      }
    ]
  end

  subject { described_class.new(config) }

  let(:config) { Agama::Config.new }

  describe "#build" do
    context "for x86_64" do
      before do
        allow(Yast::Arch).to receive("x86_64").and_return(true)
        allow(Yast::Arch).to receive("aarch64").and_return(false)
        allow(Yast::Arch).to receive("ppc64").and_return(false)
        allow(Yast::Arch).to receive("s390").and_return(false)
      end

      it "generates products according to the current architecture" do
        products = subject.build

        expect(products).to all(be_a(Agama::Software::Product))

        expect(products).to contain_exactly(
          an_object_having_attributes(
            id:                 "Test1",
            display_name:       "Product Test 1",
            description:        "This is a test product named Test 1",
            name:               "Test1",
            version:            "1.0",
            repositories:       ["https://repos/test1/x86_64/product/"],
            mandatory_patterns: ["pattern1-1", "pattern1-2"],
            optional_patterns:  ["pattern1-3"],
            mandatory_packages: ["package1-1", "package1-2", "package1-3"],
            optional_packages:  ["package1-5"]
          ),
          an_object_having_attributes(
            id:                 "Test2",
            display_name:       "Product Test 2",
            description:        "This is a test product named Test 2",
            name:               "Test2",
            version:            "2.0",
            repositories:       [],
            mandatory_patterns: ["pattern2-1"],
            optional_patterns:  [],
            mandatory_packages: [],
            optional_packages:  []
          )
        )
      end
    end

    context "for aarch64" do
      before do
        allow(Yast::Arch).to receive("x86_64").and_return(false)
        allow(Yast::Arch).to receive("aarch64").and_return(true)
        allow(Yast::Arch).to receive("ppc64").and_return(false)
        allow(Yast::Arch).to receive("s390").and_return(false)
      end

      it "generates products according to the current architecture" do
        products = subject.build

        expect(products).to all(be_a(Agama::Software::Product))

        expect(products).to contain_exactly(
          an_object_having_attributes(
            id:                 "Test1",
            display_name:       "Product Test 1",
            description:        "This is a test product named Test 1",
            name:               "Test1",
            version:            "1.0",
            repositories:       ["https://repos/test1/aarch64/product/"],
            mandatory_patterns: ["pattern1-1", "pattern1-2"],
            optional_patterns:  ["pattern1-4"],
            mandatory_packages: ["package1-1", "package1-2", "package1-3"],
            optional_packages:  ["package1-5"]
          ),
          an_object_having_attributes(
            id:                 "Test2",
            display_name:       "Product Test 2",
            description:        "This is a test product named Test 2",
            name:               "Test2",
            version:            "2.0",
            repositories:       [],
            mandatory_patterns: ["pattern2-1"],
            optional_patterns:  [],
            mandatory_packages: [],
            optional_packages:  []
          ),
          an_object_having_attributes(
            id:                 "Test3",
            display_name:       "Product Test 3",
            description:        "This is a test product named Test 3",
            name:               "Test3",
            version:            nil,
            repositories:       ["https://repos/test3/product/"],
            mandatory_patterns: [],
            optional_patterns:  ["pattern3-1"],
            mandatory_packages: [],
            optional_packages:  []
          )
        )
      end
    end

    context "for ppc64" do
      before do
        allow(Yast::Arch).to receive("x86_64").and_return(false)
        allow(Yast::Arch).to receive("aarch64").and_return(false)
        allow(Yast::Arch).to receive("ppc64").and_return(true)
        allow(Yast::Arch).to receive("s390").and_return(false)
      end

      it "generates products according to the current architecture" do
        products = subject.build

        expect(products).to all(be_a(Agama::Software::Product))

        expect(products).to contain_exactly(
          an_object_having_attributes(
            id:                 "Test1",
            display_name:       "Product Test 1",
            description:        "This is a test product named Test 1",
            name:               "Test1",
            version:            "1.0",
            repositories:       [],
            mandatory_patterns: ["pattern1-1", "pattern1-2"],
            optional_patterns:  [],
            mandatory_packages: ["package1-1", "package1-2", "package1-4"],
            optional_packages:  ["package1-5"]
          ),
          an_object_having_attributes(
            id:                 "Test3",
            display_name:       "Product Test 3",
            description:        "This is a test product named Test 3",
            name:               "Test3",
            version:            nil,
            repositories:       ["https://repos/test3/product/"],
            mandatory_patterns: [],
            optional_patterns:  [],
            mandatory_packages: [],
            optional_packages:  []
          )
        )
      end
    end

    context "for s390" do
      before do
        allow(Yast::Arch).to receive("x86_64").and_return(false)
        allow(Yast::Arch).to receive("aarch64").and_return(false)
        allow(Yast::Arch).to receive("ppc64").and_return(false)
        allow(Yast::Arch).to receive("s390").and_return(true)
      end

      it "generates products according to the current architecture" do
        products = subject.build

        expect(products).to all(be_a(Agama::Software::Product))

        expect(products).to contain_exactly(
          an_object_having_attributes(
            id:                 "Test1",
            display_name:       "Product Test 1",
            description:        "This is a test product named Test 1",
            name:               "Test1",
            version:            "1.0",
            repositories:       [],
            mandatory_patterns: ["pattern1-1", "pattern1-2"],
            optional_patterns:  [],
            mandatory_packages: ["package1-1", "package1-2"],
            optional_packages:  ["package1-5"]
          )
        )
      end
    end
  end
end
