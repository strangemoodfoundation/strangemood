import { ns64, struct, u8 } from '@solana/buffer-layout';
import * as solana from '@solana/web3.js';
import {
  STRANGEMOOD_INSTRUCTION_INDEXES as INDEXES,
  STRANGEMOOD_PROGRAM_ID,
} from '../constants';
import { asSigner, asWritable, publicKey } from '../utils';
import { CharterLayout } from './state';
import { Charter } from './types';

export type CreateCharterAccountParams = {
  lamportsForRent: number;
  payerPubkey: solana.PublicKey;
  newAccountPubkey: solana.PublicKey;
  owner: solana.PublicKey;
};

export function createEmptyCharterAccount(params: CreateCharterAccountParams) {
  return solana.SystemProgram.createAccount({
    fromPubkey: params.payerPubkey,
    newAccountPubkey: params.newAccountPubkey,
    lamports: params.lamportsForRent,
    space: CharterLayout.span,

    // TODO: this probably should be the gov program, but technically there's no check,
    // since anyone could create their own governance program.
    programId: params.owner,
  });
}

export type SetCharterAccountParams = {
  charterPubkey: solana.PublicKey;
  charterData: Charter;
  signer: solana.PublicKey;
};

export function setCharterAccount(params: SetCharterAccountParams) {
  let fields = Object.assign(
    { instruction: INDEXES.SET_CHARTER },
    {
      expansion_rate_amount: params.charterData.expansion_rate_amount,
      expansion_rate_decimals: params.charterData.expansion_rate_decimals,
      contribution_rate_amount: params.charterData.contribution_rate_amount,
      contribution_rate_decimals: params.charterData.contribution_rate_decimals,
      authority: params.charterData.authority.toBytes(),
      realm_sol_token_account: params.charterData.realm_sol_token_account.toBytes(),
    }
  );

  let layout = struct([
    u8('instruction'),

    ns64('expansion_rate_amount'),
    u8('expansion_rate_decimals'),

    ns64('contribution_rate_amount'),
    u8('contribution_rate_decimals'),

    publicKey('authority'),
    publicKey('realm_sol_token_account'),
  ]);
  let data = Buffer.alloc(layout.span);
  layout.encode(fields, data);

  const keys = [asSigner(params.signer), asWritable(params.charterPubkey)];
  return new solana.TransactionInstruction({
    keys,
    programId: STRANGEMOOD_PROGRAM_ID,
    data,
  });
}
