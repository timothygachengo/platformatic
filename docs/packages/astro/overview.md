---
title: Overview
label: Astro
---

import Issues from '../getting-started/issues.md';

# Platformatic Astro

The Platformatic Astro allows to run an [Astro](https://astro.build/) application as a Platformatic Runtime service with no modifications.

## Getting Started

Create or copy an Astro application inside the `web` or `services` folder. If you are not using [`autoload`](../../runtime/configuration.md#autoload), you also have to explictly add the new service.

You are all set, you can now start your runtime as usual via `wattpm dev` or `plt start`.

## Example configuration file

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/astro/2.0.0.json",
  "application": {
    "basePath": "/frontend"
  }
}
```

## Architecture

When running in development mode, the Astro Vite development server is run a in worker thread in the same process of the Platformatic runtime. The server port is chosen randomly and it will override any user setting.

When running in production mode, a custom Fastify server will serve the static or dynamic (for SSR) application. The service is run a in worker thread in the same process of the Platformatic runtime and it will not start a TCP server unless it's the runtime entrypoint.

In both modes if the service uses the `commands` property then it's responsible to start a HTTP server. The Platformatic runtime will modify the server port replacing it with a random port and then it will integrate the external service in the runtime.

## Configuration

See the [configuration](./configuration.md) page.

## API

- **`platformatic.setBasePath(path)`**: This function can be use to override the base path for the service. If not properly configure in the composer, this can make your application unaccessible.
- **`platformatic.id`**: The id of the service.
- **`platformatic.root`**: The root directory of the service.
- **`platformatic.basePath`**: The base path of the service in the composer.
- **`platformatic.logLevel`**: The log level configured for the service.

<Issues />