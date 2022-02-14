use anchor_lang::{solana_program, declare_id, prelude::*, System, account, Accounts};
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_lang::solana_program::system_instruction;

declare_id!("sm2oiswDaZtMsaj1RJv4j4RycMMfyg8gtbpK2VJ1itW");

pub fn mint_to_and_freeze<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {

    mint_to(
        token_program.clone(),
        mint.clone(),
        to.clone(),
        authority.clone(),
        bump,
        amount,
    )?;
    freeze_account(token_program, mint, to, authority, bump)
}

pub fn mint_to<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::MintTo {
        mint: mint,
        to: to,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::mint_to(cpi_ctx, amount)
}

pub fn freeze_account<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::FreezeAccount {
        mint: mint,
        account: account,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::freeze_account(cpi_ctx)
}

// Transfer from one token account to another using the Token Program
pub fn token_escrow_transfer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
    bump: u8,
) -> ProgramResult {
    let cpi_program = token_program;
    let key = from.key.clone();
    let cpi_accounts = anchor_spl::token::Transfer {
        from,
        to,
        authority,
    };
    let seeds = &[b"escrow", key.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::transfer(cpi_ctx, amount)
}

pub fn token_transfer<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cpi_accounts = anchor_spl::token::Transfer {
        from,
        to,
        authority,
    };
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    anchor_spl::token::transfer(cpi_ctx, amount)
}

pub fn burn<'a>(
    token_program: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    account: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
    amount: u64,
) -> ProgramResult {
    let cpi_program = token_program;
    let cloned_mint = mint.key.clone();
    let cpi_accounts = anchor_spl::token::Burn {
        mint: mint,
        to: account,
        authority: authority,
    };
    let seeds = &[b"mint", cloned_mint.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::burn(cpi_ctx, amount)
}

pub fn sync_native<'a>(token_program: &AccountInfo<'a>, account: AccountInfo<'a>) -> ProgramResult {
    let ix = spl_token::instruction::sync_native(&token_program.key(), &account.key())?;

    solana_program::program::invoke(&ix, &[account.clone()])
}

pub fn system_transfer<'a>(
    system_program: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> ProgramResult {
    let ix = system_instruction::transfer(&from.key(), &to.key(), lamports);

    solana_program::program::invoke(&ix, &[from.clone(), to.clone(), system_program.clone()])
}

pub fn erase_data<'a>(account: &AccountInfo<'a>) {
    let mut data = account.data.borrow_mut();
    data.fill(0);
}

pub fn move_lamports<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
    amount: u64
) {
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(amount)
        .unwrap();
    **source_account_info.lamports.borrow_mut() = source_account_info.lamports().checked_sub(amount).unwrap();
}

pub fn close_native_account<'a>(
    source_account_info: &AccountInfo<'a>,
    dest_account_info: &AccountInfo<'a>,
){
    let dest_starting_lamports = dest_account_info.lamports();
    **dest_account_info.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(source_account_info.lamports())
        .unwrap();
    **source_account_info.lamports.borrow_mut() = 0;

    erase_data(source_account_info);
}

pub fn close_token_escrow_account<'a>(
    token_program: AccountInfo<'a>,
    from: AccountInfo<'a>,
    to: AccountInfo<'a>,
    authority: AccountInfo<'a>,
    bump: u8,
) -> ProgramResult {
    let cpi_program = token_program;
    let key = from.key.clone();
    let cpi_accounts = anchor_spl::token::CloseAccount {
        authority,
        account: from,
        destination: to,
    };
    let seeds = &[b"escrow", key.as_ref(), &[bump]];
    let signers = &[&seeds[..]];
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signers);
    anchor_spl::token::close_account(cpi_ctx)
}

#[program]
pub mod strangemood {
    use anchor_lang::{prelude::Context, solana_program::program_option::COption};

    use super::*;

    pub fn init_listing(
        ctx: Context<InitListing>,
        _mint_bump: u8,
        _decimals: u8,
        price: u64,
        refundable: bool,
        consumable: bool,
        available: bool,
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

        Ok(())
    }

    pub fn purchase(
        ctx: Context<Purchase>,
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
            msg!("Minting tokens");
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
        receipt.cashier = ctx.accounts.cashier.key();
        receipt.nonce = receipt_nonce;
        receipt.price = listing.price;
        receipt.escrow = ctx.accounts.escrow.key();

        // If the listing is refundable, then you can't immediately
        // cash out the receipt.
        receipt.is_cashable = !listing.is_refundable;

        Ok(())
    }

    pub fn cash(
        ctx: Context<Cash>,
        listing_mint_bump: u8,
        charter_mint_bump: u8,
        escrow_authority_bump: u8
    ) -> ProgramResult {
        let listing = ctx.accounts.listing.clone().into_inner();
        let charter = ctx.accounts.charter.clone().into_inner();
        let receipt = ctx.accounts.receipt.clone().into_inner();

        if !receipt.is_cashable {
            return Err(StrangemoodError::ReceiptNotCashable.into());
        }
        if receipt.cashier != ctx.accounts.cashier.key() {
            return Err(StrangemoodError::OnlyCashableByTheCashier.into());
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

        let lamports: u64 = receipt.price;
        let deposit_rate = 1.0 - charter.payment_contribution_rate();
        let deposit_amount = (deposit_rate * lamports as f64) as u64;
        let contribution_amount = lamports - deposit_amount;

        // Transfer from escrow to lister
        token_escrow_transfer(
            ctx.accounts.token_program.to_account_info(),
        ctx.accounts.escrow.to_account_info(),
            ctx.accounts.listings_payment_deposit.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            deposit_amount as u64,
            escrow_authority_bump
        )?;
    
        // Transfer from escrow to charter
        token_escrow_transfer(
            ctx.accounts.token_program.to_account_info(),
        ctx.accounts.escrow.to_account_info(),
            ctx.accounts.charter_treasury_deposit.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            contribution_amount as u64,
            escrow_authority_bump
        )?;

        move_lamports(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.charter_treasury_deposit.to_account_info(),
            contribution_amount as u64,
        );

        let treasury = ctx.accounts.charter_treasury.clone().into_inner();
        let votes = contribution_amount as f64 * charter.expansion_rate(treasury.expansion_scalar_amount, treasury.expansion_scalar_decimals);
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

        // Close the escrow
        close_token_escrow_account(
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.escrow.to_account_info(),
            ctx.accounts.cashier.to_account_info(),
            ctx.accounts.escrow_authority.to_account_info(),
            escrow_authority_bump
        )?;

        close_native_account(
            &ctx.accounts.receipt.to_account_info(),
            &ctx.accounts.cashier.to_account_info(),
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
        token_escrow_transfer(            
            ctx.accounts.token_program.to_account_info(), 
            ctx.accounts.escrow.to_account_info(), 
            ctx.accounts.return_deposit.to_account_info(), 
            ctx.accounts.escrow_authority.to_account_info(), 
            ctx.accounts.escrow.amount,
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

    pub fn set_receipt_cashable(ctx: Context<SetReceiptCashable>) -> ProgramResult {
        if ctx.accounts.authority.key() != ctx.accounts.listing.authority {
            return Err(StrangemoodError::UnauthorizedAuthority.into());
        }

        let receipt = &mut ctx.accounts.receipt;
        receipt.is_cashable = true;

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
        treasury.expansion_scalar_amount = expansion_scalar_amount; 
        treasury.expansion_scalar_decimals = expansion_scalar_decimals; 

        Ok(())
    }

    pub fn set_charter_treasury_expansion_scalar(ctx: Context<SetCharterTreasuryExpansionScalar>, expansion_scalar_amount: u64, expansion_scalar_decimals: u8) -> ProgramResult {
        
        let treasury = &mut ctx.accounts.treasury;
        treasury.expansion_scalar_amount = expansion_scalar_amount; 
        treasury.expansion_scalar_decimals = expansion_scalar_decimals; 

        Ok(())
    }

    pub fn set_charter_treasury_deposit(ctx: Context<SetCharterTreasuryDeposit>) -> ProgramResult {
        let treasury = &mut ctx.accounts.treasury;
        treasury.deposit = ctx.accounts.deposit.key(); 

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(receipt_nonce: u128, listing_mint_bump: u8, escrow_authority_bump:u8)]
pub struct Purchase<'info> {

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

    // A receipt that the RedeemPurchase can use to pay everyone
    //
    // SOL is held in the receipt account, as an escrow,
    // and then distributed back to the purchaser upon "refund"
    // or to the realm & lister upon "cash".
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
        space = 8 + 1 + 1 + 1 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 16)]
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
pub struct Cash<'info> {
    pub cashier: Signer<'info>,

    #[account(mut,
        has_one=listing, has_one=listing_token_account, has_one=cashier, has_one=escrow)]
    pub receipt: Account<'info, Receipt>,

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
        constraint=charter.clone().into_inner().mint==charter_mint.key()
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

#[account]
pub struct Receipt {
    /// Set to "true" by the program when BeginPurchase is run
    /// Contracts should not trust receipts that aren't initialized
    pub is_initialized: bool,

    // If true, then the listing was refundable at the time it was
    // purchased, and so this receipt is still refundable.
    pub is_refundable: bool,

    // If false, this receipt cannot be completed.
    pub is_cashable: bool,

    // The listing that was purchased
    pub listing: Pubkey,

    // The token account to send the listing tokens to
    // It's possible to purchase the game for another person,
    // So this is not necessarily the purchaser's token account
    pub listing_token_account: Pubkey,

    // The user that purchased the listing
    // This user is allowed to refund the purchase.
    pub purchaser: Pubkey,

    // The entity that's allowed to finalize (cash out) this receipt.
    // Typically the marketplace or
    // the client application that started the sale.
    pub cashier: Pubkey,

    // A token account where payment is held in escrow
    pub escrow: Pubkey,

    // The amount of the listing token to be distributed upon redeem
    pub quantity: u64,

    // The price when they bought the listing. We store this here
    // because the price could be updated in between purchase and cash.
    pub price: u64,

    // A unique series of bytes used to generate the PDA and bump 
    // for this receipt from `["receipt", listing_pubkey, nonce]`
    pub nonce: u128,
}

#[account]
pub struct Listing {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // If "false", this listing cannot be bought.
    pub is_available: bool,

    // The charter that this listing is associated with
    pub charter: Pubkey,

    /// The entity that's allowed to modify this listing
    pub authority: Pubkey,

    /// The token account to deposit sol into
    pub payment_deposit: Pubkey,

    /// The token account to deposit community votes into
    pub vote_deposit: Pubkey,

    /// Lamports required to purchase 1 listing token amount.
    pub price: u64,

    /// The mint that represents the token they're purchasing
    /// The decimals of the listing are always 0.
    pub mint: Pubkey,

    // The URI for where metadata can be found for this listing.
    // Example: "ipns://examplehere", "https://example.com/metadata.json"
    pub uri: String,

    // If true, this listing can be refunded.
    //
    // When refundable, a purchase receipt starts with cashable=false
    // and needs the authority of the listing to run SetCashable
    // before the purchase can complete.
    pub is_refundable: bool,

    // If true, this listing can be "consumed" by the authority of
    // the listing arbitrarily.
    //
    // Listers can use this to implement subscriptions, usage-based pricing,
    // in-app purchases, and so on.
    pub is_consumable: bool,
}

#[account]
pub struct Charter {
    pub is_initialized: bool,

    // The amount of voting tokens to give to a user per
    // 1.0 wrapped SOL contributed via community account contributions.
    //
    // Note that Borsh doesn't support floats, and so we carry over the pattern
    // used in the token program of having an "amount" and a "decimals".
    // So an "amount" of 100 and a "decimals" of 3 would be 0.1
    pub expansion_rate_amount: u64,
    pub expansion_rate_decimals: u8,

    // The % of each purchase that goes to the community account.
    pub payment_contribution_rate_amount: u64,
    pub payment_contribution_rate_decimals: u8,

    // The % of each vote token minting goes back to the governance to fund
    // new ecosystem projects
    pub vote_contribution_rate_amount: u64,
    pub vote_contribution_rate_decimals: u8,

    // The pubkey of the keypair that can modify this charter. 
    // If this points to a system account, then this is basically 
    // a dictatorship. If it points to a PDA of a program, then 
    // this can be any arbitrary governance.
    pub authority: Pubkey,

    // The native token of this governance that's issued to listers
    // upon sale. The authority of this mint must be a PDA with seeds 
    // ["mint", mint.key()].
    pub mint: Pubkey,

    // The community treasury of the native token.
    pub vote_deposit: Pubkey,

    // The URL host where off-chain services can be found for this governance.
    // Example: "https://strangemood.org", "http://localhost:3000", "https://api.strangemood.org:4040"
    pub uri: String,
}

// An charter-approved deposit account. There is only one treasury per mint and charter.
#[account]
pub struct CharterTreasury {
    /// Set to "true" by the program when InitListing is run
    /// Contracts should not trust listings that aren't initialized
    pub is_initialized: bool,

    // The charter this is associated with
    pub charter: Pubkey,

    // The token account for this charter 
    pub deposit: Pubkey,

    // The mint of the deposit that this is associated with.
    pub mint: Pubkey,

    // Increases or decreases the amount of voting tokens.
    // distributed based on this deposit type.
    // amount=1 and decimals=0 is 1.0
    // amount=15 and decimals=1 is 1.5
    pub expansion_scalar_amount: u64,
    pub expansion_scalar_decimals: u8,
}

pub(crate) fn amount_as_float(amount: u64, decimals: u8) -> f64 {
    amount as f64 / i32::pow(10, decimals.into()) as f64
}

impl Charter {
    pub fn expansion_rate(&self, scalar_amount: u64, scalar_decimals: u8) -> f64 {
        amount_as_float(self.expansion_rate_amount, self.expansion_rate_decimals) 
            * amount_as_float(scalar_amount, scalar_decimals)
    }
    pub fn payment_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.payment_contribution_rate_amount,
            self.payment_contribution_rate_decimals,
        )
    }
    pub fn vote_contribution_rate(&self) -> f64 {
        amount_as_float(
            self.vote_contribution_rate_amount,
            self.vote_contribution_rate_decimals,
        )
    }
}

#[error]
pub enum StrangemoodError {

    // custom program error: 0x1770
    #[msg("MintNotSupported")]
    MintNotSupported,

    // custom program error: 0x1771
    #[msg("Unauthorized Charter")]
    UnauthorizedCharter,

    // custom program error: 0x1772
    #[msg("Deposit not found in listing")]
    DepositIsNotFoundInListing,

    // custom program error: 0x1773
    #[msg("Unexpected Listing Token Account")]
    UnexpectedListingTokenAccount,

    // custom program error: 0x1774
    // You attempted to pass in a deposit that is not the one 
    // found in the charter
    #[msg("Deposit not found in charter")]
    DepositIsNotFoundInCharter, 

    // custom program error: 0x1775
    // You attempted to pass in a mint that is not the one 
    // found in the charter
    #[msg("Mint is not found in charter")]
    MintIsNotFoundInCharter,

    // custom program error: 0x1776
    // You attempted to pass in an authority that is not the 
    // authority of a listing or charter
    #[msg("Provided Authority Account Does Not Have Access")]
    UnauthorizedAuthority,

    // custom program error: 0x1777
    #[msg("Receipt is not currently cashable")]
    ReceiptNotCashable,

    // custom program error: 0x1778
    #[msg("Only Cashable by the Cashier")]
    OnlyCashableByTheCashier,

    // custom program error: 0x1779
    #[msg("Listing is Unavailable")]
    ListingUnavailable,

    // custom program error: 0x177a
    #[msg("Mint did not match Listing")]
    UnexpectedListingMint,

    // custom program error: 0x177b
    #[msg("Listing is not consumable")]
    ListingIsNotConsumable,
    
    // custom program error: 0x177c
    // Creating a charter requires the signer to be the mint authority
    #[msg("Signer is not Mint Authority")]
    SignerIsNotMintAuthority,
}
