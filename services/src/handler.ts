import { nanoid } from 'nanoid'
import { createChallengeMessage } from './auth'
import { errs } from './errors'
import Router from './framework'
import { StrangemoodServices } from './types'

export async function handleRequest(request: Request): Promise<Response> {
  const router = new Router()

  router.use('GET', '/', async (req, ctx) => {
    return new Response('hi')
  })

  router.use<{ publicKey: string }>(
    'POST',
    '/v1/challenge/:publicKey',
    async (req, ctx) => {
      type Body =
        StrangemoodServices['/v1/challenge/:publicKey']['POST']['requestBody']

      let body: Body
      try {
        body = await req.json()
      } catch (err: any) {
        return errs.expectedJson()
      }

      let nonce = nanoid()
      let issuedAt = new Date().toISOString()

      const message = createChallengeMessage({
        publicKey: ctx.params.publicKey,
        domain: req.headers.get('origin') || 'https://strangemood.org',
        statement:
          'Do you want to allow this service to modify the metadata of your listing?',
        version: '0.0.0',
        nonce: nonce,
        issuedAt: issuedAt,
        uri: req.url,
      })

      return new Response(message)
    },
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
