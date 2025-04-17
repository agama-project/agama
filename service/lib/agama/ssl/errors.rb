require "yast"

module Agama
  module SSL
    # remember the details about SSL verification failure
    # the attributes are read from the SSL error context
    class Errors < Struct.new(:ssl_error_code, :ssl_error_msg, :ssl_failed_cert)
      include Singleton

      def reset
        self.ssl_error_code = nil
        self.ssl_error_msg = nil
        self.ssl_failed_cert = nil
      end
    end

    module ErrorCodes
      extend Yast::I18n
      textdomain "registration"

      # "certificate has expired"
      EXPIRED = 10
      # "self signed certificate"
      SELF_SIGNED_CERT = 18
      # "self signed certificate in certificate chain"
      SELF_SIGNED_CERT_IN_CHAIN = 19
      # "unable to get local issuer certificate"
      NO_LOCAL_ISSUER_CERTIFICATE = 20

      # openSSL error codes for which the import SSL certificate dialog is shown,
      # for the other error codes just the error message is displayed
      # (importing the certificate would not help)
      IMPORT_ERROR_CODES = [
        SELF_SIGNED_CERT,
        SELF_SIGNED_CERT_IN_CHAIN
      ].freeze

      # error code => translatable error message
      # @note the text messages need to be translated at runtime via _() call
      # @note we do not translate every possible OpenSSL error message, just the most common ones
      OPENSSL_ERROR_MESSAGES = {
        # TRANSLATORS: SSL error message
        EXPIRED                     => N_("Certificate has expired"),
        # TRANSLATORS: SSL error message
        SELF_SIGNED_CERT            => N_("Self signed certificate"),
        # TRANSLATORS: SSL error message
        SELF_SIGNED_CERT_IN_CHAIN   => N_("Self signed certificate in certificate chain"),
        # TRANSLATORS: SSL error message
        NO_LOCAL_ISSUER_CERTIFICATE => N_("Unable to get local issuer certificate")
      }.freeze
    end
  end
end
