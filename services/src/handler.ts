import Router from './framework'
import { postChallenge } from './routes/challenge'
import { getListing, postListing } from './routes/listings'

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

  router.use('GET', '/v1/listings/:publicKey', getListing)
  router.use('POST', '/v1/listings/:publicKey', postListing)

  router.use(
    'POST',
    '/v1/listings/:public_key/upload/:key',
    async (req, ctx) => {
      return new Response(JSON.stringify(ctx))
    },
  )

  return router.resolve(request)
}
