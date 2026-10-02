#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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
require_relative "shared_setup"
Yast.import "UI"

RSpec.shared_context "widgets" do
  include Yast::UIShortcuts

  def find_widget(regexp, content)
    regexp = regexp.to_s unless regexp.is_a?(Regexp)

    content.nested_find do |element|
      next unless element.is_a?(Yast::Term)

      element.params.any? do |param|
        param.is_a?(Yast::Term) &&
          param.value == :id &&
          regexp.match?(param.params.first.to_s)
      end
    end
  end

  def expect_select(id, value: true)
    expect(Yast::UI).to receive(:ChangeWidget).once.with(Id(id), :Value, value)
  end

  def expect_not_select(id, value: true)
    expect(Yast::UI).not_to receive(:ChangeWidget).with(Id(id), :Value, value)
  end

  def expect_enable(id)
    expect(Yast::UI).to receive(:ChangeWidget).once.with(Id(id), :Enabled, true)
  end

  def expect_not_enable(id)
    expect(Yast::UI).not_to receive(:ChangeWidget).with(Id(id), :Enabled, true)
  end

  def expect_disable(id)
    expect(Yast::UI).to receive(:ChangeWidget).once.with(Id(id), :Enabled, false)
  end

  def select_widget(id, value: true)
    allow(Yast::UI).to receive(:QueryWidget).with(Id(id), :Value).and_return(value)
  end

  def not_select_widget(id)
    allow(Yast::UI).to receive(:QueryWidget).with(Id(id), :Value).and_return(false)
  end

  before do
    allow(Yast::UI).to receive(:ChangeWidget).and_call_original
    allow(Yast::UI).to receive(:QueryWidget).and_call_original
  end
end
