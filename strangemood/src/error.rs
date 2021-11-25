// inside error.rs
use num_traits::FromPrimitive;
use solana_program::{
    decode_error::DecodeError,
    msg,
    program_error::{PrintProgramError, ProgramError},
};
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum StrangemoodError {
    /// Some accounts, like listings, are required to be rent
    /// exempt.
    ///
    /// This should hopefully help prevent against spam; developers
    /// or client apps will need to put up a small fee to list
    /// their games.
    ///
    /// But more importantly, if the listing disppears, then
    /// the game someone bought ALSO disappears, and that seems bad.
    #[error("Not Rent Exempt")]
    NotRentExempt,

    /// Someone has tried to purchase a listing for more or less
    /// than what the listing is for.
    #[error("Invalid Purchase Amount")]
    InvalidPurchaseAmount,

    /// A charter was passed in that isn't owned by the realm
    #[error("Unauthorized Charter")]
    UnauthorizedCharter,

    /// You tried to write to the listing, but you're not the authority
    #[error("Unauthorized Listing Authority")]
    UnauthorizedListingAuthority,

    /// You tried to write to the charter, but you're not the authority
    #[error("Unauthorized Charter Authority")]
    UnauthorizedCharterAuthority,

    /// Deposit Accounts are required to be owned by
    /// the signer to prevent phishing.
    ///
    /// If this wasn't here, someone could create a fake
    /// client app, and allow someone to "upload the game",
    /// and then steal all the game sales revenue :(
    #[error("Deposit Token Account not owned by signer")]
    DepositAccountNotOwnedBySigner,

    /// Payment must be must be wrapped SOL.
    ///
    /// If the contract allowed any token, then someone
    /// could drain funds from the DAO by uploading large
    /// files, and "paying" in a worthless token they
    /// just created
    #[error("The token mint used in price is not supported")]
    TokenMintNotSupported,
}

impl From<StrangemoodError> for ProgramError {
    fn from(e: StrangemoodError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl PrintProgramError for StrangemoodError {
    fn print<E>(&self)
    where
        E: 'static + std::error::Error + DecodeError<E> + PrintProgramError + FromPrimitive,
    {
        match self {
            StrangemoodError::NotRentExempt => {
                msg!("Error: Lamport balance below rent-exempt threshold")
            }
            StrangemoodError::DepositAccountNotOwnedBySigner => {
                msg!("Error: The deposit token account must be owned by the signer of the transaction")
            }
            StrangemoodError::TokenMintNotSupported => {
                msg!("Error: The token mint used must be one of the supported tokens")
            }
            StrangemoodError::InvalidPurchaseAmount => todo!(),
            StrangemoodError::UnauthorizedCharter => todo!(),
            StrangemoodError::UnauthorizedListingAuthority => todo!(),
            StrangemoodError::UnauthorizedCharterAuthority => todo!(),
        }
    }
}
