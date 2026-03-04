#ifndef HEADERS_H
#define HEADERS_H


char * announce_system(char *client_params, char *distro_target);
char * create_credentials_file(char *login, char *password, char *_unused_empty, char *credentials_file);
char * activate_product(char *client_params, char *product, char *email);
char * write_config(char *client_params);
char * show_product(char *product, char *client_params);
char * reload_certificates();

#endif