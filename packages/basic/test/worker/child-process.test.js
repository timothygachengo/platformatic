import { deepStrictEqual, equal, ok, rejects } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import pino from 'pino'
import { Agent, Client, setGlobalDispatcher } from 'undici'
import { createThreadInterceptor } from 'undici-thread-interceptor'
import { createMockedLogger, createStackable } from '../helper.js'

const pinoLevels = pino().levels.labels

function serverHandler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ok: true }))
}

function forwardLogs (logger, logs) {
  for (const log of logs) {
    const level = pinoLevels[log.level]
    logger[level](log)
  }
}

async function getChildManager (stackable) {
  let manager = null

  while (!manager) {
    manager = stackable.getChildManager()
    await setTimeout(10)
  }

  return manager
}

test('ChildProcess - can load a script with additional loader and scripts', async t => {
  const stackable = await createStackable(t)
  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/import-non-existing.js', import.meta.url))
  await stackable.buildWithCommand(['node', executablePath], import.meta.dirname, {
    loader: new URL('../fixtures/loader.js', import.meta.url).toString(),
    scripts: [new URL('../fixtures/imported.js', import.meta.url)]
  })

  deepStrictEqual(messages, [
    ['DEBUG', `Executing "node ${executablePath}" ...`],
    ['INFO', 'IMPORTED'],
    ['INFO', 'LOADED true']
  ])
})

test('ChildProcess - the process will close upon request', async t => {
  const stackable = await createStackable(t)
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(stackable)

  const [, socket] = await once(childManager, 'ready')
  await childManager.notify(socket, 'close')
  await rejects(() => promise, /Process exited with non zero exit code/)
})

test('ChildProcess - the process exits in case of invalid messages', async t => {
  const stackable = await createStackable(t)
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/wait-for-close.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(stackable)

  await once(childManager, 'ready')

  childManager._send('INVALID', false)
  await rejects(() => promise, /Process exited with non zero exit code 21./)
})

test('ChildProcess - the process exits in case of errors', async t => {
  const stackable = await createStackable(t)
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/delayed-error.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  await rejects(() => promise, /Process exited with non zero exit code 20./)
})

test('ChildProcess - should not modify HTTP options for UNIX sockets', async t => {
  const stackable = await createStackable(t)
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/unix-socket-server.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(stackable)

  const [path] = await once(childManager, 'path')

  {
    const client = new Client(
      {
        hostname: 'localhost',
        protocol: 'http:'
      },
      { socketPath: path }
    )

    const { statusCode, body: rawBody } = await client.request({
      method: 'GET',
      path: '/'
    })
    deepStrictEqual(statusCode, 200)

    const body = await rawBody.json()
    deepStrictEqual(body, { ok: true })
  }

  await promise
})

test('ChildProcess - should notify listen error', async t => {
  const stackable = await createStackable(t, {
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/server.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath])
  const childManager = await getChildManager(stackable)

  const [error] = await once(childManager, 'error')

  deepStrictEqual(error.code, 'EADDRNOTAVAIL')
  await rejects(() => promise)
})

test('ChildProcess - should intercept fetch calls', async t => {
  const server = createServer(serverHandler).listen({ host: '127.0.0.1', port: 0 })
  await once(server, 'listening')

  const tcpWirer = new Worker(new URL('../fixtures/tcp-wirer.js', import.meta.url), {
    workerData: { port: server.address().port }
  })

  const interceptor = createThreadInterceptor({
    domain: '.plt.local' // The prefix for all local domains
  })

  interceptor.route('service', tcpWirer)
  setGlobalDispatcher(new Agent().compose(interceptor))

  const stackable = await createStackable(t, {
    isEntrypoint: true,
    serverConfig: {
      hostname: '123.123.123.123',
      port: 1000
    }
  })

  const { messages, logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/fetch.js', import.meta.url))
  const promise = stackable.buildWithCommand(['node', executablePath], null, { context: { interceptLogging: true } })
  const manager = await getChildManager(stackable)
  manager._forwardLogs = forwardLogs.bind(null, logger)

  await once(manager, 'ready')

  ok(await manager.send(Array.from(manager.getClients())[0], 'start', server.address().port))

  await promise
  await server.close()
  tcpWirer.terminate()

  deepStrictEqual(messages[0], ['DEBUG', `Executing "node ${executablePath}" ...`])
  deepStrictEqual(
    // eslint-disable-next-line no-control-regex
    messages.slice(1).map(l => [l[0], l[1].level, l[1].raw.trim().replace(/\x1B\[33m|\x1B\[39m/g, '')]),
    [
      ['INFO', 30, '200 { ok: true }'],
      ['INFO', 30, '200 { ok: true }'],
      ['INFO', 30, '200 { ok: true }'],
      ['INFO', 30, '502 No server found for service2.plt.local in 0']
    ]
  )
})

test('ChildProcess - should properly setup globals', async t => {
  const stackable = await createStackable(t)
  const { logger } = createMockedLogger()
  stackable.logger = logger

  const executablePath = fileURLToPath(new URL('../fixtures/import-non-existing.js', import.meta.url))
  await stackable.buildWithCommand(['node', executablePath], import.meta.dirname, {
    loader: new URL('../fixtures/loader.js', import.meta.url).toString(),
    scripts: [new URL('../fixtures/imported.js', import.meta.url)]
  })
  stackable.setOpenapiSchema('TEST_OPENAPI_SCHEMA')
  stackable.setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
  stackable.setConnectionString('TEST_CONNECTION_STRING')

  equal(stackable.openapiSchema, 'TEST_OPENAPI_SCHEMA')
  equal(stackable.graphqlSchema, 'TEST_GRAPHQL_SCHEMA')
  equal(stackable.connectionString, 'TEST_CONNECTION_STRING')
})
