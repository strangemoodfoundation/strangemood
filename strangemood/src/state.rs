use borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use solana_program::{
    msg,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

/// The rules of the governance; controlled by a governance account
/// There should only be one charter per realm.
///
/// Note: keep in mind these fields are in-order!
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Charter {
    // The amount of voting tokens to give to a user per 1.0 wrapped SOL contributed
    // via community account contributions.
    //
    // Note that Borsh doesn't support floats, and so we carry over the pattern
    // used in the token program of having an "amount" and a "decimals".
    // So an "amount" of 100 and a "decimals" of 3 would be 0.1
    pub expansion_rate_amount: u64,
    pub expansion_rate_decimals: u8,

    // The % of each purchase that goes to the community account.
    pub sol_contribution_rate_amount: u64,
    pub sol_contribution_rate_decimals: u8,

    // The % of each vote token minting goes back to the governance to fund
    // new ecosystem projects
    pub vote_contribution_rate_amount: u64,
    pub vote_contribution_rate_decimals: u8,

    // The pubkey of the keypair that can modify this charter.
    pub authority: Pubkey,

    // The community account of the realm that contributions go to
    pub realm_sol_token_account: Pubkey,
    pub realm_vote_token_account: Pubkey,
}

pub(crate) fn amount_as_float(amount: u64, decimals: u8) -> f64 {
    amount as f64 / i32::pow(10, decimals.into()) as f64
}

pub(crate) fn float_as_amount(float: f64, decimals: u8) -> u64 {
    (float as f64 * i32::pow(10, decimals.into()) as f64) as u64
}

impl Charter {
    pub fn expansion_rate(&self) -> f64 {
        amount_as_float(self.expansion_rate_amount, self.expansion_rate_decimals)
    }
    pub fn sol_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.sol_contribution_rate_amount,
            self.sol_contribution_rate_decimals,
        )
    }
    pub fn vote_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.vote_contribution_rate_amount,
            self.vote_contribution_rate_decimals,
        )
    }
}

impl Sealed for Charter {}

impl Pack for Charter {
    const LEN: usize = 123; // See "test_get_packed_len()" for explanation

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let data = self.try_to_vec().unwrap();
        dst[..data.len()].copy_from_slice(&data);
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut mut_src: &[u8] = src;
        Self::deserialize(&mut mut_src).map_err(|err| {
            msg!("Error: failed to deserialize Charter account: {}", err);
            ProgramError::InvalidAccountData
        })
    }
}

/// The user-space `data` field of
/// the Listing's AccountInfo
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Listing {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // If "false", this listing cannot be bought.
    pub is_available: bool,

    // This binds this listing to a governance, bound by a charter.
    pub charter_governance: Pubkey,

    /// The seller's system account, effectively the authority.
    pub authority: Pubkey,

    /// The token account to deposit sol into
    pub sol_token_account: Pubkey,

    /// The token account to deposit community votes into
    pub community_token_account: Pubkey,

    /// Lamports required to purchase
    pub price: u64,

    /// The mint that represents the token they're purchasing
    pub mint: Pubkey,
}

impl Sealed for Listing {}

impl IsInitialized for Listing {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for Listing {
    const LEN: usize = 170; // See "test_get_packed_len()" for explanation

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let data = self.try_to_vec().unwrap();
        dst[..data.len()].copy_from_slice(&data);
    }

    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let mut mut_src: &[u8] = src;
        Self::deserialize(&mut mut_src).map_err(|err| {
            msg!("Error: failed to deserialize Listing account: {}", err);
            ProgramError::InvalidAccountData
        })
    }
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use super::*;

    #[test]
    fn test_rate_calcs() {
        let charter = Charter {
            authority: Pubkey::new_unique(),
            expansion_rate_amount: 1000,
            expansion_rate_decimals: 5,
            sol_contribution_rate_amount: 2000,
            sol_contribution_rate_decimals: 0,
            vote_contribution_rate_amount: 2000,
            vote_contribution_rate_decimals: 0,
            realm_sol_token_account: Pubkey::new_unique(),
            realm_vote_token_account: Pubkey::new_unique(),
        };

        assert_eq!(charter.expansion_rate(), 0.01000);
        assert_eq!(charter.sol_contribution_rate(), 2000.0);
        assert_eq!(float_as_amount(0.01, 2), 1);
        assert_eq!(float_as_amount(amount_as_float(200, 2), 2), 200);
    }

    #[test]
    fn test_get_packed_len() {
        // If this fails, you need to update Listing::LEN to whatever
        // the borsh schema get_packed_len function says it should be
        assert_eq!(
            Listing::get_packed_len(),
            solana_program::borsh::get_packed_len::<Listing>(),
        );

        // If this fails, you need to update Charter::LEN to whatever
        // the borsh schema get_packed_len function says it should be
        assert_eq!(
            Charter::get_packed_len(),
            solana_program::borsh::get_packed_len::<Charter>(),
        );
    }

    #[test]
    fn test_pack_unpack_listing() {
        let dst = &mut [0u8; Listing::LEN];
        let listing = Listing {
            is_initialized: true,
            price: 10,
            authority: Pubkey::new_unique(),
            sol_token_account: Pubkey::new_unique(),
            community_token_account: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            charter_governance: Pubkey::new_unique(),
            is_available: true,
        };

        Listing::pack(listing, dst).unwrap();
    }

    #[test]
    fn test_pack_unpack_charter() {
        let dst = &mut [0u8; Charter::LEN];

        let sol_ta = Pubkey::from_str("4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM").unwrap();
        let vote_ta = Pubkey::new_unique();
        let authority = Pubkey::from_str("HjqrPM6CHw8iem2sLtCAsGunGTN46juDFAHbvChyHiHV").unwrap();
        let charter = Charter {
            authority,
            realm_sol_token_account: sol_ta,
            realm_vote_token_account: vote_ta,
            expansion_rate_amount: 1,
            expansion_rate_decimals: 2,
            sol_contribution_rate_amount: 5,
            sol_contribution_rate_decimals: 2,
            vote_contribution_rate_amount: 5,
            vote_contribution_rate_decimals: 2,
        };

        Charter::pack(charter, dst).unwrap();

        let new_charter = Charter::unpack_unchecked(dst).unwrap();
        assert_eq!(new_charter.expansion_rate_amount, 1);
        assert_eq!(new_charter.expansion_rate_decimals, 2);
    }
}
