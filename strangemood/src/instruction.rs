use solana_program::program_error::ProgramError;
use std::convert::TryInto;
use std::mem::size_of;

use crate::error::StrangemoodError::InvalidInstruction;

// inside instruction.rs
pub enum StrangemoodInstruction {
    /// Sets up a sellable app
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account that initializes the listing
    /// 1. `[writable]` The listing account that will store the price and the token
    /// 2. `[]` The mint account of the app token
    /// 3. `[]` The initializer's token account to deposit into. (must be SOL)
    /// 4. `[]` The voting token account where the lister will receive
    ///        community tokens at
    /// 5. `[]` The realm account
    /// 6. `[]` The account governance of the charter
    /// 7. `[]` The account of the charter itself
    /// 8. `[]` The rent sysvar
    /// 9. `[]` The token program
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
    /// 2. `[]` The new SOL deposit account
    /// 3. `[]` The new Community deposit account
    SetListingAvailability { available: bool },

    /// Purchase from a listing
    ///
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` The account of the person initializing the listing
    /// 1. `[]` The listing account that you're trying to purchase from
    /// 2. `[]` The token account that contains the tokens used to purchase the listing
    /// 3. `[]` The token account that will contain the app tokens of the listing (must be a multi-sig with the strangemood program m=2)
    /// 4. `[]` The multi-sig owner of the app token account (3)
    /// 5. `[]` The realm account
    /// 6. `[]` The account governance of the charter
    /// 7. `[]` The account of the charter itself
    /// 8. `[]` The rent sysvar
    /// 9. `[]` The token program
    PurchaseListing {},
}

impl StrangemoodInstruction {
    /// Unpacks a byte buffer into a [StrangemoodInstruction](enum.StrangemoodInstruction.html).
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

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
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(amount)
    }

    fn unpack_bool(input: &[u8]) -> Result<bool, ProgramError> {
        if input.len() != 1 {
            return Err(InvalidInstruction.into());
        }
        if input[0] == 0 {
            Ok(false)
        } else if input[0] == 1 {
            Ok(true)
        } else {
            Err(InvalidInstruction.into())
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
        }
        buf
    }
}

#[cfg(test)]
mod test {

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
    }

    #[test]
    fn test_unpack_bool() {
        assert_eq!(
            StrangemoodInstruction::unpack_bool(&[0, 1]),
            Err(InvalidInstruction.into())
        );
        assert_eq!(
            StrangemoodInstruction::unpack_bool(&[2]),
            Err(InvalidInstruction.into())
        );
        assert_eq!(StrangemoodInstruction::unpack_bool(&[0]), Ok(false));
        assert_eq!(StrangemoodInstruction::unpack_bool(&[1]), Ok(true));
    }
}
