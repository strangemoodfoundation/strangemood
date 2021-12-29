import { nanoid } from 'nanoid'
import { createChallengeMessage } from '../auth'
import { errs } from '../errors'
import { Context } from '../framework'
import { StrangemoodServices } from '../types'

export async function postChallenge(
  req: Request,
  ctx: Context<{
    publicKey: string
  }>,
) {
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
}
