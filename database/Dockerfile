FROM mysql:8.0

# Full database dump (schema + all current data) runs on first boot
COPY mini_erp_full_dump.sql /docker-entrypoint-initdb.d/01_full_dump.sql

EXPOSE 3306
