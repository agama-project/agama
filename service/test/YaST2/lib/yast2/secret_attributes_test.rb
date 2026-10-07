#!/usr/bin/env rspec
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

require_relative "../test_helper"
require "yast2/secret_attributes"
require "pp"

describe Yast2::SecretAttributes do
  # Dummy test clase
  class ClassWithPassword
    include Yast2::SecretAttributes

    attr_accessor :name

    secret_attr :password
  end

  # Another dummy test clase
  class ClassWithData
    include Yast2::SecretAttributes

    attr_accessor :name

    secret_attr :data
  end

  # Hypothetical custom formatter that uses instrospection to directly query the
  # internal state of the object, ignoring the uniform access principle.
  def custom_formatter(object)
    object.instance_variables.each_with_object("") do |var, result|
      result << "@#{var}: #{object.instance_variable_get(var)};\n"
    end
  end

  let(:with_password) { ClassWithPassword.new }
  let(:with_password2) { ClassWithPassword.new }
  let(:with_data) { ClassWithData.new }
  let(:ultimate_hash) { { ultimate_question: 42 } }

  describe ".secret_attr" do
    it "provides a getter returning nil by default" do
      expect(with_password.password).to be_nil
      expect(with_data.data).to be_nil
      expect(with_data.send(:data)).to be_nil
    end

    it "provides a setter" do
      with_password.password = "super-secret"
      expect(with_password.password).to eq "super-secret"
      expect(with_password.send(:password)).to eq "super-secret"
    end

    it "only adds the setter and getter to the correct class" do
      expect { with_password.data }.to raise_error NoMethodError
      expect { with_data.password }.to raise_error NoMethodError
      expect { with_password.data = 2 }.to raise_error NoMethodError
      expect { with_data.password = "xx" }.to raise_error NoMethodError
    end

    it "does not mess attributes of different instances" do
      with_password.password = "super-secret"
      with_password2.password = "not so secret"
      expect(with_password.password).to eq "super-secret"
      expect(with_password2.password).to eq "not so secret"
    end

    it "does not modify #inspect for the attribute" do
      expect(with_data.data.inspect).to eq "nil"

      with_data.data = ultimate_hash

      expect(with_data.data.inspect).to eq ultimate_hash.inspect
    end

    it "does not modify #to_s for the attribute" do
      expect(with_data.data.to_s).to eq ""

      with_data.data = ultimate_hash

      expect(with_data.data.to_s).to eq ultimate_hash.to_s
      expect(with_data.send(:data).to_s).to eq ultimate_hash.to_s
    end

    it "does not modify interpolation for the attribute" do
      expect("String: #{with_data.data}").to eq "String: "

      with_data.data = ultimate_hash

      expect("String: #{with_data.data}").to eq "String: #{ultimate_hash}"
    end

    it "is copied in dup just like .attr_accessor" do
      with_password.name = "data1"
      with_password.password = "xxx"
      duplicate = with_password.dup

      expect(duplicate.name).to eq "data1"
      expect(duplicate.password).to eq "xxx"

      duplicate.password = "yyy"
      expect(duplicate.password).to eq "yyy"
      expect(with_password.password).to eq "xxx"

      with_password2.name = "data2"
      with_password2.password = "xx2"
      duplicate2 = with_password2.dup
      duplicate2.name.concat("X")
      duplicate2.password.concat("X")

      expect(with_password2.name).to eq "data2X"
      expect(with_password2.password).to eq "xx2X"
    end

    context "when the attribute has never been set" do
      it "is not displayed in #inspect (like .attr_accessor)" do
        expect(with_password.inspect).to_not include "@name"
        expect(with_password.inspect).to_not include "@password"
      end

      it "is not displayed by pp (like .attr_accessor)" do
        expect(with_password.inspect).to_not include "@name"
        expect(with_password.inspect).to_not include "@password"
      end

      it "is not exposed to formatters directly inspecting the internal state" do
        expect(custom_formatter(with_password)).to_not include "@name:"
        expect(custom_formatter(with_password)).to_not include "@password:"
      end
    end

    context "when the attribute has been set to nil" do
      before do
        with_password.name = nil
        with_password.password = nil
      end

      it "is displayed as nil in #inspect (like .attr_accessor)" do
        expect(with_password.inspect).to include "@name=nil"
        expect(with_password.inspect).to include "@password=nil"
      end

      it "is displayed as nil by pp (like .attr_accessor)" do
        expect(with_password.inspect).to include "@name=nil"
        expect(with_password.inspect).to include "@password=nil"
      end

      it "is reported as empty to formatters directly inspecting the internal state" do
        expect(custom_formatter(with_password)).to include "@name:"
        expect(custom_formatter(with_password)).to include "@password:"
      end
    end

    context "when the attribute has a value" do
      before do
        with_password.name = "Skroob"
        with_password.password = "12345"
      end

      it "is hidden in #inspect" do
        expect(with_password.inspect).to include "@name=\"Skroob\""
        expect(with_password.inspect).to include "@password=<secret>"
      end

      it "is hidden to pp" do
        expect(with_password.inspect).to include "@name=\"Skroob\""
        expect(with_password.inspect).to include "@password=<secret>"
      end

      it "is hidden from formatters directly inspecting the internal state" do
        expect(custom_formatter(with_password)).to include "@name: Skroob;"
        expect(custom_formatter(with_password)).to include "@password: <secret>;"
      end
    end
  end
end
