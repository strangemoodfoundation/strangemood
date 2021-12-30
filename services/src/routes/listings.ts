import { nanoid } from 'nanoid'
import { createChallengeMessage, isAuthorized } from '../auth'
import { errs } from '../errors'
import { Context } from '../framework'
import { StrangemoodServices } from '../types'
import { readListing } from '../solana'
import { PublicKey } from '@solana/web3.js'

export async function postListing(
  req: Request,
  ctx: Context<{ publicKey: string }>,
) {
  type Body =
    StrangemoodServices['/v1/listings/:publicKey']['POST']['requestBody']

  let body: Body
  try {
    body = await req.json()
  } catch (err: any) {
    return errs.expectedJson()
  }

  const listing = await readListing(new PublicKey(ctx.params.publicKey))
  if (!listing) {
    return new Response('404 listing not found', {
      status: 404,
    })
  }

  const isAuth = await isAuthorized(
    req,
    listing?.authority.toString(),
    `listing/${ctx.params.publicKey}`,
  )
  if (!isAuth) {
    return new Response('Unauthorized', {
      status: 401,
    })
  }

  await LISTINGS.put(`${ctx.params.publicKey}/metadata`, JSON.stringify(body))

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(req),
    },
  })
}

export async function getListing(
  req: Request,
  ctx: Context<{ publicKey: string }>,
) {
  let result = await LISTINGS.get(`${ctx.params.publicKey}/metadata`)
  if (!result) {
    return new Response('404 no metadata found', {
      status: 404,
    })
  }

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
