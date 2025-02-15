const fastify = require('fastify')

const app = fastify({
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: 'trace' })
})

app.get('/', async () => {
  return {
    production: process.env.NODE_ENV === 'production',
    plt_dev: process.env.PLT_DEV === 'true',
    plt_environment: process.env.PLT_ENVIRONMENT
  }
})

app.get('/version', async () => {
  return { version: 123 }
})

app.get('/time', async (_, reply) => {
  reply.header('Cache-Control', 'public, s-maxage=30')
  return { time: Date.now() }
})

app.post('/', async request => {
  return { body: request.body }
})
app.log.trace('This is a trace')

app.listen({ port: 1 }).then(() => {
  app.log.info('Service listening')
})
