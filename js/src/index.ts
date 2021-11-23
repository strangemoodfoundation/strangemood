import * as solana from '@solana/web3.js';
import {
  createAccountGovernance,
  createEmptyCharterAccount,
  createRealm,
  createTokenGovernance,
  depositGovernanceTokens,
  setCharterAccount,
} from './dao/instructions';
import splToken from '@solana/spl-token';
import {
  GovernanceConfig,
  VoteThresholdPercentage,
  VoteWeightSource,
} from './dao/governance/accounts';
import BN from 'bn.js';
import { CharterLayout } from './dao/state';
import { STRANGEMOOD_PROGRAM_ID } from './constants';

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

function getTimestampFromDays(days: number) {
  const SECONDS_PER_DAY = 86400;

  return days * SECONDS_PER_DAY;
}

async function createDAO(
  conn: solana.Connection,
  signer: solana.Keypair,
  initialVoteSupply: number,
  charter: {
    expansion_rate_amount: number;
    expansion_rate_decimals: number;
    contribution_rate_amount: number;
    contribution_rate_decimals: number;
    authority: solana.PublicKey;
  }
) {
  // Create a community mint
  const communityMint = await splToken.Token.createMint(
    conn,
    signer,
    signer.publicKey,
    signer.publicKey,
    9,
    splToken.TOKEN_PROGRAM_ID
  );

  // Mint some tokens
  let myVoteTokenAccount = await communityMint.getOrCreateAssociatedAccountInfo(
    signer.publicKey
  );
  await communityMint.mintTo(
    myVoteTokenAccount.address,
    signer.publicKey,
    [],
    initialVoteSupply
  );

  const [realm_ix, realm] = await createRealm({
    authority: signer.publicKey,
    communityMint: communityMint.publicKey,
    payer: signer.publicKey,
    name: randomString(5, 'abcdefghijklmnopqrs'),
    governanceProgramId: test_governance.governanceProgramId,
  });

  // Deposit the tokens into the realm so we can do stuff
  const [deposit_tx] = await depositGovernanceTokens({
    amount: new BN(100),
    realm: realm,
    governanceProgramId: test_governance.governanceProgramId,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    governingTokenSource: myVoteTokenAccount.address,
    transferAuthority: signer.publicKey,
    payer: signer.publicKey,
  });

  // Create SOL token accounts and give them to the realm
  let wrappedSol = new splToken.Token(
    conn,
    splToken.NATIVE_MINT,
    splToken.TOKEN_PROGRAM_ID,
    signer
  );
  let realmSolTokenAccount = await wrappedSol.createAccount(signer.publicKey);
  const [sol_tg_tx, _] = await createTokenGovernance({
    governanceProgramId: test_governance.governanceProgramId,
    realm,
    tokenAccountToBeGoverned: realmSolTokenAccount,
    transferTokenOwner: true, // very important
    tokenOwner: signer.publicKey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    authority: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(0),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  // Create Vote token accounts and give them to the realm
  let realmVoteTokenAccount = await communityMint.createAccount(
    signer.publicKey
  );
  const [vote_tg_tx, __] = await createTokenGovernance({
    governanceProgramId: test_governance.governanceProgramId,
    realm,
    tokenAccountToBeGoverned: realmVoteTokenAccount,
    transferTokenOwner: true, // very important
    tokenOwner: signer.publicKey,
    governingTokenMint: communityMint.publicKey,
    governingTokenOwner: signer.publicKey,
    payer: signer.publicKey,
    authority: signer.publicKey,
    config: new GovernanceConfig({
      voteThresholdPercentage: new VoteThresholdPercentage({ value: 60 }),
      minCommunityTokensToCreateProposal: new BN(0),
      minInstructionHoldUpTime: getTimestampFromDays(0),
      maxVotingTime: getTimestampFromDays(3),
      voteWeightSource: VoteWeightSource.Deposit,
      minCouncilTokensToCreateProposal: new BN(1),
    }),
  });

  // Create an empty account we can use for the charter, and give
  // it to the Strangemood program
  const charterKeypair = solana.Keypair.generate();
  let balance = await conn.getMinimumBalanceForRentExemption(
    CharterLayout.span
  );
  const create_empty_charter_tx = createEmptyCharterAccount({
    lamportsForRent: balance,
    payerPubkey: signer.publicKey,
    newAccountPubkey: charterKeypair.publicKey,
    owner: STRANGEMOOD_PROGRAM_ID,
  });

  // Update the charter details
  const set_charter_tx = setCharterAccount({
    charterData: {
      expansion_rate_amount: charter.expansion_rate_amount,
      expansion_rate_decimals: charter.expansion_rate_decimals,
      contribution_rate_amount: charter.contribution_rate_amount,
      contribution_rate_decimals: charter.contribution_rate_decimals,

      // TODO: Look how token governances assign their authorities
      // and then use that to give the update authority of the charter
      // to the Realm.
      authority: signer.publicKey,
      realm_sol_token_account: realmSolTokenAccount,
      realm_vote_token_account: realmVoteTokenAccount,
    },
    charterPubkey: charterKeypair.publicKey,
    signer: signer.publicKey,
  });

  // Create or get a charter
  // const charterPubkey = new solana.PublicKey(
  //   'GTPdQ3NVx7oavUPSGsxWWUZ8AnXz4yu5SR5B7emPqGPG'
  // );

  // Create the Account governance for said charter
  const [ag_ix, accountGovernance] = await createAccountGovernance({
    authority: signer.publicKey,
    governanceProgramId: test_governance.governanceProgramId,
    realm: realm,
    governedAccount: charterKeypair.publicKey,
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
  tx.add(deposit_tx);
  tx.add(sol_tg_tx);
  tx.add(vote_tg_tx);
  tx.add(create_empty_charter_tx);
  tx.add(set_charter_tx);
  tx.add(ag_ix);

  await solana.sendAndConfirmTransaction(conn, tx, [signer]);

  return {
    accountGovernance,
    realm,
    communityMint: communityMint.publicKey,
    charterKeypair: charterKeypair,
  };
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

  const dao = createDAO(conn, signer, 100000, {
    expansion_rate_amount: 1,
    expansion_rate_decimals: 2,

    contribution_rate_amount: 5,
    contribution_rate_decimals: 2,

    authority: signer.publicKey,
  });

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
