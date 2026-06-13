# Mini ERP Backend

MVC-style backend structure for the Mini ERP project.

## Structure

```text
src/config        database and app configuration
src/models        database query/model layer
src/controllers   request handling/business coordination
src/routes        Express route definitions
src/middlewares   reusable Express middlewares
src/utils         shared helpers
```

## MySQL Connection

The MySQL connection is configured in:

```text
src/config/database.js
```

Default connection settings:

```text
host: localhost
port: 3303
database: mini_erp
user: root
```

Create a `.env` file from `.env.example` and update the username/password for your local MySQL setup.

## Commands

```bash
npm install
npm run dev
```

Health check:

```text
GET http://localhost:5000/api/health
```
