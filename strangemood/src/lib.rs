use solana_program::pubkey::Pubkey;

pub mod entrypoint;
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

pub(crate) struct StrangemoodPDA {}
impl StrangemoodPDA {
    fn mint_authority(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[br"strangemood", br"mint_authority", &mint.to_bytes()],
            &program_id,
        )
    }
}
