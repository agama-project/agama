#!/usr/bin/env ruby
# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

# Helper script to create a configuration file for a selected list of products.
#
#   filter-config.rb /etc/d-installer.yaml ALP-Bedrock ALP-Micro

require "yast"
require "agama/config"
require "yaml"

if ARGV.size < 2
  warn("Please, specify a file and, at least, a product ID")
  exit(1)
end

path = ARGV[0]
product_ids = ARGV[1..-1]

unless File.exist?(path)
  warn("The specified file does not exist: #{path}")
  exit(2)
end

config = DInstaller::Config.from_file(path)

unknown_products = product_ids - config.products.keys
unless unknown_products.empty?
  warn(format("The following products are unknown: %{products}.",
    products: unknown_products.join(", ")))
  exit(3)
end

keys_to_filter = (["products"] + config.products.keys) - product_ids
products = product_ids.reduce({}) { |all, id| all.merge(id => config.data["products"][id]) }
new_config = { "products" => products }
new_config.merge!(config.pure_data.reject { |k, _v| keys_to_filter.include?(k) })
puts YAML.dump(new_config)
