use borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use solana_program::{
    msg,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};

/// The rules of the governance; controlled by a governance account
/// There should only be one charter per realm.
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Charter {
    // The amount of voting tokens to give to a user per 1.0 wrapped SOL contributed
    // via community account contributions.
    expansion_rate: f64,

    // The % of each purchase that goes to the community account.
    contribution_rate: f64,
}

impl Sealed for Charter {}

impl Pack for Charter {
    const LEN: usize = 169; // See "test_get_packed_len()" for explanation

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

/// "0.25 SOL"
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Price {
    /// The amount of SOL the lister wants.
    ///
    /// Note: remember the decimal place is defined
    /// in the mint account.
    pub amount: u64,
}

/// The user that's putting up the listing
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Seller {
    /// The seller's system account
    pub seller_pubkey: Pubkey,

    /// The token account to deposit funds into
    pub deposit_token_account_pubkey: Pubkey,
}

/// The thing the user is buying
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Product {
    /// The token of the mint that they're buying
    pub mint_pubkey: Pubkey,
}

/// The user-space `data` field of
/// the Listing's AccountInfo
#[derive(BorshSerialize, BorshDeserialize, BorshSchema, PartialEq)]
pub struct Listing {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // This binds this listing to a governance, bound by a charter.
    pub charter_governance_pubkey: Pubkey,

    pub seller: Seller,
    pub price: Price,
    pub product: Product,
}

impl Sealed for Listing {}

impl IsInitialized for Listing {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for Listing {
    const LEN: usize = 169; // See "test_get_packed_len()" for explanation

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

    use super::*;

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
    fn test_pack_unpack() {
        let dst = &mut [0u8; Listing::LEN];
        let listing = Listing {
            is_initialized: true,

            price: Price { amount: 10 },
            seller: Seller {
                seller_pubkey: Pubkey::new_unique(),
                deposit_token_account_pubkey: Pubkey::new_unique(),
            },
            product: Product {
                mint_pubkey: Pubkey::new_unique(),
            },
            charter_governance_pubkey: Pubkey::new_unique(),
        };

        Listing::pack(listing, dst).unwrap();
    }
}
