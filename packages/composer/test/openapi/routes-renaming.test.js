'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, mkdtemp } = require('fs/promises')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should rename static route', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        alias: '/customers',
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

  assert.ok(openApiSchema.paths['/customers'])
  assert.ok(openApiSchema.paths['/users'] === undefined)

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/customers' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, [
      { id: 1, name: 'test1' },
      { id: 2, name: 'test2' },
      { id: 3, name: 'test3' },
      { id: 4, name: 'test4' },
    ])
  }
})

test('should rename parametric route', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}',
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

  assert.ok(openApiSchema.paths['/customers/{id}'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/customers/1' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { id: 1, name: 'test1' })
  }
})

test('should rename parametric route with prefix', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}',
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
              prefix: '/prefix1',
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

  assert.ok(openApiSchema.paths['/prefix1/customers/{id}'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/prefix1/customers/1' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { id: 1, name: 'test1' })
  }
})
