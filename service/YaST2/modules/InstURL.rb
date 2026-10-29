# Vendored from yast2-packager's src/modules/InstURL.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-packager` RPM cannot be a
# runtime dependency of Agama (it has a circular `Requires:` on `yast2-storage-ng`, which this
# whole vendoring effort exists to drop), so the one classic module actually needed from it is
# vendored here instead.
#
# DEVIATION FROM UPSTREAM: dropped the unused `Yast.import "CheckMedia"` call. Nothing in
# #installInf2Url (the only method actually called anywhere in Agama's closure - see
# service/YaST2/README.md) or any other method defined here references `CheckMedia`, and
# vendoring that whole separate module (itself with further dependencies) just to satisfy an
# unused import would be unnecessary bloat.

require "yast"

# Yast namespace
module Yast
  # Convert /etc/install.inf data to URL
  class InstURLClass < Module
    include Yast::Logger

    def main
      textdomain "packager"
      Yast.import "URL"

      @installInf2Url = nil
    end

    # Hide Password
    # @param [String] url original URL
    # @return [String] new URL with hidden password
    def HidePassword(url)
      Builtins.y2warning(
        "InstURL::HidePassword() is obsoleted, use URL::HidePassword() instead"
      )
      URL.HidePassword(url)
    end

    # check if SSL certificate check is enabled (default) or explicitely disabled by user
    #
    # This used to read the "ssl_verify" option from /etc/install.inf (written by linuxrc), which
    # does not exist in Agama at all (no classic linuxrc boot stage) - so this is always enabled.
    def SSLVerificationEnabled
      true
    end

    # Convert install.inf to a URL useable by the package manager
    #
    # Return an empty string if no repository URL has been defined.
    #
    # @param [String] extra_dir append path to original URL
    # @return [String] new repository URL
    def installInf2Url(extra_dir = "")
      return @installInf2Url unless @installInf2Url.nil?

      # This used to read the "ZyppRepoURL" option from /etc/install.inf (written by linuxrc),
      # which does not exist in Agama at all (no classic linuxrc boot stage) - so this is always
      # nil here, and the fallback repository branch below is always taken.
      @installInf2Url = nil

      if @installInf2Url.to_s.empty?
        # If possible, use the fallback repository containing only products information
        log.info "No install URL specified through ZyppRepoURL"
        @installInf2Url = fallback_repo? ? fallback_repo_url.to_s : ""
      else
        # The URL is parsed/built only if needed to avoid potential problems with corner cases.
        @installInf2Url = add_extra_dir_to_url(@installInf2Url, extra_dir) unless extra_dir.empty?
        @installInf2Url = add_ssl_verify_no_to_url(@installInf2Url) unless SSLVerificationEnabled()
      end

      # escape spaces otherwise it would be invalid and rejected by libzypp
      @installInf2Url.gsub!(" ", "%20")

      log.info "Using install URL: #{URL.HidePassword(@installInf2Url)}"
      @installInf2Url
    end

    # Location of the fallback repository in the int-sys
    FALLBACK_REPO_PATH = "/var/lib/fallback-repo".freeze
    private_constant :FALLBACK_REPO_PATH

    # URL of the fallback repository, located in the int-sys, that is used to
    # get the products information when the NOREPO option has been passed to
    # the installer (fate#325482)
    #
    # @return [URI::Generic]
    def fallback_repo_url
      ::URI.parse("dir://#{FALLBACK_REPO_PATH}")
    end

    # Where there is a fallback repository in the int-sys
    #
    # @see #fallback_repo_url
    #
    # @return [Boolean]
    def fallback_repo?
      ::File.exist?(FALLBACK_REPO_PATH)
    end

  private

    # Helper method to add extra_dir to a given URL
    #
    # @param url       [String] URL
    # @param extra_dir [String] Path to add
    # @return [String] URL with the added path
    def add_extra_dir_to_url(url, extra_dir)
      parts = URL.Parse(url)
      parts["path"] = File.join(parts["path"], extra_dir)
      URL.Build(parts)
    end

    # Helper method to add ssl_verify parameter if needed
    #
    # Only applicable if scheme is 'https'.
    #
    # @param url       [String] URL
    # @return [String] URL (with ssl_verify set to 'no' if needed)
    def add_ssl_verify_no_to_url(url)
      parts = URL.Parse(url)
      return url if !parts["scheme"].casecmp("https").zero?

      log.warn "Disabling certificate check for the installation repository"
      parts["query"] << "&" unless parts["query"].empty?
      parts["query"] << "ssl_verify=no"
      URL.Build(parts)
    end

    publish function: :HidePassword, type: "string (string)"
    publish function: :installInf2Url, type: "string (string)"
  end

  InstURL = InstURLClass.new
  InstURL.main
end
