import * as solana from '@solana/web3.js';
import { getCharterAccount } from './dao';
import { createAccountGovernance, createRealm } from './dao/instructions';
import splToken from '@solana/spl-token';
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from './dao/governance/accounts';
import BN from 'bn.js';
import {
  getTransactionErrorMsg,
  isSendTransactionError,
} from './dao/governance/error';

interface Governance {
  governanceProgramId: solana.PublicKey;
  realm: solana.PublicKey;
  communityMint: solana.PublicKey;
  charterGovernance: solana.PublicKey;
  charter: solana.PublicKey;
}

const test_governance = {
  governanceProgramId: new solana.PublicKey(
    'eyoXCKW5rkxbHc1fAXQJry5i6jYyyXk1iDGfKLYErbX'
  ),
  communityMint: new solana.PublicKey(
    '36RC6XAKAnjEYVySfb4k6dnyjWJGgfjRL1oMx3pe9MVL'
  ),
};

function randomString(len, charSet) {
  charSet =
    charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var randomString = '';
  for (var i = 0; i < len; i++) {
    var randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
}

export const main = async () => {
  let signer = solana.Keypair.generate();
  let conn = new solana.Connection('http://127.0.0.1:8899');

  // Get some SOL to pay for the transactions
  let airdropSignature = await conn.requestAirdrop(
    signer.publicKey,
    solana.LAMPORTS_PER_SOL
  );
  await conn.confirmTransaction(airdropSignature);

  // let act = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // // Create a charter account
  // const keypair = await createCharterAccount(
  //   conn,
  //   {
  //     payer: signer,
  //     signer,
  //     owner: signer,
  //   },
  //   {
  //     // 0.01 Strange per SOL contribution
  //     expansion_rate_amount: 1,
  //     expansion_rate_decimals: 2,

  //     // contribution rate at 0.05 or 5%
  //     contribution_rate_amount: 5,
  //     contribution_rate_decimals: 2,

  //     authority: signer.publicKey,
  //     realm_sol_token_account_pubkey: act.address,
  //   }
  // );

  // console.log(keypair.publicKey.toString());

  const communityMint = await splToken.Token.createMint(
    conn,
    signer,
    signer.publicKey,
    signer.publicKey,
    9,
    splToken.TOKEN_PROGRAM_ID
  );

  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: communityMint.publicKey,
    payer: signer.publicKey,
    name: randomString(5, 'abcdefghijklmnopqrs'),
    governanceProgramId: test_governance.governanceProgramId,
  });

  const charterPubkey = new solana.PublicKey(
    'GTPdQ3NVx7oavUPSGsxWWUZ8AnXz4yu5SR5B7emPqGPG'
  );

  function getTimestampFromDays(days: number) {
    const SECONDS_PER_DAY = 86400;

    return days * SECONDS_PER_DAY;
  }

  const [ag_ix, accountGovernance] = await createAccountGovernance({
    authority: signer.publicKey,
    governanceProgramId: test_governance.governanceProgramId,
    realm: realm,
    governedAccount: charterPubkey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(0),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  const tx = new solana.Transaction();
  tx.add(realm_ix);
  tx.add(ag_ix);

  console.log('create realm and account gov');
  try {
    await solana.sendAndConfirmTransaction(conn, tx, [signer]);
  } catch (err) {
    console.log(
      'error',
      JSON.stringify(err),
      console.log(`${getTransactionErrorMsg(err).toString()}`)
    );
  }
  console.log('realm', realm);
  console.log('ag_ix', accountGovernance);

  // let charter = await getCharterAccount(
  //   conn,
  //   new solana.PublicKey('GTPdQ3NVx7oavUPSGsxWWUZ8AnXz4yu5SR5B7emPqGPG')
  // );

  // // Create a SOL account for the charter governance
  // let wrappedSol = new splToken.Token(
  //   conn,
  //   splToken.NATIVE_MINT,
  //   splToken.TOKEN_PROGRAM_ID,
  //   signer
  // );
  // let sol_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // let wrappedSol = new splToken.Token(
  //   conn,
  //   splToken.NATIVE_MINT,
  //   splToken.TOKEN_PROGRAM_ID,
  //   signer
  // );
  // let vote_acct = await wrappedSol.getOrCreateAssociatedAccountInfo(signer.publicKey);

  // createListing(
  //   conn,
  //   {
  //     signer: signer,
  //     payer: signer,
  //   },
  //   {
  //     solDeposit: act.address,
  //     voteDeposit:
  //   }
  // );

  // console.log('Created charter', charter, charter.authority);
};

console.log('starting');
main()
  .catch(console.error)
  .then(() => console.log('done'));
