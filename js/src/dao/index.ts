import * as solana from '@solana/web3.js';
import { STRANGEMOOD_PROGRAM_ID } from '../constants';
import { CharterLayout } from './state';
import { Charter } from './types';
import * as ix from './instructions';
import splToken from '@solana/spl-token';
import {
  getGovernanceSchema,
  PROGRAM_VERSION_V2,
} from './governance/serialization';
import { deserialize } from 'borsh';
import { Realm } from './governance/accounts';

export async function getRealmAccount(
  conn: solana.Connection,
  realmPubkey: solana.PublicKey
) {
  let realmAccount = await conn.getAccountInfo(realmPubkey);

  let gov = getGovernanceSchema(PROGRAM_VERSION_V2);
  let realm = deserialize(gov, Realm, realmAccount.data);

  return {
    data: realm,
  };
}

// TODO: make this an account meta instead of just the data inside the account
export async function getCharterAccount(
  conn: solana.Connection,
  charterPubkey: solana.PublicKey
) {
  let charter = await conn.getAccountInfo(charterPubkey);
  let object = CharterLayout.decode(charter.data);

  return {
    data: {
      expansion_rate_amount: new splToken.u64(object.expansion_rate_amount),
      expansion_rate_decimals: object.expansion_rate_decimals,

      sol_contribution_rate_amount: new splToken.u64(
        object.sol_contribution_rate_amount
      ),
      sol_contribution_rate_decimals: object.sol_contribution_rate_decimals,

      vote_contribution_rate_amount: new splToken.u64(
        object.vote_contribution_rate_amount
      ),
      vote_contribution_rate_decimals: object.vote_contribution_rate_decimals,

      authority: new solana.PublicKey(object.authority),

      realm_sol_token_account: new solana.PublicKey(
        object.realm_sol_token_account
      ),
      realm_vote_token_account: new solana.PublicKey(
        object.realm_vote_token_account
      ),
    },
  };
}

export async function createCharter(
  conn: solana.Connection,

  // Note that these keys can all be the same
  // keypair.
  keys: {
    // Who pays the rent?
    payer: solana.Keypair;

    // Who's making the transaction?
    signer: solana.Keypair;

    // Who's the owner of the charter?
    owner: solana.Keypair;
  },
  charter: Charter
): Promise<solana.Keypair> {
  let acctKeypair = solana.Keypair.generate();
  let minimumBalance = await conn.getMinimumBalanceForRentExemption(
    CharterLayout.span
  );

  let tx = new solana.Transaction({
    feePayer: keys.payer.publicKey,
  });
  tx.add(
    ix.createEmptyCharterAccount({
      lamportsForRent: minimumBalance,
      payerPubkey: keys.payer.publicKey,
      newAccountPubkey: acctKeypair.publicKey,
      owner: STRANGEMOOD_PROGRAM_ID,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer, acctKeypair]);

  tx = new solana.Transaction();
  tx.add(
    ix.setCharterAccount({
      charterData: charter,
      charterPubkey: acctKeypair.publicKey,
      signer: keys.signer.publicKey,
    })
  );

  await solana.sendAndConfirmTransaction(conn, tx, [keys.signer]);

  return acctKeypair;
}
