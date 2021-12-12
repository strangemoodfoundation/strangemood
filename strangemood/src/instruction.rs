use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use std::convert::TryInto;
use std::mem::size_of;

use crate::fill_from_str;
use crate::state::Charter;

// inside instruction.rs
pub enum StrangemoodInstruction {
    /// Sets up a sellable app
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account that initializes the listing
    /// 1. `[writable]` The listing account that will store the price and the token
    /// 2. `[writable]` The mint account of the app token
    /// 3. `[]` The initializer's token account to deposit into. (must be SOL)
    /// 4. `[]` The voting token account where the lister will receive
    ///        community tokens at
    /// 5. `[]` The governance program (this isn't static, people can deploy their
    ///         own governance programs.
    /// 6. `[]` The realm account
    /// 7. `[]` The account governance of the charter
    /// 8. `[]` The account of the charter itself
    /// 9. `[]` The rent sysvar
    /// 10. `[]` The token program
    InitListing { amount: u64 },

    /// Changes the current price of a listing
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of that initialized the listing
    /// 1. `[writable]` The current listing account
    SetListingPrice { amount: u64 },

    /// Changes the authority/owner of a Listing
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of that initialized the listing
    /// 1. `[writable]` The current listing account
    /// 2. `[]` The new authority of the account
    SetListingAuthority {},

    /// Changes where the funds go to.
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of that initialized the listing
    /// 1. `[writable]` The current listing account
    /// 2. `[]` The new SOL deposit account
    /// 3. `[]` The new Community deposit account
    SetListingDeposit {},

    /// Changes if the listing is currently buyable.
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of that initialized the listing
    /// 1. `[writable]` The current listing account
    SetListingAvailability { available: bool },

    /// Purchase from a listing
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of the person initializing the listing
    /// 1. `[]` The listing account that you're trying to purchase from
    /// 2. `[]` ToPurchaseWith - The token account that contains the tokens used to purchase the listing
    /// 3. `[]` PurchaserListingTokenAccount - The token account that will contain the app tokens of the listing. Owner must be signer.
    /// 4. `[]` SolDeposit - The listing's deposit account for sol
    /// 5. `[]` VoteDeposit - The listing's deposit account for votes
    /// 6. `[]` SolContribution - The realm's sol account
    /// 7. `[]` VoteContribution - The realm's vote account
    /// 8. `[]` communityMint - The mint account for the community mint
    /// 9. `[]` ListingMint - The mint account for this listing
    /// 10. `[]` CommunityMintAuthority - A PDA of [realm_mint_authority]
    /// 11. `[]` ListingMintAuthority - A PDA of [listing_mint_pubkey]
    /// 12. `[]` The governance program (this isn't static, people can deploy their own governance programs.)
    /// 13. `[]` The realm account
    /// 14. `[]` The account governance of the charter
    /// 15. `[]` The account of the charter itself
    /// 16. `[]` The token program
    PurchaseListing {},

    /// Setup a charter account. Expects the charter to
    /// be owned by the Strangemood Program
    ///
    /// Accounts expected:
    /// 0. `[signer]`
    /// 1. `[writable]` The current charter account
    SetCharter { data: Charter },
}

impl StrangemoodInstruction {
    /// Unpacks a byte buffer into a [StrangemoodInstruction](enum.StrangemoodInstruction.html).
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        Ok(match tag {
            0 => Self::InitListing {
                amount: Self::unpack_amount(rest)?,
            },
            1 => Self::PurchaseListing {},
            2 => Self::SetListingAuthority {},
            3 => Self::SetListingPrice {
                amount: Self::unpack_amount(rest)?,
            },
            4 => Self::SetListingDeposit {},
            5 => Self::SetListingAvailability {
                available: Self::unpack_bool(rest)?,
            },
            6 => {
                let (ex_rate_amount_bs, rest) = rest.split_at(8);
                let expansion_rate_amount = Self::unpack_amount(ex_rate_amount_bs)?;
                let (ex_rate_decimal_bs, rest) = rest.split_at(1);
                let expansion_rate_decimals = Self::unpack_decimal(ex_rate_decimal_bs)?;

                let (sol_co_rate_amount_bs, rest) = rest.split_at(8);
                let sol_contribution_rate_amount = Self::unpack_amount(sol_co_rate_amount_bs)?;
                let (sol_co_rate_decimal_bs, rest) = rest.split_at(1);
                let sol_contribution_rate_decimals = Self::unpack_decimal(sol_co_rate_decimal_bs)?;

                let (vote_co_rate_amount_bs, rest) = rest.split_at(8);
                let vote_contribution_rate_amount = Self::unpack_amount(vote_co_rate_amount_bs)?;
                let (vote_co_rate_decimal_bs, rest) = rest.split_at(1);
                let vote_contribution_rate_decimals =
                    Self::unpack_decimal(vote_co_rate_decimal_bs)?;

                let (auth_pubkey_bs, rest) = rest.split_at(32);
                let authority = Self::unpack_pubkey(auth_pubkey_bs)?;
                let (sol_pubkey_bs, rest) = rest.split_at(32);
                let realm_sol_token_account = Self::unpack_pubkey(sol_pubkey_bs)?;
                let (vote_pubkey_bs, rest) = rest.split_at(32);
                let realm_vote_token_account = Self::unpack_pubkey(vote_pubkey_bs)?;

                let (uri_bytes, _) = rest.split_at(128);
                let mut uri: [u8; 128] = [0; 128];
                uri.copy_from_slice(uri_bytes);

                Self::SetCharter {
                    data: Charter {
                        expansion_rate_amount,
                        expansion_rate_decimals,
                        sol_contribution_rate_amount,
                        sol_contribution_rate_decimals,
                        vote_contribution_rate_amount,
                        vote_contribution_rate_decimals,
                        authority,
                        realm_sol_token_account,
                        realm_vote_token_account,
                        uri,
                        reserved: [0; 64],
                    },
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData.into()),
        })
    }

    fn unpack_pubkey(input: &[u8]) -> Result<Pubkey, ProgramError> {
        if input.len() >= 32 {
            let (key, _) = input.split_at(32);
            let pk = Pubkey::new(key);
            Ok(pk)
        } else {
            Err(ProgramError::InvalidInstructionData.into())
        }
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(amount)
    }

    fn unpack_decimal(input: &[u8]) -> Result<u8, ProgramError> {
        let decimal = input
            .get(..1)
            .and_then(|slice| slice.try_into().ok())
            .map(u8::from_le_bytes)
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(decimal)
    }

    fn unpack_bool(input: &[u8]) -> Result<bool, ProgramError> {
        if input.len() != 1 {
            return Err(ProgramError::InvalidInstructionData.into());
        }
        if input[0] == 0 {
            Ok(false)
        } else if input[0] == 1 {
            Ok(true)
        } else {
            Err(ProgramError::InvalidInstructionData.into())
        }
    }

    pub fn pack(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(size_of::<Self>());

        // To see a more complete example of this, checkout how the
        // SPL token program does it:
        // https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/instruction.rs#L537
        match self {
            &StrangemoodInstruction::InitListing { amount } => {
                buf.push(0);
                buf.extend_from_slice(&amount.to_le_bytes());
            }
            &StrangemoodInstruction::PurchaseListing {} => buf.push(1),
            StrangemoodInstruction::SetListingAuthority {} => buf.push(2),
            StrangemoodInstruction::SetListingPrice { amount } => {
                buf.push(3);
                buf.extend_from_slice(&amount.to_le_bytes());
            }
            StrangemoodInstruction::SetListingDeposit {} => buf.push(4),
            StrangemoodInstruction::SetListingAvailability { available } => {
                buf.push(5);
                buf.push(if *available { 1 } else { 0 });
            }
            StrangemoodInstruction::SetCharter { data } => {
                buf.push(6);
                buf.extend_from_slice(&data.expansion_rate_amount.to_le_bytes());
                buf.push(data.expansion_rate_decimals);
                buf.extend_from_slice(&data.sol_contribution_rate_amount.to_le_bytes());
                buf.push(data.sol_contribution_rate_decimals);
                buf.extend_from_slice(&data.vote_contribution_rate_amount.to_le_bytes());
                buf.push(data.vote_contribution_rate_decimals);
                buf.extend_from_slice(&data.authority.to_bytes());
                buf.extend_from_slice(&data.realm_sol_token_account.to_bytes());
                buf.extend_from_slice(&data.realm_vote_token_account.to_bytes());

                let mut s: [u8; 128] = [0; 128];
                s.copy_from_slice(&data.uri);
                // let bs = data.uri.as_bytes();

                // for (i, b) in bs.iter().enumerate() {
                //     if i >= 128 {
                //         msg!("Charter URI too long");
                //         continue;
                //     }
                //     s[i] = *b;
                // }
                buf.extend_from_slice(&s);

                buf.extend_from_slice(&[0; 64]); // reserved
            }
        }
        buf
    }
}

#[cfg(test)]
mod test {

    use std::str::FromStr;

    use crate::fill_from_str;
    use solana_program::program_pack::Pack;

    use super::*;

    #[test]
    fn test_instruction_packing() {
        // Tag 0 -> InitListing
        let amount: u64 = 10;
        let check = StrangemoodInstruction::InitListing { amount };
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(0);
        input.extend_from_slice(&amount.to_le_bytes());
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 1 -> PurchaseListing
        let check = StrangemoodInstruction::PurchaseListing {};
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(1);
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 2 -> SetListingAuthority
        let check = StrangemoodInstruction::SetListingAuthority {};
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(2);
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 3 -> SetListingPrice
        let amount: u64 = 20;
        let check = StrangemoodInstruction::SetListingPrice { amount };
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(3);
        input.extend_from_slice(&amount.to_le_bytes());
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 4 -> SetListingDeposit
        let check = StrangemoodInstruction::SetListingDeposit {};
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(4);
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 5 -> SetListingAvailability
        let check = StrangemoodInstruction::SetListingAvailability { available: true };
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(5);
        input.push(1);
        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());

        // Tag 6 -> SetCharter
        let sol_ta = Pubkey::from_str("4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM").unwrap();
        let vote_ta = Pubkey::from_str("4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM").unwrap();
        let authority = Pubkey::from_str("HjqrPM6CHw8iem2sLtCAsGunGTN46juDFAHbvChyHiHV").unwrap();
        let mut bs: [u8; 128] = [0; 128];
        fill_from_str(&mut bs, &"https://strangemood.org".to_string());
        input.extend_from_slice(&bs);
        let check = StrangemoodInstruction::SetCharter {
            data: Charter {
                authority,
                realm_sol_token_account: sol_ta,
                realm_vote_token_account: vote_ta,
                expansion_rate_amount: 1,
                expansion_rate_decimals: 2,
                sol_contribution_rate_amount: 5,
                sol_contribution_rate_decimals: 2,
                vote_contribution_rate_amount: 5,
                vote_contribution_rate_decimals: 2,
                uri: bs,
                reserved: [0; 64],
            },
        };
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(6);
        let exp_amount: u64 = 1;
        input.extend_from_slice(&exp_amount.to_le_bytes());
        input.push(2);
        let cont_amount: u64 = 5;

        // Sol contr amount
        input.extend_from_slice(&cont_amount.to_le_bytes());
        input.push(2);

        // Vote contr amount
        input.extend_from_slice(&cont_amount.to_le_bytes());
        input.push(2);

        input.extend_from_slice(&authority.to_bytes());
        input.extend_from_slice(&sol_ta.to_bytes());
        input.extend_from_slice(&vote_ta.to_bytes());

        // uri
        let mut bs: [u8; 128] = [0; 128];
        fill_from_str(&mut bs, &"https://strangemood.org".to_string());
        input.extend_from_slice(&bs);

        // Reserved
        input.extend_from_slice(&[0; 64]);

        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        assert_eq!(packed, unpacked.pack());
        assert_eq!(unpacked.pack().len(), Charter::LEN);
        assert_eq!(packed.len(), Charter::LEN);

        let h = hex::encode(unpacked.pack());

        assert_eq!(h, "06010000000000000002050000000000000002050000000000000002f8b49f0fe7d40af9e1eee29a263ef7972314ae90b5f227d65b210669e54624c00100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000068747470733a2f2f737472616e67656d6f6f642e6f726700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000");
    }

    #[test]
    fn test_unpack_charter() {
        let sol_ta = Pubkey::new_unique();
        let vote_ta = Pubkey::new_unique();
        let authority = Pubkey::new_unique();
        let mut bs: [u8; 128] = [0; 128];
        fill_from_str(&mut bs, &"https://strangemood.org".to_string());
        let check = StrangemoodInstruction::SetCharter {
            data: Charter {
                expansion_rate_amount: 1,
                expansion_rate_decimals: 2,
                sol_contribution_rate_amount: 5,
                sol_contribution_rate_decimals: 2,
                vote_contribution_rate_amount: 5,
                vote_contribution_rate_decimals: 2,
                realm_sol_token_account: sol_ta,
                realm_vote_token_account: vote_ta,
                authority,
                uri: bs,
                reserved: [0; 64],
            },
        };
        let packed = check.pack();
        let mut input: Vec<u8> = Vec::with_capacity(size_of::<StrangemoodInstruction>());
        input.push(6);
        let exp_amount: u64 = 1;
        input.extend_from_slice(&exp_amount.to_le_bytes());
        input.push(2);
        let sol_cont_amount: u64 = 5;
        input.extend_from_slice(&sol_cont_amount.to_le_bytes());
        input.push(2);
        let vote_cont_amount: u64 = 5;
        input.extend_from_slice(&vote_cont_amount.to_le_bytes());
        input.push(2);

        input.extend_from_slice(&authority.to_bytes());
        input.extend_from_slice(&sol_ta.to_bytes());
        input.extend_from_slice(&vote_ta.to_bytes());

        let mut bs: [u8; 128] = [0; 128];
        fill_from_str(&mut bs, &"https://strangemood.org".to_string());
        input.extend_from_slice(&bs);

        // Reserved
        input.extend_from_slice(&[0; 64]);

        assert_eq!(packed, input);

        let unpacked = StrangemoodInstruction::unpack(&input).unwrap();
        let data = match unpacked {
            StrangemoodInstruction::SetCharter { data } => data,
            _ => panic!("oh no"),
        };
        assert_eq!(data.realm_sol_token_account, sol_ta);
    }

    #[test]
    fn test_unpack_bool() {
        assert_eq!(
            StrangemoodInstruction::unpack_bool(&[0, 1]),
            Err(ProgramError::InvalidInstructionData)
        );
        assert_eq!(
            StrangemoodInstruction::unpack_bool(&[2]),
            Err(ProgramError::InvalidInstructionData)
        );
        assert_eq!(StrangemoodInstruction::unpack_bool(&[0]), Ok(false));
        assert_eq!(StrangemoodInstruction::unpack_bool(&[1]), Ok(true));
    }
}
