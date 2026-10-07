# Copyright (c) [2020-2021] SUSE LLC
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
require "installation/autoinst_profile/section_with_attributes"

describe Installation::AutoinstProfile::SectionWithAttributes do
  # <root>
  #   <foo>sample</foo>
  #   <children t="list">
  #     <child><name>Child 1</name></child>
  #     <child><name>Child 1</name></child>
  #   </children>
  #   <group>
  #     <name>Some group</name>
  #   </group>
  # </root>
  class RootSection < described_class
    class << self
      def attributes
        [
          { name: :foo },
          { name: :children },
          { name: :group }
        ]
      end

      def new_from_hashes(hash = {})
        result = new
        result.init_from_hashes(hash)
        if hash["children"]
          result.children = hash["children"].map do |c|
            ChildSection.new_from_hashes(c, result)
          end
        end
        result.group = GroupSection.new_from_hashes(hash["group"], result) if hash["group"]
        result
      end
    end

    define_attr_accessors

    def initialize
      super

      @children = []
      @group = nil
    end
  end

  class ChildSection < described_class
    class << self
      def attributes
        [
          { name: :name }
        ]
      end
    end

    define_attr_accessors

    def collection_name
      "children"
    end
  end

  class GroupSection < described_class
    class << self
      def attributes
        [
          { name: :name, allow_blank: true },
          { name: :other, allow_blank: false }
        ]
      end
    end

    define_attr_accessors
  end

  subject { RootSection.new }

  describe "an instance" do
    it "offers accessors to known attributes" do
      expect(subject).to respond_to(:foo)
      expect(subject).to respond_to(:foo=)
    end
  end

  describe ".new_from_hashes" do
    it "returns an instance including the given data" do
      group = GroupSection.new_from_hashes(name: "users")
      expect(group.name).to eq("users")
    end

    context "when an attribute allows blank" do
      context "and the hash does not contain that key" do
        let(:hash) { { other: "" } }

        it "assigns nil to the attribute" do
          group = GroupSection.new_from_hashes(hash)

          expect(group.name).to be_nil
        end
      end

      context "and the hash contains that key" do
        context "and the value for the key is nil" do
          let(:hash) { { name: nil } }

          it "assigns nil to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.name).to be_nil
          end
        end

        context "and the value for the key is blank" do
          let(:hash) { { name: "" } }

          it "assigns blank to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.name).to eq("")
          end
        end

        context "and the value for the key is not blank" do
          let(:hash) { { name: "a name" } }

          it "assigns the given value to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.name).to eq("a name")
          end
        end
      end
    end

    context "when an attribute does not allow blank" do
      context "and the hash does not contain that key" do
        let(:hash) { { name: "" } }

        it "assigns nil to the attribute" do
          group = GroupSection.new_from_hashes(hash)

          expect(group.other).to be_nil
        end
      end

      context "and the hash contains that key" do
        context "and the value for the key is nil" do
          let(:hash) { { other: nil } }

          it "assigns nil to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.other).to be_nil
          end
        end

        context "and the value for the key is blank" do
          let(:hash) { { other: "" } }

          it "assigns nil to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.other).to be_nil
          end
        end

        context "and the value for the key is not blank" do
          let(:hash) { { other: "a name" } }

          it "assigns the given value to the attribute" do
            group = GroupSection.new_from_hashes(hash)

            expect(group.other).to eq("a name")
          end
        end
      end
    end

    context "when nil is given" do
      it "returns a instance" do
        group = GroupSection.new_from_hashes(nil)
        expect(group.name).to be_nil
      end
    end

    context "when an empty string is given" do
      it "returns a instance" do
        group = GroupSection.new_from_hashes("")
        expect(group.name).to be_nil
      end
    end
  end

  describe "#section_path" do
    context "when the section does not have a parent" do
      subject { RootSection.new }

      it "returns a path containing only the section name" do
        expect(subject.section_path)
          .to eq(Installation::AutoinstProfile::ElementPath.new("root"))
      end
    end

    context "when the section have a parent" do
      let(:parent) do
        RootSection.new_from_hashes(
          "group" => { "name" => "some" }
        )
      end

      subject { parent.group }

      it "returns a path containing all section names an indexes" do
        expect(subject.section_path)
          .to eq(Installation::AutoinstProfile::ElementPath.new("root", "group"))
      end
    end

    context "when the section is included in an array" do
      let(:parent) do
        RootSection.new_from_hashes(
          "children" => [{ "name" => "first" }, { "name" => "second" }]
        )
      end

      subject { parent.children.first }

      it "returns a path including the position in the array" do
        expect(subject.section_path)
          .to eq(Installation::AutoinstProfile::ElementPath.new("root", "children", 0))
      end
    end
  end
end
