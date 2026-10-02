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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
# load whole namespace, to check all classes
require "y2storage"

describe Y2Storage::StorageClassWrapper do
  include_context "yast2-storage-ng test setup"

  describe "wrap_class" do
    all_wrappers = ObjectSpace.each_object(Class).select { |c| c < described_class }
    all_wrappers.each do |wrapper|
      describe wrapper do
        all_children = ObjectSpace.each_object(Class).select { |c| c < wrapper }
        direct_children = all_children.select do |child|
          ancestors_classes = child.ancestors[1..-1].select { |c| c.is_a?(Class) }
          ancestors_classes.first == wrapper
        end

        downcast_values = direct_children.map { |c| c.to_s[/Y2Storage::(.*)/, 1] }

        message = if direct_children.empty?
          "does not specify any downcastable class as it does not have a direct child"
        else
          "specifies its direct children #{direct_children.inspect} as downcastable"
        end

        it message do
          expect(wrapper.instance_variable_get(:@downcast_class_names))
            .to match_array(downcast_values),
              "Y2Storage::#{wrapper} specifies " \
              "#{wrapper.instance_variable_get(:@downcast_class_names)} " \
              " but direct children are #{direct_children}."
        end
      end
    end
  end
end
