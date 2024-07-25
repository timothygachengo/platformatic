'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, mkdtemp } = require('node:fs/promises')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should ignore static routes', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        ignore: true,
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should ignore parametric routes', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        ignore: true,
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 200)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 404)
  }
})

test('should ignore routes for only for one service', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  await api1.listen({ port: 0 })

  const api2 = await createOpenApiService(t, ['users'])
  await api2.listen({ port: 0 })

  const openapiConfig1 = {
    paths: {
      '/users': {
        ignore: true,
      },
    },
  }

  const openapiConfig2 = {
    paths: {
      '/users/{id}': {
        ignore: true,
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))

  const openapiConfigFile1 = join(cwd, 'openapi-1.json')
  await writeFile(openapiConfigFile1, JSON.stringify(openapiConfig1))

  const openapiConfigFile2 = join(cwd, 'openapi-2.json')
  await writeFile(openapiConfigFile2, JSON.stringify(openapiConfig2))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api1.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile1,
            },
          },
          {
            id: 'api2',
            origin: 'http://127.0.0.1:' + api2.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile2,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'])
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 200)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should ignore only specified methods', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        post: { ignore: true },
      },
      '/users/{id}': {
        get: { ignore: true },
        delete: { ignore: true },
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'].get)
  assert.ok(openApiSchema.paths['/users'].put)
  assert.ok(openApiSchema.paths['/users'].post === undefined)

  assert.ok(openApiSchema.paths['/users/{id}'].post)
  assert.ok(openApiSchema.paths['/users/{id}'].put)
  assert.ok(openApiSchema.paths['/users/{id}'].get === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'].delete === undefined)
})

test('should ignore all routes if methods array is not specified', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': { ignore: true },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should skip route if all routes are ignored', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        get: { ignore: true },
        post: { ignore: true },
        put: { ignore: true },
      },
    },
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile,
            },
          },
        ],
      },
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})
