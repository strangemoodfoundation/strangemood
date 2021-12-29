import nacl from 'tweetnacl'
import { toUTF8Array } from './utf8'
import solana from '@solana/web3.js'

export function verify(msg: string, signature: string, publicKey: string) {
  const msgData = toUTF8Array(msg)
  const sigData = toUTF8Array(signature)
  const pubkey = new solana.PublicKey(publicKey)
  const pubkeyData = pubkey.toBuffer()

  return nacl.sign.detached.verify(msgData, sigData, pubkeyData)
}
