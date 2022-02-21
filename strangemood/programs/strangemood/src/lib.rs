use anchor_lang::{declare_id, prelude::*, System, account, Accounts};
use anchor_spl::token::{Mint, Token, TokenAccount};

use cpi::mint_to;
use state::{CashierTreasury, Charter, Cashier, CharterTreasury, Listing, Receipt};
use std::cmp;

pub mod state;
pub mod error;
pub mod cpi;
pub mod util;

declare_id!("sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW");


fn distribute_governance_tokens<'a>(
    contributed: u64, 
    scalar: f64, 
    contribution_rate: f64, 
    token_program: AccountInfo<'a>, 
    charter_mint: AccountInfo<'a>,
    charter_mint_authority: AccountInfo<'a>,
    charter_mint_bump: u8,
    listing_deposit: AccountInfo<'a>,
    charter_deposit: AccountInfo<'a>,
) -> ProgramResult {
    let votes = contributed as f64 * scalar;
    let deposit_rate = 1.0 - contribution_rate;
    let deposit_amount = (deposit_rate * votes as f64) as u64;
    let contribution_amount = (votes as u64) - deposit_amount;

    // Mint votes to lister
    mint_to(
        token_program.clone(),
        charter_mint.clone(),
       listing_deposit,
        charter_mint_authority.clone(),
        charter_mint_bump,
        deposit_amount,
    )?;

    // Mint votes to charter
    mint_to(
        token_program,
        charter_mint,
        charter_deposit,
        charter_mint_authority,
        charter_mint_bump,
        contribution_amount,
    )?;

    Ok(())
}


#[program]
pub mod strangemood {
    use anchor_lang::{prelude::Context, solana_program::program_option::COption};

    use crate::{util::amount_as_float, error::StrangemoodError, cpi::{token_transfer, mint_to_and_freeze, token_transfer_with_seed, close_token_escrow_account, close_native_account, burn, mint_to}};

    use super::*;

    pub fn init_listing(
        ctx: Context<InitListing>,
        _mint_bump: u8,
        _decimals: u8,
        price: u64,
        refundable: bool,
        consumable: bool,
        available: bool,
        cashier_split_amount: u64,
        cashier_split_decimals: u8,
        uri: String,
    ) -> ProgramResult {

        let charter = ctx.accounts.charter.clone().into_inner();

        // Check that the payment deposit is wrapped sol
        let payment_deposit = ctx.accounts.payment_deposit.clone().into_inner();
        if payment_deposit.mint != ctx.accounts.charter_treasury.clone().into_inner().mint {
            return Err(StrangemoodError::MintNotSupported.into());
        }

        // Check that the vote_deposit is the charter's mint
        let vote_deposit = ctx.accounts.vote_deposit.clone().into_inner();
        if vote_deposit.mint != charter.mint {
            return Err(StrangemoodError::MintNotSupported.into())
        }

        let split = amount_as_float(cashier_split_amount, cashier_split_decimals);
        if split < 0.0 || split > 1.0 {
            return Err(StrangemoodError::InvalidCashierSplit.into())
        }

        let listing = &mut ctx.accounts.listing;
        listing.is_initialized = true;
        listing.price = price;
        listing.mint = ctx.accounts.mint.key();
        listing.authority = *ctx.accounts.user.key;
        listing.payment_deposit = ctx.accounts.payment_deposit.key();
        listing.vote_deposit = ctx.accounts.vote_deposit.key();
        listing.charter = ctx.accounts.charter.key();
        listing.uri = uri;
        listing.is_refundable = refundable;
        listing.is_consumable = consumable;
        listing.is_available = available;
        listing.cashier_split_amount = cashier_split_amount;
        listing.cashier_split_decimals = cashier_split_decimals;

        Ok(())
    }

    pub fn purchase_with_cashier(
        ctx: Context<PurchaseWithCashier>,
        receipt_nonce: u128,
        listing_mint_bump: u8,
        _escrow_authority_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        if !listing.is_available {
            return Err(StrangemoodError::ListingUnavailable.into());
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into());
        }

        token_transfer(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.purchase_token_account.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.user.to_account_info(),
            amount * listing.price,
        )?;

        // if the listing is refundable, then mint the user the
        // token immediately (it can be burned later).
        if listing.is_refundable {
            mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                amount,
            )?;
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_initialized = true;
        receipt.is_refundable = listing.is_refundable;
        receipt.listing = ctx.accounts.listing.key();
        receipt.purchaser = ctx.accounts.user.key();
        receipt.quantity = amount;
        receipt.listing_token_account = ctx.accounts.listing_token_account.key();
        receipt.cashier = Some(ctx.accounts.cashier.key());
        receipt.nonce = receipt_nonce;
        receipt.price = listing.price;
        receipt.escrow = ctx.accounts.escrow.key();

        Ok(())
    }

    pub fn cash_with_cashier(
        ctx: Context<CashWithCashier>,
        listing_mint_bump: u8,
        charter_mint_bump: u8,
        escrow_authority_bump: u8
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();

        if receipt.cashier != None {
            return Err(StrangemoodError::ReceiptDoesNotHaveCashier.into());
        }
        if listing.mint != ctx.accounts.listing_mint.key() {
            return Err(StrangemoodError::UnexpectedListingMint.into());
        }
        if ctx.accounts.listing_token_account.key() != receipt.listing_token_account {
            return Err(StrangemoodError::UnexpectedListingTokenAccount.into());
        }

        // Check that the listing deposits match the listing account
        if listing.vote_deposit != ctx.accounts.listings_vote_deposit.key()
            || listing.payment_deposit != ctx.accounts.listings_payment_deposit.key()
        {
            return Err(StrangemoodError::DepositIsNotFoundInListing.into());
        }

        // Check that the charter passed in is the one that's in the listing
        if listing.charter != ctx.accounts.charter.key() {
            return Err(StrangemoodError::UnauthorizedCharter.into());
        }
        
        // Check that the mint is the same that's in the charter
        if charter.mint != ctx.accounts.charter_mint.key() {
            return Err(StrangemoodError::MintIsNotFoundInCharter.into());
        }

        // Check that the vote deposit is the same as what's found in the mint
        if ctx.accounts.charter_vote_deposit.key() != charter.vote_deposit {
            return Err(StrangemoodError::DepositIsNotFoundInCharter.into());
        }

        // If the receipt is refundable, then we've already minted
        // the listing token. Otherwise, we have to do it now
        if !receipt.is_refundable {
            mint_to_and_freeze(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.quantity, 
            )?;
        }

        // First split the funds into the a "contribution" pool, which goes to 
        // the charter governance, and a "deposit" pool.
        let lamports: u64 = receipt.price;
        let deposit_rate = 1.0 - charter.payment_contribution_rate();
        let deposit_amount = (deposit_rate * lamports as f64) as u64;
        let to_charter_amount = lamports - deposit_amount;

        // Then split the deposit pool between the lister, and the cashier.
        // (charter, (lister, cashier))
        let to_cashier_rate = amount_as_float(listing.cashier_split_amount, listing.cashier_split_decimals);
        let to_lister_rate = 1.0 - to_cashier_rate;
        let to_lister_amount = (deposit_amount as f64 * to_lister_rate) as u64;
        let to_cashier_amount = deposit_amount - to_lister_amount;

        // Transfer from escrow to lister
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(),
        ctx.accounts.escrow.to_account_info(),
            ctx.accounts.listings_payment_deposit.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            to_lister_amount as u64,
            b"escrow",
            escrow_authority_bump
        )?;

        // Transfer from escrow to cashier
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(),
        ctx.accounts.escrow.to_account_info(),
            ctx.accounts.listings_payment_deposit.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            to_cashier_amount as u64,
            b"escrow",
            escrow_authority_bump
        )?;
    
        // Transfer from escrow to charter
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(),
        ctx.accounts.escrow.to_account_info(),
            ctx.accounts.charter_treasury_deposit.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            to_charter_amount as u64,
            b"escrow",
            escrow_authority_bump
        )?;

        let treasury = ctx.accounts.charter_treasury.clone().into_inner();
        let votes = to_charter_amount as f64 * charter.expansion_rate(treasury.scalar_amount, treasury.scalar_decimals);
        let deposit_rate = 1.0 - charter.vote_contribution_rate();
        let deposit_amount = (deposit_rate * votes as f64) as u64;
        let contribution_amount = (votes as u64) - deposit_amount;

        // Mint votes to lister
        mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.charter_mint.to_account_info(),
            ctx.accounts.listings_vote_deposit.to_account_info(),
            ctx.accounts.charter_mint_authority.to_account_info(),
            charter_mint_bump,
            deposit_amount,
        )?;

        // Mint votes to charter
        mint_to(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.charter_mint.to_account_info(),
            ctx.accounts.charter_vote_deposit.to_account_info(),
            ctx.accounts.charter_mint_authority.to_account_info(),
            charter_mint_bump,
            contribution_amount,
        )?;

        distribute_governance_tokens(
            to_charter_amount,
             charter.expansion_rate(treasury.scalar_amount, treasury.scalar_decimals),
             charter.vote_contribution_rate(),
             ctx.accounts.token_program.to_account_info(),
             ctx.accounts.charter_mint.to_account_info(),
             ctx.accounts.charter_mint_authority.to_account_info(),
             charter_mint_bump,
             ctx.accounts.listings_vote_deposit.to_account_info(),
             ctx.accounts.charter_vote_deposit.to_account_info(),
        )?;

        // Close the escrow account.
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            escrow_authority_bump
        )?;

        // Close the receipt.
        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        Ok(())
    }

    pub fn cancel(
        ctx: Context<Cancel>,
        listing_mint_bump: u8,
        escrow_authority_bump:u8,
    ) -> ProgramResult {
        let receipt = ctx.accounts.receipt.clone().into_inner();

        // If the receipt is refundable, then we've already issued tokens
        // and so we need to burn them in order to refund.
        if receipt.is_refundable {
            burn(
                ctx.accounts.token_program.to_account_info(),
                ctx.accounts.listing_mint.to_account_info(),
                ctx.accounts.listing_token_account.to_account_info(),
                ctx.accounts.listing_mint_authority.to_account_info(),
                listing_mint_bump,
                receipt.quantity,
            )?;
        }

        // Close the receipt account
        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.purchaser.to_account_info(),
        );

        // Transfer all the funds in the escrow back to the user 
        token_transfer_with_seed(            
            ctx.accounts.token_program.to_account_info(), 
            ctx.accounts.escrow.to_account_info(), 
            ctx.accounts.return_deposit.to_account_info(), 
            ctx.accounts.escrow_authority.to_account_info(), 
            ctx.accounts.escrow.amount,
            b"escrow",
            escrow_authority_bump
        )?;

        // Close the escrow
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.purchaser.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            escrow_authority_bump
        )?;

        Ok(())
    }

    pub fn consume(
        ctx: Context<Consume>,
        listing_mint_bump: u8,
        amount: u64,
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();

        if ctx.accounts.authority.key() != listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        if !listing.is_consumable {
            return Err(StrangemoodError::ListingIsNotConsumable.into());
        }

        burn(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.listing_token_account.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            listing_mint_bump,
            amount,
        )?;

        Ok(())
    }

    pub fn init_charter(
        ctx: Context<InitCharter>,
        expansion_rate_amount: u64,
        expansion_rate_decimals: u8,
        payment_contribution_rate_amount: u64,
        payment_contribution_rate_decimals: u8,
        vote_contribution_rate_amount: u64,
        vote_contribution_rate_decimals: u8,
        uri: String,
    ) -> ProgramResult {
        // Only the mint authority can make a charter.
        let mint = ctx.accounts.mint.clone().into_inner();
        if let COption::Some(authority) = mint.mint_authority {
            if authority != ctx.accounts.user.key() {
                return Err(StrangemoodError::SignerIsNotMintAuthority.into())
            }
        } else {
            // You can't create a charter with a mint that has a fixed supply of 
            // tokens, since purchases would fail.
            return Err(StrangemoodError::SignerIsNotMintAuthority.into())
        }
        
        let charter = &mut ctx.accounts.charter;
        charter.authority = ctx.accounts.authority.key();
        charter.expansion_rate_amount = expansion_rate_amount;
        charter.expansion_rate_decimals = expansion_rate_decimals;
        charter.payment_contribution_rate_amount = payment_contribution_rate_amount;
        charter.payment_contribution_rate_decimals = payment_contribution_rate_decimals;
        charter.vote_contribution_rate_amount = vote_contribution_rate_amount;
        charter.vote_contribution_rate_decimals = vote_contribution_rate_decimals;
        charter.vote_deposit = ctx.accounts.vote_deposit.key();
        charter.mint = ctx.accounts.mint.key();
        charter.uri = uri;

        Ok(())
    }

    pub fn set_listing_price(ctx: Context<SetListing>, price: u64) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.price = price;
        Ok(())
    }

    pub fn set_listing_uri(ctx: Context<SetListing>, uri: String) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.uri = uri;
        Ok(())
    }

    pub fn set_listing_availability(
        ctx: Context<SetListing>,
        is_available: bool,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.is_available = is_available;
        Ok(())
    }

    pub fn set_listing_deposits(ctx: Context<SetListingDeposit>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.vote_deposit = ctx.accounts.vote_deposit.key();
        ctx.accounts.listing.payment_deposit = ctx.accounts.payment_deposit.key();
        Ok(())
    }

    pub fn set_listing_authority(ctx: Context<SetListingAuthority>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.authority = ctx.accounts.authority.key();
        Ok(())
    }

    // Migrate a listing to a different charter
    pub fn set_listing_charter(ctx: Context<SetListingCharter>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.listing.charter = ctx.accounts.charter.key();
        Ok(())
    }

    pub fn set_charter_expansion_rate(
        ctx: Context<SetCharter>,
        expansion_rate_amount: u64,
        expansion_rate_decimals: u8,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.charter.expansion_rate_amount = expansion_rate_amount;
        ctx.accounts.charter.expansion_rate_decimals = expansion_rate_decimals;
        Ok(())
    }

    pub fn set_charter_contribution_rate(
        ctx: Context<SetCharter>,
        sol_contribution_rate_amount: u64,
        sol_contribution_rate_decimals: u8,
        vote_contribution_rate_amount: u64,
        vote_contribution_rate_decimals: u8,
    ) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.charter.payment_contribution_rate_amount = sol_contribution_rate_amount;
        ctx.accounts.charter.payment_contribution_rate_decimals = sol_contribution_rate_decimals;

        ctx.accounts.charter.vote_contribution_rate_amount = vote_contribution_rate_amount;
        ctx.accounts.charter.vote_contribution_rate_decimals = vote_contribution_rate_decimals;

        Ok(())
    }

    // Migrates the charter to a different authority, like a new governance program
    pub fn set_charter_authority(ctx: Context<SetCharterAuthority>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        } 

        ctx.accounts.charter.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn set_charter_vote_deposit(ctx: Context<SetCharterVoteDeposit>) -> ProgramResult {
        if ctx.accounts.user.key() != ctx.accounts.charter.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        ctx.accounts.charter.vote_deposit = ctx.accounts.vote_deposit.key();
        Ok(())
    }

    pub fn init_charter_treasury(ctx: Context<InitCharterTreasury>, _treasury_bump: u8, expansion_scalar_amount: u64, expansion_scalar_decimals: u8) -> ProgramResult {
        
        let treasury = &mut ctx.accounts.treasury;
        treasury.charter = ctx.accounts.charter.key();
        treasury.deposit = ctx.accounts.deposit.key(); 
        treasury.mint = ctx.accounts.mint.key();
        treasury.scalar_amount = expansion_scalar_amount; 
        treasury.scalar_decimals = expansion_scalar_decimals; 

        Ok(())
    }

    pub fn set_charter_treasury_expansion_scalar(ctx: Context<SetCharterTreasuryExpansionScalar>, expansion_scalar_amount: u64, expansion_scalar_decimals: u8) -> ProgramResult {
        
        let treasury = &mut ctx.accounts.treasury;
        treasury.scalar_amount = expansion_scalar_amount; 
        treasury.scalar_decimals = expansion_scalar_decimals; 

        Ok(())
    }

    pub fn set_charter_treasury_deposit(ctx: Context<SetCharterTreasuryDeposit>) -> ProgramResult {
        let treasury = &mut ctx.accounts.treasury;
        treasury.deposit = ctx.accounts.deposit.key(); 

        Ok(())
    }

    pub fn init_cashier(ctx: Context<InitCashier>, _stake_bump: u8, uri: String) -> ProgramResult {
        let cashier = &mut ctx.accounts.cashier;
        cashier.is_initialized = true;
        cashier.charter = ctx.accounts.charter.key();
        cashier.stake = ctx.accounts.stake.key();
        cashier.authority = ctx.accounts.authority.key();
        cashier.last_withdraw_epoch = ctx.accounts.clock.epoch;
        cashier.uri = uri;

        Ok(())
    }

    pub fn init_cashier_treasury(ctx: Context<InitCashierTreasury>) -> ProgramResult {
        let treasury = &mut ctx.accounts.treasury; 
        
        treasury.is_initialized = true; 
        treasury.cashier = ctx.accounts.cashier.key();
        treasury.deposit = ctx.accounts.deposit.key();
        treasury.mint = ctx.accounts.mint.key();
        treasury.last_withdraw_epoch = ctx.accounts.clock.epoch;

        Ok(())
    }

    pub fn burn_cashier_stake(ctx: Context<BurnCashierStake>,  mint_authority_bump: u8, amount: u64) -> ProgramResult {   
        burn(
            ctx.accounts.token_program.to_account_info(), 
            ctx.accounts.mint.to_account_info(),
             ctx.accounts.stake.to_account_info(),
              ctx.accounts.mint_authority.to_account_info(),
               mint_authority_bump,
                amount)?;

        Ok(())
    }

    // A decentralized crank that moves money from the the cashier's escrow to their deposit.
    pub fn withdraw_cashier_treasury(ctx: Context<WithdrawCashierTreasury>, _mint_authority_bump: u8, cashier_escrow_bump: u8) -> ProgramResult {
        let charter = ctx.accounts.charter.clone().into_inner();
        let charter_treasury = ctx.accounts.charter_treasury.clone().into_inner();
        let stake = ctx.accounts.stake.clone().into_inner();
        let clock = ctx.accounts.clock.clone();
        let cashier_treasury = &mut ctx.accounts.cashier_treasury;

        // Calculate the amount to transfer
        let amount_per_period = stake.amount as f64 * amount_as_float(charter_treasury.scalar_amount, charter_treasury.scalar_decimals);
        let amount_per_epoch = amount_per_period as f64 / charter.withdraw_period as f64;
        let epochs_passed = clock.epoch - cashier_treasury.last_withdraw_epoch;
        let amount_to_transfer = amount_per_epoch * epochs_passed as f64;

        // Transfer what we can
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.escrow.to_account_info(),
         ctx.accounts.deposit.to_account_info(),
        ctx.accounts.escrow_authority.to_account_info(),
            cmp::min(amount_to_transfer as u64, ctx.accounts.escrow.amount),
            b"cashier.escrow", 
            cashier_escrow_bump
        )?;

        // Update cashier treasury's last epoch
        cashier_treasury.last_withdraw_epoch = clock.epoch;

        Ok(())
    }

    // A decentralized crank that moves money from the the cashier's escrow to their deposit.
    pub fn withdraw_cashier_stake(ctx: Context<WithdrawCashierStake>, cashier_escrow_bump: u8) -> ProgramResult {
        let charter = ctx.accounts.charter.clone().into_inner();
        let clock = ctx.accounts.clock.clone();
        let cashier = &mut ctx.accounts.cashier;

        // Calculate the amount to transfer
        let amount_per_period = charter.stake_withdraw_amount;
        let amount_per_epoch = amount_per_period as f64 / charter.withdraw_period as f64;
        let epochs_passed = clock.epoch - cashier.last_withdraw_epoch;
        let amount_to_transfer = amount_per_epoch * epochs_passed as f64;

        // Transfer what we can
        token_transfer_with_seed(
            ctx.accounts.token_program.to_account_info(), 
        ctx.accounts.stake.to_account_info(),
            ctx.accounts.deposit.to_account_info(),
        ctx.accounts.stake_authority.to_account_info(),
            cmp::min(amount_to_transfer as u64, ctx.accounts.stake.amount),
            b"cashier.stake", 
            cashier_escrow_bump
        )?;

        // Update cashier treasury's last epoch
        cashier.last_withdraw_epoch = clock.epoch;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_nonce: u128, listing_mint_bump: u8, escrow_authority_bump:u8)]
pub struct PurchaseWithCashier<'info> {

    // The user's token account where funds will be transfered from
    #[account(mut)]
    pub purchase_token_account: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=listing_payment_deposit.key()==listing.clone().into_inner().payment_deposit,
        constraint=listing_mint.key()==listing.clone().into_inner().mint,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        constraint=listing_payment_deposit.mint==listing_payment_deposit_mint.key()
    )]
    pub listing_payment_deposit: Box<Account<'info, TokenAccount>>,

    // The type of funds that this 
    pub listing_payment_deposit_mint: Account<'info, Mint>,

    // The person who's allowed to cash out the listing
    pub cashier: AccountInfo<'info>,

    // A token account of the listing.mint where listing tokens
    // will be deposited at
    #[account(mut)]
    pub listing_token_account: Account<'info, TokenAccount>,

    // The mint associated with the listing
    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    // A receipt that lets you refund something later.
    //
    // 8 for the tag
    // 1 for is_initialized bool
    // 1 for is_refundable bool
    // 1 for is_cashable bool
    // 32 for listing pubkey
    // 32 for listing_token_account pubkey
    // 32 for purchaser pubkey
    // 32 for cashier pubkey
    // 32 for escrow pubkey
    // 8 for quantity u64
    // 8 for price u64
    // 16 for the unique nonce
    #[account(init,
        seeds = [b"receipt" as &[u8], &receipt_nonce.to_le_bytes()],
        bump,
        payer = user,
        space = 8 + 1 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 16)]
    pub receipt: Box<Account<'info, Receipt>>,

    #[account(
        init,
        payer=user,
        token::mint = listing_payment_deposit_mint,
        token::authority = escrow_authority,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"escrow", escrow.key().as_ref()],
        bump=escrow_authority_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(listing_mint_bump: u8, charter_mint_bump: u8, escrow_authority_bump: u8)]
pub struct CashWithCashier<'info> {
    #[account(has_one=charter)]
    pub cashier: Account<'info, Cashier>,

    #[account(
        has_one=cashier,
        constraint=cashier_treasury.escrow==cashier_treasury_escrow.key(),
        constraint=cashier_treasury.mint==charter_treasury.mint,
        constraint=cashier_treasury.mint==listings_payment_deposit.mint,
    )]
    pub cashier_treasury: Account<'info, CashierTreasury>,

    #[account(mut)]
    pub cashier_treasury_escrow: Account<'info, TokenAccount>,

    #[account(mut,
        has_one=listing, has_one=listing_token_account, has_one=purchaser, has_one=escrow,
    constraint=receipt.cashier == Some(cashier.key()))]
    pub receipt: Account<'info, Receipt>,

    // The signer that purchased, who gets their SOL back that they used for the receipt.
    pub purchaser: AccountInfo<'info>,

    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"escrow", escrow.key().as_ref()],
        bump=escrow_authority_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_payment_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub listings_vote_deposit: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(
        constraint=charter.key()==listing.clone().into_inner().charter,
        constraint=listing_mint.key()==listing.clone().into_inner().mint,
        constraint=listings_payment_deposit.key()==listing.clone().into_inner().payment_deposit,
        constraint=listings_vote_deposit.key()==listing.clone().into_inner().vote_deposit,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    #[account(
        has_one=charter,
        constraint=charter_treasury_deposit.key()==charter_treasury.clone().into_inner().deposit,
        constraint=charter_treasury.mint==listings_payment_deposit.mint,
    )]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    #[account(mut)]
    pub charter_treasury_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_vote_deposit: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub charter_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", charter_mint.key().as_ref()],
        bump = charter_mint_bump,
    )]
    pub charter_mint_authority: AccountInfo<'info>,

    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    #[account(
        constraint=charter.clone().into_inner().mint==charter_mint.key(),
        constraint=charter.vote_deposit==charter_vote_deposit.key(),
        constraint=charter.mint==charter_mint.key(),
    )]
    pub charter: Box<Account<'info, Charter>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump: u8)]
pub struct Cancel<'info> {
    pub purchaser: Signer<'info>,

    // Where we'll return the tokens back to 
    #[account(mut)]
    pub return_deposit: Account<'info, TokenAccount>,

    #[account(mut,
        has_one=listing,
        has_one=listing_token_account, 
        has_one=purchaser,
        has_one=escrow
    )]
    pub receipt: Account<'info, Receipt>,

    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,

    pub escrow_authority: AccountInfo<'info>,

    #[account(mut)]
    pub listing_token_account: Box<Account<'info, TokenAccount>>,

    // The listing to purchase
    #[account(constraint=listing.mint==listing_mint.key())]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub listing_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", listing_mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub listing_mint_authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(listing_mint_authority_bump:u8)]
pub struct Consume<'info> {
    #[account(has_one=authority, has_one=mint)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [b"mint", mint.key().as_ref()],
        bump = listing_mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub listing_token_account: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,

    // The listing authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction()]
pub struct SetReceiptCashable<'info> {
    #[account(has_one=authority)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(mut, has_one=listing)]
    pub receipt: Account<'info, Receipt>,

    // The listing authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(mint_bump: u8, listing_mint_decimals: u8)]
pub struct InitListing<'info> {
    // 8 for the tag
    // 235 for the size of the listing account itself
    // 128 for metadata URI
    #[account(init, seeds=[b"listing", mint.key().as_ref()], bump, payer = user, space = 8 + 235 + 128)]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        seeds = [b"mint", mint.key().as_ref()],
        bump = mint_bump,
    )]
    pub mint_authority_pda: AccountInfo<'info>,

    #[account(init, mint::decimals = listing_mint_decimals, mint::authority = mint_authority_pda, mint::freeze_authority = mint_authority_pda, payer = user)]
    pub mint: Box<Account<'info, Mint>>,

    pub payment_deposit: Box<Account<'info, TokenAccount>>,
    pub vote_deposit: Box<Account<'info, TokenAccount>>,

    // Box'd to move the charter (which is fairly hefty)
    // to the heap instead of the stack.
    // Not actually sure if this is a good idea, but
    // without the Box, we run out of space?
    pub charter: Box<Account<'info, Charter>>,

    #[account(has_one=charter)]
    pub charter_treasury: Box<Account<'info, CharterTreasury>>,

    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListing<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListingDeposit<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub payment_deposit: Account<'info, TokenAccount>,
    pub vote_deposit: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListingAuthority<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct SetListingCharter<'info> {
    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction()]
pub struct InitCharter<'info> {
    // 8 for the tag
    // 8 + 1 + 8 + 1 + 8 + 1 + 32 + 32 + 32 + 128 for the charter
    // 256 as a buffer for future versions
    #[account(init, seeds = [b"charter", mint.key().as_ref()], bump, payer = user, space = 8 + 8 + 1 + 8 + 1 + 8 + 1 + 32 + 32 + 32 + 128 + 256)]
    pub charter: Account<'info, Charter>,

    pub mint: Account<'info, Mint>,

    pub authority: AccountInfo<'info>,

    pub vote_deposit: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharter<'info> {
    #[account(mut)]
    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterVoteDeposit<'info> {
    #[account(mut)]
    pub charter: Account<'info, Charter>,

    pub vote_deposit: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterAuthority<'info> {
    #[account(mut)]
    pub charter: Account<'info, Charter>,

    pub authority: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
#[instruction(treasury_bump: u8)]
pub struct InitCharterTreasury<'info> {
    // 8 for the tag
    // 8 + 1 + 8 + 1 + 8 + 1 + 32 + 32 + 32 + 128 for the charter
    // 128 as a buffer for future versions
    #[account(init,
        seeds = [b"treasury", charter.key().as_ref(), mint.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + 1 + 32 + 32 + 8 + 1 + 128
    )]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(
        has_one=authority
    )]
    pub charter: Account<'info, Charter>,

    #[account(
        has_one=mint
    )]
    pub deposit: Account<'info, TokenAccount>,

    // The mint of the deposit account 
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterTreasuryExpansionScalar<'info> {
    #[account(mut, has_one=charter)]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(has_one=authority)]
    pub charter: Account<'info, Charter>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetCharterTreasuryDeposit<'info> {
    #[account(mut, has_one=charter)]
    pub treasury: Account<'info, CharterTreasury>,

    #[account(has_one=authority)]
    pub charter: Account<'info, Charter>,

    #[account(has_one=mint)]
    pub deposit: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(stake_bump: u8)]
pub struct InitCashier<'info> {
    // 8 for the tag
    // 1 for is_initalized 
    // 32 for charter
    // 32 for stake
    // 8 for last_withdraw_epoch 
    // 32 for authority
    // 128 for URI
    // 128 for future versions
    #[account(init,
        payer = authority,
        space = 8 + 1 + 32 + 32 + 8 + 128 +  128
    )]
    pub cashier: Account<'info, Cashier>,

    #[account(init,
        payer=authority,
        token::mint = charter_mint,
        token::authority = stake_authority
    )]
    pub stake: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"cashier.stake", stake.key().as_ref()],
        bump=stake_bump,
    )]
    pub stake_authority: AccountInfo<'info>,

    #[account(
        constraint=charter.mint == charter_mint.key()
    )]
    pub charter: Account<'info, Charter>,
    pub charter_mint: Account<'info, Mint>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(escrow_bump: u8)]
pub struct InitCashierTreasury<'info> {
    // 8 for the tag 
    // 1 for is_initialized
    // 32 for cashier
    // 32 for deposit 
    // 32 for mint 
    // 128 for future verisons
    #[account(
        init, 
        payer=authority,
        space= 8 + 1 + 32 + 32 + 32 + 128
    )]
    pub treasury: Account<'info, CashierTreasury>,

    #[account(has_one=authority)]
    pub cashier: Account<'info, Cashier>, 

    #[account(has_one=mint)]
    pub deposit: Account<'info, TokenAccount>,

    #[account(
        init,
        payer=authority,
        token::mint = mint,
        token::authority = escrow_authority
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"cashier.escrow", escrow.key().as_ref()],
        bump=escrow_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    pub authority: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub clock: Sysvar<'info, Clock>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

#[derive(Accounts)]
#[instruction(mint_authority_bump: u8)]
pub struct BurnCashierStake<'info> {
    #[account(has_one=authority, has_one=mint)]
    pub charter: Account<'info, Charter>,

    #[account(has_one=charter, has_one=stake)]
    pub cashier: Account<'info, Cashier>, 

    #[account(mut, has_one=mint)]
    pub stake: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"mint", mint.key().as_ref()],
        bump=mint_authority_bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    pub authority: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(mint_authority_bump: u8, cashier_escrow_bump: u8)]
pub struct WithdrawCashierTreasury<'info> {
    #[account(constraint=charter.mint==vote_mint.key())]
    pub charter: Account<'info, Charter>,

    // The treasury of the charter
    #[account(mut, has_one=charter)]
    pub charter_treasury: Account<'info, CharterTreasury>,

    #[account(has_one=charter, has_one=stake)]
    pub cashier: Account<'info, Cashier>, 

    // The token account that contains the stake 
    // the cashier has in the network
    #[account(constraint=stake.mint==vote_mint.key())]
    pub stake: Account<'info, TokenAccount>,

    // The treasury that binds the escrow, deposit, and 
    // cashier together
    #[account(
        has_one=cashier,
        has_one=escrow,
        has_one=deposit, 
        constraint=cashier_treasury.mint==payment_mint.key()
    )]
    pub cashier_treasury: Account<'info, CashierTreasury>,

    // Where the tokens are right now 
    #[account(
        mut,
        constraint=escrow.mint==payment_mint.key() 
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"cashier.escrow", escrow.key().as_ref()],
        bump=cashier_escrow_bump,
    )]
    pub escrow_authority: AccountInfo<'info>,

    // Where the tokens will end up after we withdraw
    #[account(mut, 
        constraint=deposit.mint==payment_mint.key() 
    )]
    pub deposit: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payment_mint: Account<'info, Mint>,

    // The governance token mint
    pub vote_mint: Account<'info, Mint>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}


#[derive(Accounts)]
#[instruction(stake_bump: u8)]
pub struct WithdrawCashierStake<'info> {
    #[account(mut, constraint=charter.mint==vote_mint.key())]
    pub charter: Account<'info, Charter>,

    #[account(has_one=charter, has_one=stake)]
    pub cashier: Account<'info, Cashier>, 

    // The token account that contains the stake 
    // the cashier has in the network
    #[account(constraint=stake.mint==vote_mint.key())]
    pub stake: Account<'info, TokenAccount>,

    #[account(
        seeds=[b"cashier.stake", stake.key().as_ref()],
        bump=stake_bump,
    )]
    pub stake_authority: AccountInfo<'info>,

    // Where the tokens will end up after we withdraw
    #[account(mut, 
        constraint=deposit.mint==vote_mint.key() 
    )]
    pub deposit: Account<'info, TokenAccount>,

    // The governance token mint
    pub vote_mint: Account<'info, Mint>,

    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>
}

