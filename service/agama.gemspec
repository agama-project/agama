# frozen_string_literal: true

#
# Copyright (c) [2022] SUSE LLC
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

Gem::Specification.new do |spec|
  spec.name = "agama"
  # the version is <version_tag>.devel<number_of_commits_since_the_tag>
  # or just <version_tag> if there are no additional commits
  spec.version = `git describe --tags`.chomp.sub(/^v/, "").sub(/-([0-9]+)-g\h+\Z/, ".devel\\1")
  spec.summary = "Agama Installer Service"
  spec.description = "System service for Agama, an experimental YaST-based installer."
  spec.author = "YaST Team"
  spec.email = "yast-devel@opensuse.org"
  spec.homepage = "https://github.com/openSUSE/agama"
  spec.license = "GPL-2.0-only"
  spec.files = Dir["lib/**/*.rb", "bin/*", "share/*", "etc/*"]
  spec.executables = ["agamactl"]
  spec.metadata = { "rubygems_mfa_required" => "true" }

  spec.required_ruby_version = ">= 2.5.0"

  spec.add_development_dependency "packaging_rake_tasks", "~> 1.5.1"
  spec.add_development_dependency "rake", "~> 13.0.6"
  spec.add_development_dependency "rspec", "~> 3.11.0"
  spec.add_development_dependency "simplecov", "~> 0.21.2"
  spec.add_development_dependency "simplecov-lcov", "~> 0.8.0"
  spec.add_development_dependency "yard", "~>0.9.0"
  spec.add_dependency "cfa", "~> 1.0.2"
  spec.add_dependency "cfa_grub2", "~> 2.0.0"
  spec.add_dependency "cheetah", "~> 1.0.0"
  spec.add_dependency "eventmachine", "~> 1.2.7"
  spec.add_dependency "fast_gettext", "~> 2.2.0"
  spec.add_dependency "nokogiri", "~> 1.13.1"
  spec.add_dependency "rexml", "~> 3.2.5"
  spec.add_dependency "ruby-dbus", ">= 0.23.0.beta1", "< 1.0"
end
