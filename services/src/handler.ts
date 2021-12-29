import { nanoid } from 'nanoid'
import { createChallengeMessage } from './auth'
import { errs } from './errors'
import Router from './framework'
import { postChallenge } from './routes/challenge'
import { StrangemoodServices } from './types'

export async function handleRequest(request: Request): Promise<Response> {
  const router = new Router()

  router.use('GET', '/', async (req, ctx) => {
    return new Response('hi')
  })

  router.use<{ publicKey: string }>(
    'POST',
    '/v1/challenge/:publicKey',
    postChallenge,
  )

  router.use('GET', '/v1/listings/:publicKey', async (req, ctx) => {
    return new Response(JSON.stringify(ctx))
  })

  router.use('POST', '/v1/listings/:publicKey', async (req, ctx) => {
    return new Response(JSON.stringify(ctx))
  })

  router.use(
    'POST',
    '/v1/listings/:public_key/upload/:key',
    async (req, ctx) => {
      return new Response(JSON.stringify(ctx))
    },
  )

  return router.resolve(request)
}
