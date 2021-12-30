import {
  MAINNET,
  fetchStrangemoodProgram,
  Strangemood,
  pda,
  initListing,
  purchaseListing,
} from '@strangemood/strangemood'
import * as anchor from '@project-serum/anchor'
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'

const makeDummyWallet = (publicKey: PublicKey) => {
  return {
    signTransaction: async (tx: Transaction): Promise<Transaction> => {
      throw new Error("This wallet doesn't sign")
    },
    signAllTransactions: (txs: Transaction[]): Promise<Transaction[]> => {
      throw new Error("This wallet doesn't sign")
    },
    publicKey,
  }
}

export async function readListing(publicKey: PublicKey) {
  let dummy = Keypair.generate()
  let connection = new Connection('https://rpc-mainnet.rebasefoundation.org/')

  const provider = new anchor.Provider(
    connection,
    makeDummyWallet(dummy.publicKey),
    {},
  )

  const program = await fetchStrangemoodProgram(provider)
  return program.account.listing.fetchNullable(publicKey)
}
