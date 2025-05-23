import { strict as assert } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { fullSetupRuntime, getLogs } from '../../basic/test/helper.js'

test('logger options', async t => {
  process.env.PLT_RUNTIME_LOGGER_STDOUT = 1

  const { url, runtime } = await fullSetupRuntime({
    t,
    configRoot: path.resolve(import.meta.dirname, './fixtures/logger'),
    build: true,
    production: true,
  })

  await request(`${url}/`, { headers: { Authorization: 'token' } })

  const logs = await getLogs(runtime)

  assert.ok(logs.find(log => {
    return log.stdout &&
      log.stdout.name === 'remix' &&
      log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.msg === 'Log from remix App page'
  }))

  assert.ok(logs.find(log => {
    return log.stdout &&
      log.stdout.name === 'remix' &&
      log.stdout.level === 'INFO' &&
      log.stdout.time.length === 24 && // isotime
      log.stdout.req?.headers?.authorization === '***HIDDEN***' &&
      log.stdout.msg === 'request completed'
  }))
})
